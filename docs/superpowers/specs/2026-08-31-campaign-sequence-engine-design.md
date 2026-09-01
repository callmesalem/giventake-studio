# Campaign Sequence Engine — Design

**Date:** 2026-08-31
**Status:** Approved, not yet implemented
**Scope:** Email only

## The gap

The database already contains a complete multi-step sequence data model — `campaigns`,
`campaign_steps`, `campaign_enrollments`, `campaign_events` — plus `newsletter_subscribers`,
`newsletter_issues` and `newsletter_sends`. None of it has a sender. The schema names the
terminal states (`replied`, `unsubscribed`, `suppressed`, `bounced`, `completed`, `stopped`),
carries relative scheduling in `campaign_steps.delay_hours`, and holds the runner's cursor in
`campaign_enrollments.current_step` + `last_advanced_at`.

What exists today is one transactional path: `src/lib/intake.ts` POSTs to `api.resend.com/emails`
for contact-form notifications, with a `mailto:` fallback when unconfigured and a lead auto-reply
that is dormant behind `LEAD_AUTOREPLY_ENABLED` (default false).

This design builds the engine the schema implies.

## Governing constraint: charter §3.8

`approved_recipients` is a **positive, per-SOP allowlist**. Its own comment states that rows are
added by a human only, and that no agent-callable insert RPC exists. Both gates fail closed:
`isApprovedRecipient` catches to `false`, `isSuppressed` catches to `true`.

**Decision:** the engine automates *timing*, never *targeting*. A human approves each address (or
domain) for a SOP; the engine decides only when the next step fires and whether to stop. Throughput
is bounded by human approval, and that is the point — it is what makes a cron-driven Worker the
right-sized runtime rather than a queue.

Note the codebase runs two consent models side by side and this design does not merge them:

| Path | Authority |
|---|---|
| Newsletter (`canReceiveNewsletter`) | Subscription status + suppression — blocklist model |
| SOP outreach (`is_approved_recipient`) | Positive human-created approval record per SOP |

## Architecture

Cron-triggered handler on the existing Cloudflare Worker. Same repo, same deploy, same secrets,
already covered by Workers Builds and CI.

Rejected alternatives: `pg_cron` + `pg_net` (would put the Resend key in the database and force
template rendering into SQL, contradicting the posture that the service-role key never leaves the
server); Cloudflare Queues + Durable Objects (correct at high volume, over-built for
allowlist-gated volume).

### Components

Ports-and-adapters, mirroring `src/server/operator-control/` so orchestration is testable without
a network.

| File | Purpose |
|---|---|
| `src/server/campaigns/types.ts` | `CampaignStore`, `Mailer`, `Clock` interfaces |
| `src/server/campaigns/runner.ts` | Pure orchestration — advance due enrollments |
| `src/server/campaigns/policy.ts` | Gate evaluation, fail-closed |
| `src/server/campaigns/supabase-store.ts` | RPC adapter |
| `src/server/campaigns/mailer.ts` | Resend adapter, extracted from the sender in `intake.ts` |

Entry points on the existing Worker:

- `scheduled` handler — the send tick
- `email` handler — Cloudflare Email Routing, for reply detection
- `GET /e/u/:token` — unsubscribe
- `POST /api/webhooks/resend` — bounce and delivery events

## Schema additions

All additive. No `DROP`, no destructive `ALTER`, consistent with the rest of this schema.

### `campaigns.sop text`

`is_approved_recipient(address, sop)` requires a SOP and `campaigns` has no such column, so today
the gate cannot be called for a campaign at all. Without this the engine cannot be compliant.

### `campaign_sends`

```
id, enrollment_id, step_order, status ('sending'|'sent'|'failed'),
provider_message_id, attempts, error, created_at, sent_at
unique (enrollment_id, step_order)
```

This is the idempotency spine, not merely an audit log. The unique constraint is what makes a
replayed tick collide instead of double-sending.

### Claim and mutation RPCs

`SECURITY DEFINER`, `service_role` only, RLS forced — matching the existing narrow-RPC posture.

