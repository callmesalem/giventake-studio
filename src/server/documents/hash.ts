/**
 * sha-256 of a string, lowercase hex.
 *
 * WebCrypto rather than node:crypto — this runs on Cloudflare Workers, same
 * constraint as src/server/campaigns/tokens.ts.
 *
 * This is the evidentiary anchor for a signature: the hash of the exact bytes a
 * signer was shown. Keep it boring and keep it here alone.
 */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
