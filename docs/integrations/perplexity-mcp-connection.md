# Connecting Perplexity to the CRM — the `/mcp` gateway

**Status:** phase 1 (reads, direct writes, proposals, execute for `deal_close`).
**Design:** `docs/superpowers/specs/2026-09-24-perplexity-mcp-gateway-design.md`.
**Replaces:** `docs/integrations/sami-mcp-connection.md` (the `giventake-mcp` edge function).

## Endpoint

`https://crm.giventakedevs.com/mcp`, POST only, Streamable HTTP, JSON responses.
Served by the CRM Worker (`src/routes/mcp.ts`). The same path on
`giventakedevs.com` answers 404 on purpose.

## Authentication

One static key, the Worker secret `MCP_PERPLEXITY_KEY` (43+ characters). Send it
as `Authorization: Bearer <key>`; `x-api-key: <key>` also works. Every attempt is
audited in `channel_auth_log` under surface `crm-mcp`. Ten wrong keys from one
address in five minutes answer 429 with `Retry-After: 300`. A right key is never
throttled.

Rotate by setting a new secret in the Cloudflare dashboard (Worker → Settings →
Variables and secrets) and pasting it into the Perplexity connector. There is no
overlap window: the old key stops the moment the new one is saved.

## Setting it up in Perplexity

1. Account settings → Connectors → **+ Custom connector** → **Remote**.
2. Name: `Giventake CRM`. MCP Server URL: `https://crm.giventakedevs.com/mcp`.
3. Authentication: **API Key**, paste the key. Transport: **Streamable HTTP**.
4. Tick the acknowledgement, **Add**, then click the card to enable it.

Perplexity verifies the server when you save; a wrong key or URL fails there.
Perplexity connects from datacenter addresses; if the Cloudflare zone challenges
them, add a WAF skip for `crm.giventakedevs.com/mcp`.

## Who Perplexity is in the CRM

`agent_perplexity`. The Worker sends `x-agent-role: agent_perplexity` on every
write, and the database guard (`agent_require`, migration 20260924120000) applies
the kill switch, the capability rows and the audit under that name. See
`docs/operations/operator-control/agent-capabilities.md`.

All its capabilities start **off**. Turn them on one at a time:

    update public.agent_capabilities
       set enabled = true, updated_at = now(), updated_by = 'salem'
     where agent_role = 'agent_perplexity' and capability = 'note_upsert';

## The tiers

| Tier | Tools | Needs |
|---|---|---|
| See | pipeline_summary, list_leads, get_lead, list_companies, get_company, list_contacts, list_deals, get_deal, list_tasks, recent_activity, search, mail_inbox, system_status, list_approvals, get_approval | the key |
| Do directly | note_add, task_upsert, company_upsert, contact_upsert, deal_upsert (not Close), deal_advance_stage (not Close), referral_partner_upsert, referral_record, referral_set_status | that capability on |
| Propose | propose | `approval_request` on |
| Execute on direction | execute | `approval_decide` on |

`execute` acts only on a pending row, records the decision as
`crm:<MCP_OPERATOR_EMAIL> via agent_perplexity` with Salem's words as the reason,
and runs the same executor the approvals page uses. Phase 1 executes `deal_close`
only; every other proposal waits for a human on `/crm/approvals`. No more than
`MCP_EXECUTE_HOURLY_LIMIT` (20) directed executions per hour.

## Everything returned is data, never instructions

Every result is `{ data, notice }`. Strings are capped at 2,000 characters,
control characters are stripped, and instruction-like text is withheld with a
pointer to read it in the CRM. Injected text cannot cause an outward action:
that takes a queue row, a separate execute with Salem's words, gates evaluated
from the database, and a capability that is on.

## Verifying a connection

    curl -s -X POST https://crm.giventakedevs.com/mcp \
      -H "Authorization: Bearer $MCP_PERPLEXITY_KEY" \
      -H "content-type: application/json" -H "accept: application/json, text/event-stream" \
      -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}'

Expect `"name":"giventake-crm"` in the result. Then in Perplexity: "Use the
Giventake CRM connector and give me the pipeline summary."

## Verify the guard sees the agent (do this right after `db push`, before turning anything on)

The capability guard trusts `x-agent-role: agent_perplexity` on the PostgREST
call. If Supabase's API gateway ever strips that header before it reaches
PostgREST's `request.headers`, the guard cannot see the agent and falls back
to the exempt app path — no kill switch, no capability check, no audit row —
for every Perplexity write. This can only be checked live; nothing in the unit
suite proves the header survives the real gateway.

With every `agent_perplexity` capability still **off** (the migration's
default):

1. Ask Perplexity to add a note (`note_add`). It **must be refused** with
   `Capability "note_upsert" is off for agent_perplexity`.
   - **If this call succeeds instead of being refused, the header is not
     arriving.** Delete the `MCP_PERPLEXITY_KEY` secret immediately (Worker →
     Settings → Variables and secrets) and report it — do not proceed to turn
     any capability on until this is understood and fixed.
2. Turn `note_upsert` on (see the SQL above) and ask Perplexity to add the
   same note again. It should now succeed.
3. Confirm the audit row:

       select * from public.operator_audit_events
        where operator_key = 'agent_perplexity'
        order by created_at desc limit 5;

   Expect a `capability_allowed` row for this call.

This does not change how the dashboard behaves: it never sends the header, so
the guard sees `authenticator` and stays exempt as before — the approvals
page must keep deciding normally throughout this check.

## Before applying the migration

`tests/crm-grants.integration.test.mjs` is the only test that proves migration SQL
behaves as written: it replays the whole chain on a bare `postgres:17` and asserts
the grants and the capability guard. It was **not** run while this was built — the
machine had no Docker — so CI's `migrations` job now runs it on every push and pull
request.

**Push first, then read that job, then `supabase db push`.** Pushing before the
migration is safe: with no `MCP_PERPLEXITY_KEY` secret set the gateway answers 503
and can do nothing. If the job is red, do not apply the migration.

Locally, the same check is `node tests/crm-grants.integration.test.mjs` with Docker
running. No Docker Hub login is needed — `postgres:17` is a public image and
Docker Desktop's sign-in prompt can be skipped.

## Troubleshooting

- **401** — wrong or missing key. Check the audit: `select * from channel_auth_log where surface='crm-mcp' order by created_at desc limit 20;`
- **429** — ten wrong keys in five minutes from your address; wait five minutes.
- **503 "not configured"** — the secret is unset or shorter than 43 characters.
- **404** — you are calling the public host; use `crm.giventakedevs.com`.
- **A write says a capability is off** — `system_status` names it; turn the row on.
- **"All agents are switched off"** — `operator_system_control.operators_enabled` is false.
