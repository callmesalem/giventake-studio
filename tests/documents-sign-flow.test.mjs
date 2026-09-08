// The public signing route's handlers cannot be unit-tested comfortably, so the
// decisions live here instead - exactly as supabase/functions/_shared/channel-auth.ts
// did for the Sami MCP function. The property this file exists to prove:
// viewing a document must never sign it. Mail clients and security scanners
// prefetch links; a prefetched signature would be far worse than a prefetched
// unsubscribe.
import test from "node:test";
import assert from "node:assert/strict";
import {
  CONSENT_TEXT,
  viewSigningRequest,
  performSignature,
} from "../src/server/documents/sign-flow.ts";

const now = new Date("2026-09-02T00:00:00Z");

const baseRow = {
  id: "sig-1",
  documentId: "doc-1",
  recipientName: "Ada Lovelace",
  recipientEmail: "ada@example.com",
  signingToken: "tok-abc",
  status: "pending",
  expiresAt: "2999-01-01T00:00:00Z",
  signedAt: null,
  signedName: null,
  documentHash: "h1",
  title: "SOW",
  body: "# SOW",
};

/** A fake DocumentStore restricted to the three methods sign-flow.ts uses,
 *  counting calls so "never calls markSigned" is an assertion, not a hope. */
function makeStore(overrides = {}) {
  const calls = { findByToken: 0, markViewed: 0, markSigned: 0 };
  const markSignedInputs = [];
  const store = {
    async findByToken(token) {
      calls.findByToken++;
      return overrides.findByToken ? overrides.findByToken(token) : null;
    },
    async markViewed(id) {
      calls.markViewed++;
      if (overrides.markViewed) return overrides.markViewed(id);
    },
    async markSigned(input) {
      calls.markSigned++;
      markSignedInputs.push(input);
      return overrides.markSigned ? overrides.markSigned(input) : true;
    },
  };
  return { store, calls, markSignedInputs };
}

// --- viewSigningRequest: the central safety claim --------------------------

test("viewing never calls markSigned", async () => {
  const { store, calls } = makeStore({ findByToken: async () => baseRow });
  await viewSigningRequest(store, "tok-abc", now);
  assert.equal(calls.markSigned, 0);
});

test("viewing an already-signed request never calls markSigned either", async () => {
  const { store, calls } = makeStore({
    findByToken: async () => ({ ...baseRow, status: "signed", signedAt: "2026-08-01T00:00:00Z" }),
  });
  await viewSigningRequest(store, "tok-abc", now);
  assert.equal(calls.markSigned, 0);
});

test("viewing marks viewed exactly once", async () => {
  const { store, calls } = makeStore({ findByToken: async () => baseRow });
  await viewSigningRequest(store, "tok-abc", now);
  assert.equal(calls.markViewed, 1);
});

test("viewing marks the row's own id, not the token", async () => {
  let seenId;
  const { store } = makeStore({
    findByToken: async () => baseRow,
    markViewed: async (id) => {
      seenId = id;
    },
  });
  await viewSigningRequest(store, "tok-abc", now);
  assert.equal(seenId, "sig-1");
});

test("viewing an expired request does not mark it viewed, and returns not-ok", async () => {
  const { store, calls } = makeStore({
    findByToken: async () => ({ ...baseRow, expiresAt: "2026-09-01T00:00:00Z" }),
  });
  const r = await viewSigningRequest(store, "tok-abc", now);
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "unavailable");
  assert.equal(calls.markViewed, 0);
});

test("viewing a request with an unsignable status does not mark it viewed", async () => {
  const { store, calls } = makeStore({
    findByToken: async () => ({ ...baseRow, status: "declined" }),
  });
  const r = await viewSigningRequest(store, "tok-abc", now);
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "unavailable");
  assert.equal(calls.markViewed, 0);
});

test("viewing a signed request returns already-signed and carries signedAt", async () => {
  const { store, calls } = makeStore({
    findByToken: async () => ({ ...baseRow, status: "signed", signedAt: "2026-08-01T00:00:00Z" }),
  });
  const r = await viewSigningRequest(store, "tok-abc", now);
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "already-signed");
  assert.equal(r.ok === false && r.signedAt, "2026-08-01T00:00:00Z");
  assert.equal(calls.markViewed, 0);
});

test("an unknown token returns not-found rather than throwing", async () => {
  const { store, calls } = makeStore({ findByToken: async () => null });
  const r = await viewSigningRequest(store, "nope", now);
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "not-found");
  assert.equal(calls.markViewed, 0);
  assert.equal(calls.markSigned, 0);
});

test("markViewed throwing does NOT fail the view - the contract still renders", async () => {
  const { store } = makeStore({
    findByToken: async () => baseRow,
    markViewed: async () => {
      throw new Error("db hiccup");
    },
  });
  const r = await viewSigningRequest(store, "tok-abc", now);
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.view.title, "SOW");
});

test("a valid view returns the document content, recipient, status and unexpired flag", async () => {
  const { store } = makeStore({ findByToken: async () => baseRow });
  const r = await viewSigningRequest(store, "tok-abc", now);
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.view.title, "SOW");
  assert.equal(r.ok && r.view.body, "# SOW");
  assert.equal(r.ok && r.view.recipientName, "Ada Lovelace");
  assert.equal(r.ok && r.view.status, "pending");
  assert.equal(r.ok && r.view.expired, false);
});