- `campaign_claim_due(p_limit int, p_lease_seconds int)` — `FOR UPDATE SKIP LOCKED`
- `campaign_record_send(...)`
- `campaign_mark_status(...)`

## Send tick

1. Claim due enrollments under a lease (`last_advanced_at + delay_hours <= now()`).
2. Resolve the recipient address from `leads.email` via the enrollment's `lead_id`. An enrollment
   whose lead has no usable address stops with the reason recorded — it is a data problem, not a
   transient one, so retrying cannot help.
3. **Re-check both gates.** Not at enrollment time — at send time.
4. Insert `campaign_sends` as `sending`.
5. Send via Resend.
6. Mark `sent`, write a `campaign_event`, advance `current_step`.

Gates are re-checked at send because an address can land on `do_not_contact`, or an approval can
pass `expires_at`, between enrolling and step 4 firing. Checking only at enrollment would let the
engine mail someone who became off-limits days earlier.

Outcomes: suppressed → status `suppressed`. Not on the allowlist → status `stopped`, with the
reason recorded in `campaign_events`. It never sends and it never silently skips.

## Reply tick

Cloudflare Email Routing delivers to the Worker's `email` handler. Match `In-Reply-To` /
`References` against `campaign_sends.provider_message_id` — header matching rather than tagged
reply-to addressing, so it survives forwards and clients that rewrite the envelope.

On a match: mark the enrollment `replied`, record the event, **and forward the raw message to the
human inbox**. The engine must never be the reason a customer reply goes unseen. Unmatched mail is
forwarded unchanged.

## Failure handling

**Ambiguity resolves to "sent."** A `campaign_sends` row still marked `sending` after its lease
expires is treated as sent and not retried. The bias is deliberate: missing one step of a sequence
is a small loss; emailing a prospect twice is the failure people remember.

Resend errors release the lease and increment `attempts`. Retries back off on the tick after
`attempts` ticks — so roughly 1, 2 and 4 ticks later at a 5-minute cadence. After **3 failed
attempts** the enrollment moves to `stopped` with the error recorded in `campaign_events`, rather
than retrying indefinitely against an address or a provider that is not going to start working.

A 4xx from Resend that is not rate-limiting (a malformed or rejected address) stops immediately
without consuming all three attempts — it will not succeed on retry.

Bounce webhooks set status `bounced`. Unsubscribe tokens are HMAC-signed so they cannot be forged
or enumerated.

## Testing

Pure runner tests against a fake clock, store and mailer, in the style of the existing
`tests/*.test.mjs` suite.

| Test | Asserts |
|---|---|
| Suppressed address | No send |
| Address not on allowlist | No send, status `stopped`, reason recorded |
| **Expired** approval | No send — `expires_at` is honoured, not just presence |
| Replayed tick | Exactly one send |
| Crash between send and record | Treated as sent, not retried |
| Forged unsubscribe token | Rejected |
| Reply header match | Enrollment marked `replied` |
| Unmatched inbound mail | Still forwarded to the human inbox |

## Non-goals

- `linkedin` and `manual` channels, though `campaign_steps.channel` allows them
- Migrating `campaign_enrollments.lead_id` from `leads` to `contacts`
- Payments / invoice collection
- The newsletter broadcast sender

## Known wrinkles

**`campaign_enrollments.lead_id` references `leads`, not `contacts`.** Phase 1 unified leads into
contacts with lifecycle stages, and `/crm/leads/$id` now redirects. Both tables still exist and
`leads_list` returns rows, so this is not broken. The engine resolves contact identity at send time
and leaves the foreign key alone; migrating it is a separate change with its own risk.

**Production configuration is unverified.** Whether `RESEND_API_KEY` is set as a Cloudflare secret,
and whether SPF/DKIM domain authentication is complete, could not be confirmed from here. Both must
be checked before the first real send.

## Prerequisites

1. Confirm `RESEND_API_KEY` is set in the Worker's secrets.
2. Confirm SPF/DKIM are configured for the sending domain.
3. Configure Cloudflare Email Routing for the reply address.
4. Apply the additive migration (`campaigns.sop`, `campaign_sends`, claim RPCs).
