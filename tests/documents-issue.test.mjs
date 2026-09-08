// The feature's central evidentiary claim: editing a document after sending
// it for signature cannot retroactively change what was signed. That is only
// true if the document's hash is COPIED onto the signature row at send time.
// This file is the test of that copy, and of the drafting/finalising guards
// that feed it.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  draftDocument,
  finaliseDraft,
  requestSignature,
  signatureIsStale,
} from "../src/server/documents/issue.ts";

const doc = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

/** Records what it was given rather than persisting anything, so a test can
 *  assert on the exact shape a real store would receive. */
function fakeStore({ refuse = false } = {}) {
  const documents = [];
  const bodyUpdates = [];
  const signatureRequests = [];
  let nextDocId = 1;
  let nextSigId = 1;

  return {
    documents,
    bodyUpdates,
    signatureRequests,
    async createDocument(input) {
      const id = `doc-${nextDocId++}`;
      documents.push({ id, ...input });
      return id;
    },
    async updateDocumentBody(input) {
      bodyUpdates.push(input);
    },
    async createSignatureRequest(input) {
      // `refuse` is the RPC declining because the document moved on since the
      // caller read it: nothing is written, and null comes back.
      if (refuse) return null;
      const id = `sig-${nextSigId++}`;
      const signingToken = `token-${id}`;
      signatureRequests.push(input);
      return { id, signingToken };
    },
  };
}

const draftInput = (overrides = {}) => ({
  templateBody: "Client: [CLIENT LEGAL NAME]. Fee: [AMOUNT].",
  data: { "CLIENT LEGAL NAME": "Acme LLC" },
  dealId: "deal-1",
  projectId: null,
  stageNumber: 2,
  docType: "sow",
  title: "SOW — Acme LLC",
  templateId: "sow-v1",
  ownerId: "owner-1",
  ...overrides,
});

// --- draftDocument -----------------------------------------------------

test("drafting allows unfilled placeholders and stores status-appropriate content", async () => {
  const store = fakeStore();
  const result = await draftDocument(store, draftInput());

  assert.equal(result.ok, true);
  assert.ok(result.ok);
  assert.equal(result.body, "Client: Acme LLC. Fee: [AMOUNT].");
  assert.equal(store.documents.length, 1);
  assert.equal(store.documents[0].body, "Client: Acme LLC. Fee: [AMOUNT].");
  assert.equal(store.documents[0].id, result.documentId);
});

test("drafting refuses a body with [REVIEW], and stores nothing", async () => {
  const store = fakeStore();
  const result = await draftDocument(
    store,
    draftInput({ templateBody: "Indemnity [REVIEW] applies." }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.reason, "unresolved-review");
  assert.equal(store.documents.length, 0, "nothing may be stored on refusal");
});

test("drafting refuses the real docs/contracts/sow-template.md read from disk", async () => {
  const store = fakeStore();
  const templateBody = doc("docs/contracts/sow-template.md");
  const result = await draftDocument(store, draftInput({ templateBody, data: {} }));

  assert.equal(result.ok, false, "the real SOW carries the DRAFT banner and must be refused");
  assert.equal(result.ok === false && result.reason, "unresolved-review");
  assert.equal(store.documents.length, 0);
});

test("drafting stores a 64-char hash matching the returned one", async () => {
  const store = fakeStore();
  const result = await draftDocument(store, draftInput());

  assert.equal(result.ok, true);
  assert.ok(result.ok);
  assert.equal(result.bodyHash.length, 64);
  assert.match(result.bodyHash, /^[0-9a-f]{64}$/);
  assert.equal(store.documents[0].bodyHash, result.bodyHash);
});

// --- finaliseDraft -------------------------------------------------------

test("finalising refuses a body with placeholders remaining, naming them, and writes nothing", async () => {
  const store = fakeStore();
  const result = await finaliseDraft(store, {
    documentId: "doc-1",
    body: "Client: Acme LLC. Fee: [AMOUNT].",
  });

  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.reason, "unfilled-placeholders");
  assert.deepEqual(result.ok === false && result.placeholders, ["AMOUNT"]);
  assert.equal(store.bodyUpdates.length, 0, "nothing may be written on refusal");
});

test("finalising refuses a body someone pasted [REVIEW] into", async () => {
  const store = fakeStore();
  const result = await finaliseDraft(store, {
    documentId: "doc-1",
    body: "Client: Acme LLC. Fee: $500. [REVIEW] this clause.",
  });

  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.reason, "unresolved-review");
  assert.equal(store.bodyUpdates.length, 0);
});

