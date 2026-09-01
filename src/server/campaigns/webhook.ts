/**
 * Svix signature verification for Resend webhooks.
 *
 * Without this the endpoint accepts anything, and a forged bounce event would
 * silently stop a live sequence. Signature alone is not enough either: a
 * captured-and-replayed request stays valid forever, so the timestamp is
 * checked against a tolerance window in BOTH directions.
 *
 * WebCrypto rather than node:crypto — this runs on Cloudflare Workers.
 */
const encoder = new TextEncoder();

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyResendSignature(input: {
  body: string;
  headers: Record<string, string>;
  secret: string;
  now?: Date;
  toleranceSeconds?: number;
}): Promise<boolean> {
  if (!input.secret) return false;

  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.headers)) headers[k.toLowerCase()] = v;

  const id = headers["svix-id"];
  const timestamp = headers["svix-timestamp"];
  const signature = headers["svix-signature"];
  if (!id || !timestamp || !signature) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const now = Math.floor((input.now ?? new Date()).getTime() / 1000);
  if (Math.abs(now - ts) > (input.toleranceSeconds ?? 300)) return false;

  const raw = input.secret.startsWith("whsec_") ? input.secret.slice(6) : input.secret;
  // Uint8Array<ArrayBuffer>, not the bare Uint8Array: since TS 5.7 the typed
  // arrays are generic over their buffer, and the bare form widens to
  // ArrayBufferLike, which importKey's BufferSource will not accept.
  let keyBytes: Uint8Array<ArrayBuffer>;
  try {
    keyBytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  } catch {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${id}.${timestamp}.${input.body}`),
  );
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));

  // Header format: "v1,<sig> v1,<sig>" — any matching v1 signature is enough.
  return signature.split(" ").some((part) => {
    const [version, value] = part.split(",");
    return version === "v1" && value !== undefined && timingSafeEqual(expected, value);
  });
}
