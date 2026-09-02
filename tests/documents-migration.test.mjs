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

test("every document RPC is service_role only, like the rest of this schema", () => {
  for (const fn of [
    "document_create",
    "document_update_body",
    "document_request_signature",
    "document_find_by_token",
    "document_mark_viewed",
    "document_mark_signed",
    "deal_has_signed_sow",
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
  assert.equal(definers.length, 7);
  assert.equal(paths.length, 7);
});
