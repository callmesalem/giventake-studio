import { extractReferencedMessageIds } from "./reply.ts";
import type { CampaignStore } from "./types.ts";

/**
 * Inbound replies, from Cloudflare Email Routing.
 *
 * One rule outranks everything else here: the engine must never be the reason a
 * customer's reply goes unseen. Matching an enrollment is bookkeeping;
 * delivering the mail to a human is the product. So the forward happens first
 * and unconditionally, and neither half can stop the other.
 *
 * Forwarding first is not cosmetic. A References header on a long thread lists
 * a dozen message ids, each one a Supabase round trip; matching first would put
 * the customer's mail behind all of them, and a hanging Supabase would burn the
 * invocation before it ever forwarded.
 */

/** The slice of Cloudflare's ForwardableEmailMessage this needs. */
export interface InboundMessage {
  headers: { forEach(callback: (value: string, key: string) => void): void };
  forward(to: string): Promise<void>;
}

/**
 * References is attacker-controlled and unbounded, and every id costs a network
 * call. A genuine reply threads onto one of the most recent messages, so a cap
 * loses nothing real and stops an inbound mail from pinning the Worker.
 */
const MAX_LOOKUPS = 25;

export async function handleInboundEmail(input: {
  message: InboundMessage;
  store?: Pick<CampaignStore, "markStatusByMessageId">;
  forwardTo?: string;
}): Promise<void> {
  if (input.forwardTo) {
    try {
      await input.message.forward(input.forwardTo);
    } catch (error) {
      // Never rethrow: a throw out of the email handler makes Cloudflare reject
      // the message, which bounces the customer's reply back at them.
      console.error("email forward", error instanceof Error ? error.message : "unknown");
    }
  }

  if (!input.store) return;

  try {
    const headers: Record<string, string> = {};
    input.message.headers.forEach((value, key) => {
      headers[key] = value;
    });

    for (const id of extractReferencedMessageIds(headers).slice(0, MAX_LOOKUPS)) {
      // Per id, so one unmatched or failing lookup does not abandon the rest.
      await input.store
        .markStatusByMessageId(id, "replied", "replied", { messageId: id })
        .catch(() => undefined);
    }
  } catch (error) {
    console.error("email handler", error instanceof Error ? error.message : "unknown");
  }
}
