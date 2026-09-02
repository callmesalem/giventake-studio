import test from "node:test";
import assert from "node:assert/strict";
import { canSign, validateSignatureInput } from "../src/server/documents/signing.ts";

const base = { status: "pending", expiresAt: "2999-01-01T00:00:00Z" };
const now = new Date("2026-09-02T00:00:00Z");

// --- canSign: status allowlist --------------------------------------------

test("a pending, unexpired request may be signed", () => {
  assert.equal(canSign(base, now).ok, true);
});

test("a viewed request may still be signed", () => {
  assert.equal(canSign({ ...base, status: "viewed" }, now).ok, true);
});

test("an already-signed request may not be signed twice", () => {
  const r = canSign({ ...base, status: "signed" }, now);
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "already-signed");
});

test("a declined request may not be signed", () => {
  const r = canSign({ ...base, status: "declined" }, now);
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "declined");
});

test("an expired STATUS may not be signed, whatever the expiry date says", () => {
  const r = canSign({ ...base, status: "expired" }, now);
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "not-signable");
});

test("a revoked status may not be signed", () => {
  const r = canSign({ ...base, status: "revoked" }, now);
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "not-signable");
});

test("only pending and viewed are signable — everything else refuses", () => {
  const unknownStatuses = [
    "",
    "PENDING",
    "Pending",
    "draft",
    "void",
    "cancelled",
    "signed ",
    "unknown",
  ];
  for (const status of unknownStatuses) {
    const r = canSign({ ...base, status }, now);
    assert.equal(r.ok, false, `status ${JSON.stringify(status)} must refuse`);
    assert.equal(r.ok === false && r.reason, "not-signable");
  }
});

test("a missing or non-string status refuses rather than throwing", () => {
  for (const status of [undefined, null, 0, {}]) {
    const r = canSign({ ...base, status }, now);
    assert.equal(r.ok, false, `status ${String(status)} must refuse`);
  }
});

// --- canSign: expiry must parse -------------------------------------------

test("an expired request may not be signed", () => {
  const r = canSign({ status: "pending", expiresAt: "2026-09-01T00:00:00Z" }, now);
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "expired");
});

test("expiry at the exact instant refuses — the boundary is <=, not <", () => {
  const r = canSign({ status: "pending", expiresAt: now.toISOString() }, now);
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "expired");
});

test("one millisecond after the expiry instant is still signable", () => {
  const r = canSign(
    { status: "pending", expiresAt: new Date(now.getTime() + 1).toISOString() },
    now,
  );
  assert.equal(r.ok, true);
});

test("an unparseable expiry refuses instead of being skipped", () => {
  for (const expiresAt of ["never", "", "   ", "soon", "2026-13-45", undefined, null, "NaN"]) {
    const r = canSign({ status: "pending", expiresAt }, now);
    assert.equal(r.ok, false, `expiresAt ${JSON.stringify(expiresAt)} must refuse`);
    assert.equal(
      r.ok === false && r.reason,
      "invalid-expiry",
      `expiresAt ${JSON.stringify(expiresAt)} reason`,
    );
  }
});

test("status is judged before expiry, so a signed request still reads already-signed", () => {
  const r = canSign({ status: "signed", expiresAt: "never" }, now);
  assert.equal(r.ok === false && r.reason, "already-signed");
});

// --- validateSignatureInput ------------------------------------------------

test("signing requires consent", () => {
  const r = validateSignatureInput({ typedName: "Ada Lovelace", consent: false });
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "no-consent");
});

test("consent must be exactly true — a truthy string is not consent", () => {
  for (const consent of ["false", "true", 1, "on", {}, [], "yes"]) {
    const r = validateSignatureInput({ typedName: "Ada Lovelace", consent });
    assert.equal(r.ok, false, `consent ${JSON.stringify(consent)} must refuse`);
    assert.equal(r.ok === false && r.reason, "no-consent");
  }
});

test("missing consent refuses", () => {
  assert.equal(validateSignatureInput({ typedName: "Ada Lovelace" }).ok, false);
});

test("consent is checked before the name", () => {
  // Under ESIGN/UETA an unticked box means no signature happened at all; that
  // is the message the signer must see, not a complaint about the name field.
  const r = validateSignatureInput({ typedName: "", consent: false });
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "no-consent");
});

test("signing requires a non-empty typed name", () => {
  const r = validateSignatureInput({ typedName: "   ", consent: true });
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "no-name");
});

test("a missing or non-string typed name refuses rather than throwing", () => {
  for (const typedName of [undefined, null, 42, {}, [], true]) {
    const r = validateSignatureInput({ typedName, consent: true });
    assert.equal(r.ok, false, `typedName ${String(typedName)} must refuse`);
    assert.equal(r.ok === false && r.reason, "no-name");
  }
});

test("invisible characters are not a signature", () => {
  const invisible = {
    "zero-width space": "\u200B",
    "zero-width non-joiner": "\u200C",
    "zero-width joiner": "\u200D",
    "left-to-right mark": "\u200E",
    "soft hyphen": "\u00AD",
    "word joiner": "\u2060",
    "byte order mark": "\uFEFF",
    "null control": "\u0000",
    "braille blank": "\u2800",
    combined: " \u200B\u00AD\u200E ",
  };
  for (const [label, typedName] of Object.entries(invisible)) {
    const r = validateSignatureInput({ typedName, consent: true });
    assert.equal(r.ok, false, `${label} must refuse`);
    assert.equal(r.ok === false && r.reason, "no-name", `${label} reason`);
  }
});

test("punctuation alone is not a signature — a letter or number is required", () => {
  for (const typedName of [".", "---", "***", "§ §"]) {
    const r = validateSignatureInput({ typedName, consent: true });
    assert.equal(r.ok, false, `${typedName} must refuse`);
  }
});

test("a name longer than 200 characters refuses", () => {
  assert.equal(validateSignatureInput({ typedName: "a".repeat(201), consent: true }).ok, false);
  assert.equal(validateSignatureInput({ typedName: "a".repeat(200), consent: true }).ok, true);
});

test("a valid input is accepted and the name is trimmed", () => {
  const r = validateSignatureInput({ typedName: "  Ada Lovelace  ", consent: true });
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.typedName, "Ada Lovelace");
});

test("the returned name is cleaned of invisible characters", () => {
  const r = validateSignatureInput({ typedName: "Ada\u200BLovelace\u00AD", consent: true });
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.typedName, "AdaLovelace");
});

test("non-ASCII names are accepted", () => {
  for (const typedName of ["Zoë Fürst", "李雷", "Владимир", "أحمد"]) {
    const r = validateSignatureInput({ typedName, consent: true });
    assert.equal(r.ok, true, `${typedName} must be accepted`);
    assert.equal(r.ok && r.typedName, typedName);
  }
});