test("viewing looks up by the token it was given", async () => {
  let seenToken;
  const { store } = makeStore({
    findByToken: async (token) => {
      seenToken = token;
      return baseRow;
    },
  });
  await viewSigningRequest(store, "tok-abc", now);
  assert.equal(seenToken, "tok-abc");
});

// --- performSignature --------------------------------------------------------

test("signing without consent does not call markSigned", async () => {
  const { store, calls } = makeStore({ findByToken: async () => baseRow });
  const r = await performSignature(
    store,
    "tok-abc",
    { typedName: "Ada Lovelace", consent: false },
    now,
    { ip: "203.0.113.9", userAgent: "UA" },
  );
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "invalid-input");
  assert.equal(calls.markSigned, 0);
});

test("signing an expired request does not call markSigned", async () => {
  const { store, calls } = makeStore({
    findByToken: async () => ({ ...baseRow, expiresAt: "2026-09-01T00:00:00Z" }),
  });
  const r = await performSignature(
    store,
    "tok-abc",
    { typedName: "Ada Lovelace", consent: true },
    now,
    { ip: "203.0.113.9", userAgent: "UA" },
  );
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "unavailable");
  assert.equal(calls.markSigned, 0);
});

test("canSign is checked before input validation, so an expired request with no consent still reads unavailable", async () => {
  const { store } = makeStore({
    findByToken: async () => ({ ...baseRow, expiresAt: "2026-09-01T00:00:00Z" }),
  });
  const r = await performSignature(store, "tok-abc", { typedName: "", consent: false }, now, {
    ip: null,
    userAgent: null,
  });
  assert.equal(r.ok === false && r.reason, "unavailable");
});

test("signing an already-signed request reads unavailable from canSign, not already-signed", async () => {
  // performSignature only reports "already-signed" from markSigned's false -
  // the replay it could not detect ahead of time. A row that already reads
  // "signed" is caught earlier, by canSign, and reads "unavailable" instead.
  const { store, calls } = makeStore({
    findByToken: async () => ({ ...baseRow, status: "signed", signedAt: "2026-08-01T00:00:00Z" }),
  });
  const r = await performSignature(
    store,
    "tok-abc",
    { typedName: "Ada Lovelace", consent: true },
    now,
    { ip: null, userAgent: null },
  );
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "unavailable");
  assert.equal(calls.markSigned, 0);
});

test("an unknown token returns not-found rather than throwing, and never calls markSigned", async () => {
  const { store, calls } = makeStore({ findByToken: async () => null });
  const r = await performSignature(
    store,
    "nope",
    { typedName: "Ada Lovelace", consent: true },
    now,
    { ip: null, userAgent: null },
  );
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "not-found");
  assert.equal(calls.markSigned, 0);
});

test("markSigned resolving false yields already-signed, not ok - the replay case", async () => {
  const { store, calls } = makeStore({
    findByToken: async () => baseRow,
    markSigned: async () => false,
  });
  const r = await performSignature(
    store,
    "tok-abc",
    { typedName: "Ada Lovelace", consent: true },
    now,
    { ip: "203.0.113.9", userAgent: "UA" },
  );
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "already-signed");
  assert.equal(calls.markSigned, 1);
});

test("a valid signature records the trimmed name, CONSENT_TEXT verbatim, and the ip/user-agent", async () => {
  const { store, markSignedInputs } = makeStore({ findByToken: async () => baseRow });
  const r = await performSignature(
    store,
    "tok-abc",
    { typedName: "  Ada Lovelace  ", consent: true },
    now,
    { ip: "203.0.113.9", userAgent: "Mozilla/5.0" },
  );
  assert.equal(r.ok, true);
  assert.equal(markSignedInputs.length, 1);
  const input = markSignedInputs[0];
  assert.equal(input.id, "sig-1");
  assert.equal(input.signedName, "Ada Lovelace");
  assert.equal(input.consentText, CONSENT_TEXT);
  assert.equal(input.ip, "203.0.113.9");
  assert.equal(input.userAgent, "Mozilla/5.0");
});

test("the consent text stored is non-empty and is the exported constant", async () => {
  assert.equal(typeof CONSENT_TEXT, "string");
  assert.ok(CONSENT_TEXT.length > 0);
  const { store, markSignedInputs } = makeStore({ findByToken: async () => baseRow });
  await performSignature(store, "tok-abc", { typedName: "Ada", consent: true }, now, {
    ip: null,
    userAgent: null,
  });
  assert.equal(markSignedInputs[0].consentText, CONSENT_TEXT);
});

test("signing looks up by the token it was given", async () => {
  let seenToken;
  const { store } = makeStore({
    findByToken: async (token) => {
      seenToken = token;
      return baseRow;
    },
  });
  await performSignature(store, "tok-abc", { typedName: "Ada", consent: true }, now, {
    ip: null,
    userAgent: null,
  });
  assert.equal(seenToken, "tok-abc");
});
