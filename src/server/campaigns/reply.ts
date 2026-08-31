/**
 * Pull the message ids a reply threads onto, so an inbound mail can be matched
 * to campaign_sends.provider_message_id.
 *
 * Header matching rather than tagged reply-to addresses: it survives forwards
 * and clients that rewrite the envelope, and it needs no special addressing.
 */
export function extractReferencedMessageIds(
  headers: Record<string, string | undefined>,
): string[] {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (typeof v === "string") lower[k.toLowerCase()] = v;
  }

  const raw = [lower["in-reply-to"], lower["references"]].filter(Boolean).join(" ");
  const ids = raw.match(/<([^>]+)>/g) ?? [];
  return [...new Set(ids.map((id) => id.slice(1, -1)))];
}