test("finalising a complete body re-hashes, marks it final, and returns the new hash", async () => {
  const store = fakeStore();
  const body = "Client: Acme LLC. Fee: $500.";
  const result = await finaliseDraft(store, { documentId: "doc-1", body });

  assert.equal(result.ok, true);
  assert.ok(result.ok);
  assert.match(result.bodyHash, /^[0-9a-f]{64}$/);
  assert.equal(store.bodyUpdates.length, 1);
  assert.equal(store.bodyUpdates[0].id, "doc-1");
  assert.equal(store.bodyUpdates[0].body, body);
  assert.equal(store.bodyUpdates[0].bodyHash, result.bodyHash);
  assert.equal(store.bodyUpdates[0].status, "final");
});

test("editing changes the hash — two different bodies produce different hashes", async () => {
  const store = fakeStore();
  const r1 = await finaliseDraft(store, {
    documentId: "doc-1",
    body: "Client: Acme LLC. Fee: $500.",
  });
  const r2 = await finaliseDraft(store, {
    documentId: "doc-1",
    body: "Client: Acme LLC. Fee: $600.",
  });

  assert.ok(r1.ok && r2.ok);
  assert.notEqual(r1.bodyHash, r2.bodyHash);
});

// --- requestSignature: the hash copy is the entire point of this task ----

test("requestSignature raises one request against the document it was given", async () => {
  const store = fakeStore();

  await requestSignature(store, {
    documentId: "doc-1",
    bodyHash: "a".repeat(64),
    recipientName: "Ada Lovelace",
    recipientEmail: "ada@example.com",
    sentBy: "owner-1",
  });

  assert.equal(store.signatureRequests.length, 1);
  assert.equal(store.signatureRequests[0].documentId, "doc-1");
  assert.equal(store.signatureRequests[0].recipientEmail, "ada@example.com");
});

test("requestSignature returns what createSignatureRequest returns", async () => {
  const store = fakeStore();
  const result = await requestSignature(store, {
    documentId: "doc-1",
    bodyHash: "b".repeat(64),
    recipientName: "Ada Lovelace",
    recipientEmail: "ada@example.com",
    sentBy: null,
  });

  assert.equal(result.id, "sig-1");
  assert.equal(result.signingToken, "token-sig-1");
});

// --- signatureIsStale ------------------------------------------------------

test("signatureIsStale is false when the document hash and signature hash match", () => {
  assert.equal(signatureIsStale({ bodyHash: "same-hash" }, { documentHash: "same-hash" }), false);
});

test("signatureIsStale is true when the document has been edited since the signature was sent", () => {
  assert.equal(
    signatureIsStale({ bodyHash: "new-hash-after-edit" }, { documentHash: "old-hash-at-send" }),
    true,
  );
});

test("requestSignature passes the caller hash as a PRECONDITION, not as the stored evidence", async () => {
  // What gets stored is read off the documents row by the RPC. All this
  // layer supplies is what it BELIEVES the document hashes to, so the
  // database can refuse if the document has moved on. A caller that could
  // name the stored hash could name evidence that never existed.
  const store = fakeStore();
  await requestSignature(store, {
    documentId: "doc-1",
    bodyHash: "c".repeat(64),
    recipientName: "Ada Lovelace",
    recipientEmail: "ada@example.com",
    sentBy: "owner-1",
  });

  const sent = store.signatureRequests[0];
  assert.equal(sent.expectedHash, "c".repeat(64));
  assert.ok(
    !("documentHash" in sent),
    "the caller must not be able to dictate the hash stored on the signature",
  );
  assert.ok(
    !("signedBody" in sent) && !("body" in sent),
    "nor the bytes - the RPC snapshots those from the document itself",
  );
});

test("requestSignature propagates the database refusal instead of inventing a request", async () => {
  // The RPC writes nothing and answers null when the document has been
  // edited since this caller read it. Reporting a signature request that does
  // not exist would leave a contract looking sent and unsigned forever.
  const store = fakeStore({ refuse: true });
  const result = await requestSignature(store, {
    documentId: "doc-1",
    bodyHash: "stale",
    recipientName: "Ada Lovelace",
    recipientEmail: "ada@example.com",
    sentBy: null,
  });

  assert.equal(result, null);
  assert.equal(store.signatureRequests.length, 0);
});
