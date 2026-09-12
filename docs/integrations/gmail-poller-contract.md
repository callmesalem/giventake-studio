# The Gmail poller contract

What a process on the VPS must do to keep `mail_threads` and `mail_messages`
in sync with Gmail. Written because that process is not in this repository —
the same reason `docs/integrations/sami-mcp-connection.md` exists for the
other VPS-facing integration — and because inferring the contract from the
RPC signatures in `supabase/migrations/20260912090000_mail_surface.sql` costs
more than reading it once here. Match that document's register: this is a
contract, not a tutorial, and it says what the system cannot do as plainly as
what it can.

The four functions this document is mostly about are already deployed. Two
gaps below are not: sections 2 and 8 each describe a write that no function in
this schema currently performs. They are called out where they occur rather
than smoothed over.

## 1. Why this runs on the VPS

Two independent reasons, either one would be enough on its own.

A Cloudflare Worker's execution is scoped to a single request and a CPU-time
budget measured in milliseconds. Polling Gmail every few minutes, continuously,
across days, is not a shape a Worker can hold — there is no long-running
process to poll from inside one.

The token encryption key is the harder constraint. `mail_accounts` stores
`refresh_token_enc` and `access_token_enc` as ciphertext (see the column
comments in `20260912090000_mail_surface.sql`), encrypted with a key that, per
prerequisite P3 in the phase plan, is "32 random bytes, stored only as a VPS
environment variable. It must never be committed, never reach Cloudflare, and
never appear in this repo." Postgres holds the ciphertext; the Worker does not
have the key and cannot decrypt it. A database compromise alone yields nothing
readable, and moving the poller to the Worker would mean moving that key to
Cloudflare, which is the thing P3 exists to prevent.

So the process that decrypts a refresh token and calls the Gmail API has to
run somewhere that isn't Cloudflare. That's the VPS — the same one that
already runs Sami.

## 2. The OAuth connect flow

The Google OAuth client's authorized redirect URI points at the VPS, not at
any route in this repository. (`src/routes/crm.auth.callback.tsx` is a
different OAuth flow entirely — Workspace SSO for CRM operator login via
GoTrue — and has nothing to do with the mailbox.) When an operator authorizes
the mailbox, Google redirects to the VPS with a code. The VPS exchanges that
code with Google directly, encrypts the resulting refresh token with its local
key, and inserts the `mail_accounts` row. The Worker is not involved at any
point in this exchange and cannot be, for the reason in section 1.

