/**
 * The one place an outbound email gets its GivenTake Devs identity.
 *
 * Callers hand this module PLAIN TEXT, exactly what they would have sent
 * before, and get back both parts of a multipart send: the text they gave us
 * plus the signature, and an HTML rendering of the same thing. Nothing here
 * accepts markup, so no caller can forget to escape a name, a company, or a
 * project description that happens to contain "<".
 *
 * Brand identity (GivenTake-Brand-Identity.pdf, authoritative):
 *   wordmark   GivenTake · Devs
 *   colours    ink #0a0a0a, paper #f7f7f5, accent #6366f1,
 *              muted ink #565656, hairline #eaeaea
 *   type       Inter Tight, then system-ui, sans-serif
 *   signature  GivenTake Goods LLC · giventakedevs.com · build@giventakedevs.com
 *
 * Every style is inline and the layout is one nested div: email clients strip
 * stylesheets, and a table-free card is the smallest thing that survives them.
 *
 * Voice rule: no em dashes in anything a recipient reads.
 */

const INK = "#0a0a0a";
const PAPER = "#f7f7f5";
const ACCENT = "#6366f1";
const MUTED_INK = "#565656";
const HAIRLINE = "#eaeaea";
const FONT = "'Inter Tight', system-ui, sans-serif";

export const BRAND_WORDMARK = "GivenTake · Devs";
export const BRAND_SITE = "https://giventakedevs.com";
export const BRAND_BOOK_URL = "https://giventakedevs.com/book";
export const BRAND_SIGNATURE = "GivenTake Goods LLC · giventakedevs.com · build@giventakedevs.com";
const UNSUBSCRIBE_LINE = 'Not useful? Reply with "unsubscribe" and we will take you off this list.';

/** Transactional mail answers something the recipient did; marketing needs an opt-out line. */
export type EmailKind = "transactional" | "marketing";

export interface BrandedEmail {
  html: string;
  text: string;
}

/** Escape first, build markup after. Everything below this line is already safe. */
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Make bare URLs clickable. Runs on ALREADY ESCAPED text, so the href can only
 * ever contain escaped characters. Trailing punctuation is left outside the
 * link, because "see https://example.com." should not link the full stop.
 */
function linkify(escaped: string): string {
  return escaped.replace(/https?:\/\/[^\s<]+/g, (url) => {
    const trailing = url.match(/[.,;:)\]]+$/)?.[0] ?? "";
    const href = url.slice(0, url.length - trailing.length);
    return `<a href="${href}" style="color:${ACCENT}">${href}</a>${trailing}`;
  });
}

/** Blank line starts a paragraph; a single newline is a line break. */
function paragraphs(textBody: string): string {
  return textBody
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => linkify(escapeHtml(block)).replaceAll("\n", "<br />"))
    .filter((block) => block.trim().length > 0)
    .map(
      (block) =>
        `<p style="margin:0 0 16px;color:${INK};font-size:15px;line-height:1.6">${block}</p>`,
    )
    .join("");
}

function footerLine(content: string): string {
  return `<p style="margin:0 0 8px;color:${MUTED_INK};font-size:12px;line-height:1.5">${content}</p>`;
}

/**
 * Render one outbound email in the brand.
 *
 * `textBody` is plain text. The returned `text` is that body with the signature
 * appended; the returned `html` is the same content in the branded card.
 */
export function renderBrandedEmail(input: {
  subject: string;
  textBody: string;
  kind: EmailKind;
}): BrandedEmail {
  const { subject, textBody, kind } = input;

  const text = [
    textBody.trimEnd(),
    "",
    BRAND_SIGNATURE,
    `Book a call: ${BRAND_BOOK_URL}`,
    ...(kind === "marketing" ? [UNSUBSCRIBE_LINE] : []),
  ].join("\n");

  // The dot is accent-coloured, which splits the wordmark across two elements,
  // so the readable name lives on aria-label for assistive tech.
  const wordmark =
    `<a href="${BRAND_SITE}" aria-label="${BRAND_WORDMARK}" ` +
    `style="text-decoration:none;color:${INK};font-family:${FONT};font-size:20px;font-weight:600">` +
    `GivenTake <span style="color:${ACCENT}">·</span> Devs</a>`;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:${PAPER}">
<div style="background:${PAPER};padding:24px 12px;font-family:${FONT}">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid ${HAIRLINE};border-radius:10px;padding:32px">
<div style="margin:0 0 24px">${wordmark}</div>
${paragraphs(textBody)}
<div style="border-top:1px solid ${HAIRLINE};margin:24px 0 16px"></div>
${footerLine(escapeHtml(BRAND_SIGNATURE))}
${footerLine(`Book a call: <a href="${BRAND_BOOK_URL}" style="color:${ACCENT}">${BRAND_BOOK_URL}</a>`)}
${kind === "marketing" ? footerLine(escapeHtml(UNSUBSCRIBE_LINE)) : ""}
</div>
</div>
</body></html>`;

  return { html, text };
}
