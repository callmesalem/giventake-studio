import { sendMail } from "../../lib/intake.ts";

export async function sendSignatureRequest(input: {
  to: string;
  recipientName: string;
  documentTitle: string;
  signUrl: string;
  replyTo: string;
}): Promise<{ sent: boolean }> {
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

  const result = await sendMail(input.to, subject, text, input.replyTo);
  return { sent: result.status === "sent" };
}
