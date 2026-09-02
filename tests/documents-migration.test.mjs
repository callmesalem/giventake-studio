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
