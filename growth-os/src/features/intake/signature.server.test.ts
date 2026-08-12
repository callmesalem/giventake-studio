import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyIngestSignature } from "./signature.server";

const SECRET = "test-signing-secret-with-32-bytes-minimum";
const IDEMPOTENCY_KEY = "7e9f26af-2501-4d7c-bd8f-9a3c56bc8bd4";
const NOW = new Date("2026-08-09T16:00:00.000Z");

function sign(body: string, timestamp: string, idempotencyKey = IDEMPOTENCY_KEY) {
  return `sha256=${createHmac("sha256", SECRET)
    .update(`${timestamp}\n${idempotencyKey}\n${body}`, "utf8")
    .digest("hex")}`;
}

function validInput(body = "{}", timestamp = NOW.toISOString()) {
  return {
    body,
    timestamp,
    idempotencyKey: IDEMPOTENCY_KEY,
    presentedSignature: sign(body, timestamp),
    secret: SECRET,
    now: NOW,
  };
}

describe("verifyIngestSignature", () => {
  it("verifies the exact timestamp, newline, UUID, newline, and raw body bytes", () => {
    const rawBody = '{\n  "schema_version": 1\n}\n';
    expect(() => verifyIngestSignature(validInput(rawBody))).not.toThrow();

    expect(() =>
      verifyIngestSignature({
        ...validInput(rawBody),
        body: JSON.stringify(JSON.parse(rawBody)),
      }),
    ).toThrowError(expect.objectContaining({ code: "SIGNATURE_INVALID" }));
  });

  it("accepts exactly five minutes of clock skew", () => {
    const timestamp = "2026-08-09T15:55:00.000Z";
    expect(() => verifyIngestSignature(validInput("{}", timestamp))).not.toThrow();
  });

  it("rejects a replay outside the five-minute window", () => {
    expect(() => verifyIngestSignature(validInput("{}", "2026-08-09T15:54:59.999Z"))).toThrowError(
      expect.objectContaining({ code: "SIGNATURE_EXPIRED" }),
    );
  });

  it("rejects future timestamps outside the five-minute window", () => {
    expect(() => verifyIngestSignature(validInput("{}", "2026-08-09T16:05:00.001Z"))).toThrowError(
      expect.objectContaining({ code: "SIGNATURE_EXPIRED" }),
    );
  });

  it("rejects malformed timestamps and idempotency UUIDs", () => {
    expect(() =>
      verifyIngestSignature({ ...validInput(), timestamp: "not-a-timestamp" }),
    ).toThrowError(expect.objectContaining({ code: "SIGNATURE_INVALID" }));
    expect(() =>
      verifyIngestSignature({ ...validInput(), idempotencyKey: "not-a-uuid" }),
    ).toThrowError(expect.objectContaining({ code: "SIGNATURE_INVALID" }));
  });

  it("rejects the wrong HMAC without accepting different-length values", () => {
    expect(() =>
      verifyIngestSignature({ ...validInput(), presentedSignature: "sha256=deadbeef" }),
    ).toThrowError(expect.objectContaining({ code: "SIGNATURE_INVALID" }));
  });

  it("enforces the 32 KiB limit in UTF-8 bytes", () => {
    const atLimit = "a".repeat(32_768);
    expect(() => verifyIngestSignature(validInput(atLimit))).not.toThrow();

    const overLimit = `${"a".repeat(32_767)}é`;
    expect(Buffer.byteLength(overLimit, "utf8")).toBe(32_769);
    expect(() => verifyIngestSignature(validInput(overLimit))).toThrowError(
      expect.objectContaining({ code: "PAYLOAD_TOO_LARGE" }),
    );
  });
});
