/**
 * Signature-request mail.
 *
 * The sender is INJECTED rather than imported, for the same reason
 * src/server/campaigns/mailer.ts takes its fetch that way: a module that
 * reaches out and grabs its own dependency cannot be tested without dragging
 * that dependency's whole import graph along. src/lib/intake.ts imports through
 * `@/` aliases, which vite resolves and `node --experimental-strip-types` does
 * not, so importing it here would make this file untestable in the unit suite.
 *
 * The production caller passes intake.ts's sendMail. That keeps the routing
 * decision — transactional path, NOT the campaign mailer — at the call site
 * where it is visible, rather than buried in an import here. A signature
 * request is transactional mail to a counterparty already in a commercial
 * conversation; approved_recipients is the per-SOP allowlist for cold outbound
 * (charter §3.8) and gating a contract on it would both break legitimate sends
 * and misuse a consent mechanism built for something else.
 */

/** The shape of intake.ts's sendMail, narrowed to what this module needs. */
export type SendMail = (
  to: string,
  subject: string,
  text: string,
  replyTo: string,
) => Promise<{ status: string }>;

export interface SignatureRequestMail {
  to: string;
  recipientName: string;
  documentTitle: string;
  signUrl: string;
  replyTo: string;
}

/**
 * Nothing here logs. The signing URL is a bearer credential — anyone holding it
 * can sign the client's contract — so it must not reach a log line, an error
 * message, or an exception. intake.ts takes the same position about response
 * bodies because they echo personal data; this is that rule, one step stricter.
 */
export async function sendSignatureRequest(
  send: SendMail,
  input: SignatureRequestMail,
): Promise<{ sent: boolean }> {
  const subject = `Please sign: ${input.documentTitle}`;
  const text = [
    `Hello ${input.recipientName},`,
    "",
    `Please review and sign: ${input.documentTitle}`,
    "",
    input.signUrl,
    "",
    "This link expires in 7 days.",
  ].join("\n");

  const result = await send(input.to, subject, text, input.replyTo);
  return { sent: result.status === "sent" };
}
