import "@tanstack/react-start/server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_BODY_BYTES = 32_768;
const MAX_SKEW_MS = 300_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const SIGNATURE_PATTERN = /^sha256=([0-9a-f]{64})$/i;

export type VerifySignatureInput = {
  body: string;
  timestamp: string;
  idempotencyKey: string;
  presentedSignature: string;
  secret: string;
  now: Date;
};

export type SignatureErrorCode = "PAYLOAD_TOO_LARGE" | "SIGNATURE_EXPIRED" | "SIGNATURE_INVALID";

export class IngestSignatureError extends Error {
  constructor(public readonly code: SignatureErrorCode) {
    super(code);
    this.name = "IngestSignatureError";
  }
}

export function verifyIngestSignature(input: VerifySignatureInput): void {
  if (Buffer.byteLength(input.body, "utf8") > MAX_BODY_BYTES) {
    throw new IngestSignatureError("PAYLOAD_TOO_LARGE");
  }

  if (
    !UUID_PATTERN.test(input.idempotencyKey) ||
    !ISO_TIMESTAMP_PATTERN.test(input.timestamp) ||
    Buffer.byteLength(input.secret, "utf8") < 32
  ) {
    throw new IngestSignatureError("SIGNATURE_INVALID");
  }

  const timestampMs = Date.parse(input.timestamp);
  if (!Number.isFinite(timestampMs)) {
    throw new IngestSignatureError("SIGNATURE_INVALID");
  }
  if (Math.abs(input.now.getTime() - timestampMs) > MAX_SKEW_MS) {
    throw new IngestSignatureError("SIGNATURE_EXPIRED");
  }

  const signatureMatch = SIGNATURE_PATTERN.exec(input.presentedSignature);
  if (!signatureMatch) throw new IngestSignatureError("SIGNATURE_INVALID");

  const message = `${input.timestamp}\n${input.idempotencyKey}\n${input.body}`;
  const expected = createHmac("sha256", input.secret).update(message, "utf8").digest();
  const presented = Buffer.from(signatureMatch[1]!, "hex");
  if (!timingSafeEqual(expected, presented)) {
    throw new IngestSignatureError("SIGNATURE_INVALID");
  }
}

export { MAX_BODY_BYTES };
