import type { Mailer, SendOutcome } from "./types.ts";

/**
 * Resend adapter. Same endpoint and auth shape as the transactional sender in
 * src/lib/intake.ts, with two additions the engine needs: custom headers (for
 * List-Unsubscribe) and the provider message id, which reply matching depends on.
 *
 * Errors never carry the response body or the message text: both echo personal data.
 */
export function createResendMailer(config: {
  apiKey: string;
  from: string;
  fetch?: typeof globalThis.fetch;
}): Mailer {
  const doFetch = config.fetch ?? ((i, n) => fetch(i, n));

  return {
    async send(input): Promise<SendOutcome> {
      try {
        const response = await doFetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: config.from,
            to: [input.to],
            subject: input.subject,
            text: input.text,
            reply_to: input.replyTo,
            headers: input.headers,
          }),
        });

        if (!response.ok) {
          // Never log or return the body — it echoes the message, which is personal data.
          // 4xx that is not rate limiting means the request itself is wrong; retrying cannot help.
          const permanent = response.status >= 400 && response.status < 500 && response.status !== 429;
          return { status: "failed", error: `resend_${response.status}`, permanent };
        }

        const body = (await response.json()) as { id?: string };
        return { status: "sent", providerMessageId: body.id };
      } catch {
        // A throw means no response was received, so the request may well have
        // reached Resend and been accepted. Treat it as ambiguous rather than
        // as a clean failure: the caller must not retry into a duplicate.
        return { status: "failed", error: "resend_network", ambiguous: true };
      }
    },
  };
}
