import "@tanstack/react-start/server-only";
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";

export type CryptoPurpose = "lead" | "connector";
export type LookupPurpose = "email" | "phone";

const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

export class FieldCryptoError extends Error {
  constructor(public readonly code: "CRYPTO_NOT_CONFIGURED" | "DECRYPTION_FAILED") {
    super(code);
    this.name = "FieldCryptoError";
  }
}

function readBase64Key(variable: "FIELD_ENCRYPTION_KEY_V1" | "LOOKUP_HMAC_KEY_V1"): Buffer {
  const encoded = process.env[variable]?.trim();
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 !== 0) {
    throw new FieldCryptoError("CRYPTO_NOT_CONFIGURED");
  }

  const key = Buffer.from(encoded, "base64");
  if (key.length !== KEY_BYTES || key.toString("base64") !== encoded) {
    throw new FieldCryptoError("CRYPTO_NOT_CONFIGURED");
  }
  return key;
}

function deriveFieldKey(purpose: CryptoPurpose): Buffer {
  const baseKey = readBase64Key("FIELD_ENCRYPTION_KEY_V1");
  return Buffer.from(
    hkdfSync(
      "sha256",
      baseKey,
      Buffer.from("giventake-growth-os-field-v1", "utf8"),
      Buffer.from(`field:${purpose}`, "utf8"),
      KEY_BYTES,
    ),
  );
}

function additionalData(purpose: CryptoPurpose) {
  return Buffer.from(`giventake-growth-os:${VERSION}:${purpose}`, "utf8");
}

export function encryptField(plaintext: string, purpose: CryptoPurpose): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", deriveFieldKey(purpose), iv);
  cipher.setAAD(additionalData(purpose));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const ciphertextAndTag = Buffer.concat([ciphertext, cipher.getAuthTag()]);
  return `${VERSION}.${iv.toString("base64url")}.${ciphertextAndTag.toString("base64url")}`;
}

export function decryptField(envelope: string, purpose: CryptoPurpose): string {
  try {
    const parts = envelope.split(".");
    if (parts.length !== 3 || parts[0] !== VERSION) {
      throw new Error("invalid envelope");
    }

    const iv = Buffer.from(parts[1]!, "base64url");
    const ciphertextAndTag = Buffer.from(parts[2]!, "base64url");
    if (iv.length !== IV_BYTES || ciphertextAndTag.length <= TAG_BYTES) {
      throw new Error("invalid envelope");
    }

    const ciphertext = ciphertextAndTag.subarray(0, -TAG_BYTES);
    const tag = ciphertextAndTag.subarray(-TAG_BYTES);
    const decipher = createDecipheriv("aes-256-gcm", deriveFieldKey(purpose), iv);
    decipher.setAAD(additionalData(purpose));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch (error) {
    if (error instanceof FieldCryptoError && error.code === "CRYPTO_NOT_CONFIGURED") throw error;
    throw new FieldCryptoError("DECRYPTION_FAILED");
  }
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizePhone(value: string) {
  return value.replace(/[^0-9+]/g, "");
}

export function lookupHash(value: string, purpose: LookupPurpose): string {
  const normalized = purpose === "email" ? normalizeEmail(value) : normalizePhone(value);
  return createHmac("sha256", readBase64Key("LOOKUP_HMAC_KEY_V1"))
    .update(`lookup:${VERSION}:${purpose}\n${normalized}`, "utf8")
    .digest("hex");
}
