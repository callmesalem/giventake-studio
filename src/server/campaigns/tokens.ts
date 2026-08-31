/**
 * Signed unsubscribe tokens. Unguessable so the endpoint cannot be enumerated
 * to unsubscribe other people, and verified in constant time.
 *
 * WebCrypto rather than node:crypto — this runs on Cloudflare Workers.
 */
const encoder = new TextEncoder();

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return base64url(new Uint8Array(mac));
}

export async function unsubscribeToken(enrollmentId: string, secret: string): Promise<string> {
  const payload = base64url(encoder.encode(enrollmentId));
  return `${payload}.${await sign(payload, secret)}`;
}

/** Returns the enrollment id, or null for anything that does not verify. */
export async function verifyUnsubscribeToken(token: string, secret: string): Promise<string | null> {
  if (!secret) return null;
  if (typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  let expected: string;
  try {
    expected = await sign(parts[0], secret);
  } catch {
    return null;
  }
  if (expected.length !== parts[1].length) return null;

  // Constant time: never leak how much of the signature matched.
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ parts[1].charCodeAt(i);
  if (diff !== 0) return null;

  try {
    const padded = parts[0].replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(padded);
    return decoded || null;
  } catch {
    return null;
  }
}
