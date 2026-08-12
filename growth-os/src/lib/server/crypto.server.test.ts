import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  decryptField,
  encryptField,
  lookupHash,
  normalizeEmail,
  normalizePhone,
} from "./crypto.server";

const FIELD_KEY = Buffer.alloc(32, 7).toString("base64");
const OTHER_FIELD_KEY = Buffer.alloc(32, 9).toString("base64");
const LOOKUP_KEY = Buffer.alloc(32, 11).toString("base64");

describe("field encryption", () => {
  beforeEach(() => {
    process.env.FIELD_ENCRYPTION_KEY_V1 = FIELD_KEY;
    process.env.LOOKUP_HMAC_KEY_V1 = LOOKUP_KEY;
  });

  afterEach(() => {
    delete process.env.FIELD_ENCRYPTION_KEY_V1;
    delete process.env.LOOKUP_HMAC_KEY_V1;
  });

  it("round trips a lead field with a fresh 12-byte IV", () => {
    const first = encryptField("lead@example.com", "lead");
    const second = encryptField("lead@example.com", "lead");

    expect(first).toMatch(/^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$/);
    expect(second).not.toBe(first);
    expect(decryptField(first, "lead")).toBe("lead@example.com");
    expect(decryptField(second, "lead")).toBe("lead@example.com");
  });

  it("separates lead and connector purposes", () => {
    const envelope = encryptField("shared plaintext", "lead");

    expect(() => decryptField(envelope, "connector")).toThrowError(
      expect.objectContaining({ code: "DECRYPTION_FAILED" }),
    );
  });

  it("rejects a tampered authenticated envelope", () => {
    const envelope = encryptField("private notes", "lead");
    const [version, iv, ciphertext] = envelope.split(".");
    const changed = ciphertext!.endsWith("A") ? "B" : "A";
    const tampered = `${version}.${iv}.${ciphertext!.slice(0, -1)}${changed}`;

    expect(() => decryptField(tampered, "lead")).toThrowError(
      expect.objectContaining({ code: "DECRYPTION_FAILED" }),
    );
  });

  it("reads encryption keys at call time", () => {
    const envelope = encryptField("rotate me", "lead");
    process.env.FIELD_ENCRYPTION_KEY_V1 = OTHER_FIELD_KEY;

    expect(() => decryptField(envelope, "lead")).toThrowError(
      expect.objectContaining({ code: "DECRYPTION_FAILED" }),
    );

    process.env.FIELD_ENCRYPTION_KEY_V1 = FIELD_KEY;
    expect(decryptField(envelope, "lead")).toBe("rotate me");
  });
});

describe("lookup hashes", () => {
  beforeEach(() => {
    process.env.LOOKUP_HMAC_KEY_V1 = LOOKUP_KEY;
  });

  afterEach(() => {
    delete process.env.LOOKUP_HMAC_KEY_V1;
  });

  it("normalizes email and phone values without weakening purpose separation", () => {
    expect(normalizeEmail("  Lead@Example.COM ")).toBe("lead@example.com");
    expect(normalizePhone(" +1 (212) 555-0100 ")).toBe("+12125550100");
    expect(lookupHash("  Lead@Example.COM ", "email")).toBe(
      lookupHash("lead@example.com", "email"),
    );
    expect(lookupHash("lead@example.com", "email")).not.toBe(
      lookupHash("lead@example.com", "phone"),
    );
  });
});
