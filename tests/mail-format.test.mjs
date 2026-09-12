// The inbox list's small decisions, made testable. Each of these renders on
// every row, so a wrong answer is wrong hundreds of times on one screen.
import test from "node:test";
import assert from "node:assert/strict";
import { senderLabel, relativeTime, threadTitle } from "../src/lib/mail-format.ts";

const ME = "build@giventakedevs.com";

test("the sender label names the other party, not us", () => {
  // A row reading "build@giventakedevs.com" on every line tells the reader
  // nothing. The useful name is whoever else is on the thread.
  assert.equal(senderLabel([ME, "ana@trattorianino.com"], ME), "ana@trattorianino.com");
  assert.equal(senderLabel(["ana@trattorianino.com", ME], ME), "ana@trattorianino.com");
});

test("the sender label is case-insensitive about our own address", () => {
  assert.equal(senderLabel(["Build@GivenTakeDevs.com", "ana@x.com"], ME), "ana@x.com");
});

test("a thread with several other people names them all", () => {
  assert.equal(senderLabel([ME, "a@x.com", "b@x.com"], ME), "a@x.com, b@x.com");
});

test("a thread with only us falls back to our own address", () => {
  // A note to self is rare but real, and an empty sender column is a bug.
  assert.equal(senderLabel([ME], ME), ME);
});

test("an empty participant list does not render blank", () => {
  assert.equal(senderLabel([], ME), "Unknown sender");
});

test("relative time is short enough for a dense row", () => {
  const now = new Date("2026-09-12T12:00:00Z");
  assert.equal(relativeTime("2026-09-12T11:59:10Z", now), "now");
  assert.equal(relativeTime("2026-09-12T11:30:00Z", now), "30m");
  assert.equal(relativeTime("2026-09-12T08:00:00Z", now), "4h");
  assert.equal(relativeTime("2026-09-10T12:00:00Z", now), "2d");
  assert.equal(relativeTime("2026-06-12T12:00:00Z", now), "12 Jun");
});

test("a missing timestamp renders a dash, never Invalid Date", () => {
  assert.equal(relativeTime(null), "—");
});

test("an empty subject gets a readable stand-in", () => {
  assert.equal(threadTitle(null), "No subject");
  assert.equal(threadTitle("   "), "No subject");
  assert.equal(threadTitle("Quote for the patio"), "Quote for the patio");
});
