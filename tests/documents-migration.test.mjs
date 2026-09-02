import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/migrations/20260902120000_documents_esignature.sql", "utf8");

test("both tables are created idempotently", () => {
  assert.match(sql, /create table if not exists public\.documents/);
  assert.match(sql, /create table if not exists public\.document_signatures/);
});

test("a document must belong to a deal or a project", () => {
  assert.match(sql, /check \(\s*deal_id is not null or project_id is not null\s*\)/);
});

test("stage_number is nullable because the MSA is not stage-specific", () => {
  assert.doesNotMatch(sql, /stage_number\s+integer\s+not null/);
});

test("the signature row carries its own copy of the hash", () => {
  assert.match(sql, /document_hash\s+text\s+not null/);
});

test("the signing token is unique and indexed", () => {
  assert.match(sql, /create unique index if not exists document_signatures_token_uidx/);
});

test("signatures expire", () => {
  assert.match(sql, /expires_at/);
});

test("the gate function exists", () => {
  assert.match(sql, /create or replace function public\.deal_has_signed_sow/);
});

test("tables carry the repo's synthetic convention", () => {
  assert.match(sql, /synthetic boolean/);
});

// --- the RPC surface -------------------------------------------------------
//
// RLS is on for both tables with no policies, so a definer function is the ONLY
// way in. Each assertion below is therefore load-bearing: a missing function is
// not a missing convenience, it is a table nothing can reach.

test("document_create exists and hands back the new id", () => {
  assert.match(sql, /create or replace function public\.document_create\b/i);
  assert.match(sql, /create or replace function public\.document_create\b[\s\S]*?returns uuid/i);
});

test("document_update_body exists", () => {
  assert.match(sql, /create or replace function public\.document_update_body\b/i);
});

test("a body edit may only land a document in draft or final, never superseded", () => {
  // Superseding is a different operation with different consequences. Letting
  // the edit path set it would let a routine save retire a document silently.
  const fn = sql.slice(sql.search(/create or replace function public\.document_update_body\b/i));
  assert.match(fn, /p_status not in \('draft', 'final'\)/i);
});

test("document_request_signature exists and returns the id with the token", () => {
  assert.match(sql, /create or replace function public\.document_request_signature\b/i);
  assert.match(sql, /jsonb_build_object\(\s*'id', v_id,\s*'signing_token', v_token\s*\)/i);
});

test("document_find_by_token exists and joins the signature to its document", () => {
  assert.match(sql, /create or replace function public\.document_find_by_token\b/i);
  const fn = sql.slice(sql.search(/create or replace function public\.document_find_by_token\b/i));
  assert.match(fn, /join documents d on d\.id = s\.document_id/i);
  for (const key of [
    "id",
    "document_id",
    "recipient_name",
    "recipient_email",
    "signing_token",
    "status",
    "expires_at",
    "signed_at",
    "signed_name",
    "document_hash",
    "title",
    "body",
  ]) {
    assert.match(fn, new RegExp(`'${key}',`), `document_find_by_token omits ${key}`);
  }
});

test("document_mark_viewed exists and cannot regress a later state", () => {
  // A mail scanner fetching the link after signing must not rewrite the row
  // back to 'viewed'. The guard belongs here, not in the caller.
  assert.match(sql, /create or replace function public\.document_mark_viewed\b/i);
  const fn = sql.slice(sql.search(/create or replace function public\.document_mark_viewed\b/i));
  assert.match(fn, /and status = 'pending'/i);
});

test("document_mark_signed exists, guards the status, and reports whether it wrote", () => {
  // The boolean IS the replay guard. A resubmitted POST must not overwrite an
  // existing signature, and the caller has to be able to tell that it did not.
  assert.match(sql, /create or replace function public\.document_mark_signed\b/i);
  const fn = sql.slice(sql.search(/create or replace function public\.document_mark_signed\b/i));
  assert.match(fn, /returns boolean/i);
  assert.match(fn, /and status in \('pending', 'viewed'\)/i);
  assert.match(fn, /get diagnostics/i);
});