**No function in this schema performs that insert.** The four functions
granted for sync (section 3) are the entire agent-half surface, and none of
them creates an account row: `mail_sync_upsert_thread` and
`mail_sync_upsert_messages` write child tables that reference an existing
`account_id`, and `mail_account_set_history_id` updates one column of an
existing row. Creating the row itself is a write outside all four grants. The
only credential that reaches `mail_accounts` without going through one of
those functions is one that bypasses RLS on the table directly — today, the
service-role key, the same key `docs/operations/operator-control/agent-capabilities.md`
already treats as outside its guard boundary ("already bypasses RLS, so it was
never inside it"). The password the poller uses for the sync loop in section 3
(`crm_agent` today) cannot perform this insert; the connect flow needs the
service-role key instead.

**Precondition the connect flow must honour: at most one row in
`mail_accounts`, for the whole of Phase 1.** Nothing in the schema enforces
this. `mail_account_status()` — the app-facing function described in section 3
below — always returns the single oldest row by `created_at`; `mail_inbox_list`
has no account filter at all and lists every thread in the table regardless of
which account it belongs to. If a second mailbox were ever connected, its threads would appear
in the one inbox everybody sees, merged in silently under whichever account
happens to be older, with no way for anyone looking at the CRM to tell the two
mailboxes apart. The connect flow must check for an existing connected row and
refuse — or require an explicit override — before inserting a second one.
Multi-mailbox is a later phase, and both `mail_account_status` and
`mail_inbox_list` will need to be revisited before a second row is safe.

## 3. The poll loop

Four functions, all defined in `20260912090000_mail_surface.sql`, all granted
to `service_role`, `crm_agent`, **and** `agent_sami`:

| Function | Signature | Returns |
|---|---|---|
| `mail_account_for_sync` | `()` | `table(id uuid, email text, refresh_token_enc text, history_id text)` |
| `mail_sync_upsert_thread` | `(p_account_id uuid, p_gmail_thread_id text, p_subject text, p_snippet text, p_participants text[], p_last_message_at timestamptz, p_unread boolean, p_labels text[])` | `uuid` — the internal `mail_threads.id` |
| `mail_sync_upsert_messages` | `(p_thread_id uuid, p_messages jsonb)` | `integer` — rows inserted |
| `mail_account_set_history_id` | `(p_account_id uuid, p_history_id text)` | `void` |

**Connect the poller as `crm_agent` today.** Both roles hold every grant above,
which is deliberate and temporary: `docs/operations/operator-control/agent-capabilities.md:155`
states "Sami connects as `crm_agent` today," setting a password for
`agent_sami` is step 2 of a cutover that has not run yet, and step 5 of that
cutover — revoking `crm_agent` from every guarded function — will pick up
these four functions along with the rest once it does. Nothing about the
poller needs to change at cutover except which password it holds.

The loop, once per cycle, per connected account:

1. **Get a usable access token.** Call `mail_account_for_sync()`. It returns
   up to five rows, oldest-connected-first — Phase 1 expects exactly one, per
   the precondition in section 2, but the poller should iterate over whatever
   comes back rather than assume the count. For each row, decrypt
   `refresh_token_enc` with the VPS's local key and exchange it with Google
   for a fresh access token. If Google rejects the refresh token itself at
   this step (not the access token, which simply expires and gets refreshed
   routinely) — see section 8.

2. **List what changed.** Call `users.history.list?startHistoryId=<history_id>`,
   using the `history_id` from the row in step 1. This returns the ids of
   messages that changed since the last successful cycle. **If Gmail answers
   404 here, this is not a transient failure — go to section 5 instead of
   retrying.**

3. **Fetch each changed message.** For every message id from step 2, call
   `users.messages.get?format=metadata`. See section 4 for why this parameter
   is mandatory rather than a tuning choice.

4. **Upsert the thread.** For each distinct Gmail thread id touched in step 3,
   call `mail_sync_upsert_thread(p_account_id, p_gmail_thread_id, p_subject,
   p_snippet, p_participants, p_last_message_at, p_unread, p_labels)`. It
   resolves the CRM link (contact, company, deal) from `p_participants` and
   returns the internal `mail_threads.id` — a uuid that has no relationship to
   the Gmail thread id. **Hold onto it; the next step requires it.**

5. **Upsert the messages.** Call `mail_sync_upsert_messages(p_thread_id,
   p_messages)`, where **`p_thread_id` is the uuid step 4 returned — never the
   Gmail thread id.** The Gmail thread id is text and this parameter is a
   uuid; passing the wrong one either fails the foreign key outright or, if it
   happens to collide with an unrelated row, silently attaches messages to the
   wrong thread. `p_messages` is a JSON array, one object per message, with
   keys `gmailMessageId`, `direction` (section 6), `fromEmail`, `fromName`,
   `to` (array), `cc` (array), `sentAt`, `snippet`, `hasAttachments`. Batch
   every message belonging to one thread into a single call rather than
   calling once per message — the function recomputes the thread's
   `message_count` once, at the end of the call, from every row that exists
   for that thread.

6. **Move the cursor.** Once every message from step 2 has been upserted, call
   `mail_account_set_history_id(p_account_id, p_history_id)` with the newest
   `historyId` observed (Gmail returns one on the user profile and on every
   message resource). This must be the last thing the cycle does — section 7
   explains why the ordering matters, not just the call.

**Not the poller's: `mail_account_status()`.** A fifth function exists in
`20260912100000_mail_account_status.sql` — `mail_account_status()`, returning
`table(email text, status text)` for the single oldest row, granted to
`service_role` only. It is how the CRM app learns whether a mailbox is
connected without ever touching a token; it has nothing to do with syncing and
the poller never calls it. It is documented here only so nobody wires the VPS
to it by mistake.

## 4. `format=metadata` is not optional

`users.messages.get` supports several `format` values. `full` returns the
decoded body and the raw MIME payload; `metadata` returns headers, labels, a
size estimate, and the snippet — nothing else. `mail_messages` has no body
column. That is not an oversight; the migration's own comment says why: "with
nowhere to put a body, nobody adds a cache 'just for now' and quietly makes
this system the custodian of every client conversation the business has had."

If the poller called `format=full` and simply discarded the body after
extracting headers, the guarantee this schema is built to provide would rest
entirely on the poller doing that correctly, every time, forever, in every
code path, including whichever one eventually logs a raw API response for
debugging. `format=metadata` removes that dependency instead of relying on it:
Gmail never puts the body on the wire, so there is nothing in the poller's
memory to discard, log, or leak. Ask Gmail for `metadata`; do not ask for more
and then behave as if you'd asked for less.

## 5. The 404 backfill

Gmail does not retain history indefinitely. A `historyId` is valid for roughly
a week; once Gmail garbage-collects the underlying records, `history.list`
called with an id older than that stops returning changes and starts
answering `404`. This will happen to every connected mailbox on a roughly
weekly cadence — it is normal operation, not an edge case to handle if it ever
comes up.

Here is the failure mode if it is not handled as its own case. An error
handler that treats every non-200 from `history.list` the same way — log it,
back off, retry next cycle — cannot tell an expired history id from a network
blip; both are "the call failed, try again later." A network blip clears on
retry. An expired history id does not: the next cycle presents the identical
`startHistoryId`, gets the identical `404`, and nothing about retrying changes
that. The loop does not crash and does not surface an error to anyone — it
just stops advancing past step 2, forever, on that account. Because
`mail_accounts.status` only changes in the case in section 8 (a rejected
refresh token), never on a `history.list` 404, the account stays `connected`,
`mail_account_status()` keeps reporting it healthy, and the inbox UI keeps
showing whatever synced last with no indication that syncing stopped. The
failure is invisible from every surface the CRM exposes. The only way it
becomes visible is a person asking why a client's email from days ago never
got a reply — which is a bad way to find out, and a worse one to explain.

The fix: treat `404` from `history.list` as its own case, distinct from every
other error (section 7 covers the rest). Abandon the cursor rather than retry
it, and back-fill instead: run `users.messages.list` over a bounded window —
30 days is a reasonable starting point — which enumerates messages without
depending on history at all. Fetch and upsert whatever it finds using the same
steps 3 through 5 from the poll loop (`format=metadata`, then
`mail_sync_upsert_thread` followed by `mail_sync_upsert_messages` with the
uuid it returns), and once the window is processed, call
`mail_account_set_history_id` with a fresh `historyId` taken from the newest
message the backfill saw. That re-establishes a working cursor, and ordinary
incremental sync resumes on the next cycle.

**This needs its own test on the VPS side, deliberately, and not just this
document.** Nothing in this repository can exercise it: there is no live
Gmail account here, no way to force a real `historyId` to expire on demand,
and the tests that do exist (`tests/mail-migration.test.mjs`, the worker smoke
test) stop at the RPC layer — they cannot see whether the poller calls
`messages.list` on a 404 or just quietly retries `history.list` again. The
only way to know this path is implemented, and not merely described here, is
a VPS-side test that mocks a 404 response from `history.list` and asserts the
backfill runs. Without that test, the first time this code path actually
executes against a real expired cursor is the first time it's needed — about a
week after the first real connection — and if it isn't there, that is also the
first time anyone finds out.

## 6. `direction`

`outbound` when the message's `From` header address matches the connected
account's `mail_accounts.email`, case-insensitively. `inbound` for everything
else. This is a comparison on the address, not the display name — `From:
"Ops Team" <ops@example.com>` matches on `ops@example.com`, never on `Ops
Team`. Compare case-insensitively because neither Gmail nor SMTP normalizes
header casing, and an address that differs only in case is still the same
mailbox.

## 7. Failure posture

A failed poll cycle — a network error, a Google 5xx, a malformed response,
anything other than the `404` handled in section 5 — is retried on the next
cycle. It must never clear `history_id`. The cursor advances exactly once per
cycle, in step 6, only after every message the cycle read has been upserted.
That ordering is load-bearing, not cosmetic: `history.list` only returns
changes *since* the cursor, so if the cursor moved before or during the
upserts and the cycle died partway through, the next cycle would resume past
data that was never saved — and that data does not come back on a later call,
because as far as Gmail is concerned it was already reported once.

Errors must not carry subjects, snippets, or addresses, following the posture
in `src/server/campaigns/mailer.ts` — its own comment: "Errors never carry the
response body or the message text: both echo personal data." Whatever the
poller logs or alerts on should identify what failed with a coded string
(`gmail_history_404`, `gmail_refresh_rejected`, `rpc_upsert_failed`, or
similar), never what a message said or who it was between. Treat the VPS's
own logs and monitoring as no more private than a CI log — because for this
data, they are read by more people than the CRM itself is.

## 8. Setting `status`

When Google rejects a refresh token outright — an `invalid_grant` response at
step 1 of the poll loop, meaning the operator revoked access, changed their
password, or the token lapsed from disuse — set the account's `status` to
`reauth_required`. That is what lets `mail_account_status()` and the inbox UI
tell an operator the mailbox needs attention, instead of silently continuing
to serve whatever synced last, which is the same class of failure as section
5's expired cursor except with no backfill available: an invalid refresh
token cannot be exchanged for anything, bounded window or not, so there is
nothing to retry into. Reconnecting the mailbox through the flow in section 2
is the only way out of `reauth_required`.

**No function in this schema can make that write.** `mail_account_set_history_id`
is the only agent-half function that touches `mail_accounts`, and it writes
exactly one column (`history_id`) of a row that already exists. Setting
`status` is a write outside all four grants in section 3 — the same shape of
gap as the account insert in section 2, and it has the same consequence: as
things stand, only a credential that bypasses RLS on the table directly (the
service-role key) can make this change, not the `crm_agent` / `agent_sami`
password the poll loop uses. Until a function such as
`mail_account_set_status(p_account_id uuid, p_status text)` is added and
granted the same way as the other four, this section describes the behaviour
the poller must eventually produce, not an RPC it can call today to produce
it.

## Known gaps in this contract

Collected here so they are not lost inside the sections above:

- **No RPC creates a `mail_accounts` row** (section 2). The connect flow needs
  the service-role key or a new function; none of the four sync grants reach
  this table's `insert`.
- **No RPC sets `mail_accounts.status`** (section 8). Same shape of gap,
  same consequence: today, only the service-role key can flip an account to
  `reauth_required`.
- **`mail_account_for_sync()` returns up to five rows**, not one. Phase 1's
  single-mailbox precondition (section 2) is what keeps that at one in
  practice; the function itself does not enforce it.
- **`mail_inbox_list` and `mail_account_status()` both assume a single
  account** (section 2). Neither filters by account, so a second connected
  mailbox would merge into the first one's inbox and status without either
  side reporting an error.