test("document_list_for_deal exists and carries the signatures with their documents", () => {
  // The deal page renders a document and its signatures together. Two calls
  // could straddle a send and show a document beside a signature raised against
  // a different version of it, which is the exact confusion the hash snapshot
  // exists to make visible.
  assert.match(sql, /create or replace function public\.document_list_for_deal\b/i);
  const fn = sql.slice(sql.search(/create or replace function public\.document_list_for_deal\b/i));
  assert.match(fn, /where d\.deal_id = p_deal_id/i);
  assert.match(fn, /from document_signatures sg/i);
  // Both halves of the staleness comparison have to travel or the warning
  // cannot be computed at all.
  assert.match(fn, /'body_hash', d\.body_hash/i);
  assert.match(fn, /'document_hash', sg\.document_hash/i);
});

test("the operator listing never hands out a signing token", () => {
  // signing_token is a bearer credential: whoever holds it can sign the
  // client's contract. document_find_by_token is the ONLY function allowed to
  // return one, and it does so to the public sign page, which already has the
  // token in its URL. An operator listing has no use for it and every reason
  // not to carry it into a browser, a log, or a screenshot.
  const fn = sql.slice(sql.search(/create or replace function public\.document_list_for_deal\b/i));
  assert.doesNotMatch(fn, /signing_token/i);
});

test("the deposit condition is a separate function, so it cannot be mistaken for the gate", () => {
  // Stage 4's gate asserts the SIGNATURE only. Payment is surfaced to a human
  // and never refuses an advance, because invoices.paid_at depends on Stripe
  // reconciliation this system does not own end to end.
  assert.match(sql, /create or replace function public\.deal_deposit_paid\b/i);
  const fn = sql.slice(sql.search(/create or replace function public\.deal_deposit_paid\b/i));
  assert.match(fn, /returns boolean/i);
  assert.match(fn, /i\.paid_at is not null/i);
  // Either link from an invoice to a deal is evidence; both exist in the schema.
  assert.match(fn, /i\.source_deal_id = p_deal_id/i);
  assert.match(fn, /p\.deal_id = p_deal_id/i);
  // Fixture money is not payment.
  assert.match(fn, /not coalesce\(i\.synthetic, false\)/i);
});

test("the gate function does not consult payment", () => {
  // If deal_has_signed_sow ever grew a paid_at clause, a late Stripe webhook
  // would start blocking work that is genuinely signed. That is the failure
  // advanceBlockedByUnsignedSow was written to design out.
  const start = sql.search(/create or replace function public\.deal_has_signed_sow\b/i);
  const fn = sql.slice(start, sql.indexOf("$$;", start));
  assert.doesNotMatch(fn, /paid_at|invoices/i);
});

test("every document RPC is service_role only, like the rest of this schema", () => {
  for (const fn of [
    "document_create",
    "document_update_body",
    "document_request_signature",
    "document_find_by_token",
    "document_mark_viewed",
    "document_mark_signed",
    "document_list_for_deal",
    "deal_has_signed_sow",
    "deal_deposit_paid",
  ]) {
    const signature = String.raw`public\.${fn}\([^)]*\)`;
    assert.match(
      sql,
      new RegExp(String.raw`revoke all on function ${signature} from public`, "i"),
      `${fn} is not revoked from public`,
    );
    assert.match(
      sql,
      new RegExp(String.raw`grant execute on function ${signature} to service_role`, "i"),
      `${fn} is not granted to service_role`,
    );
  }
});

test("every document RPC is a definer function pinned to a safe search_path", () => {
  // Line-anchored so prose in the comments cannot be mistaken for a declaration.
  const definers = sql.match(/^security definer$/gim) ?? [];
  const paths = sql.match(/^set search_path = public, pg_temp$/gim) ?? [];
  assert.equal(definers.length, 9);
  assert.equal(paths.length, 9);
});
