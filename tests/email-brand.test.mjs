import assert from "node:assert/strict";
import { createServer } from "vite";

/**
 * Brand identity on outbound mail.
 *
 * The pure renderer is exercised directly. The sendMail tests then drive the
 * REAL src/lib/intake.ts through vite (the module imports via "@/" aliases,
 * which node alone does not resolve) with a fake fetch in place of Resend.
 *
 * Branding lives inside sendMail, not at each call site, so these tests cover
 * every send the studio makes: the four human notifications, the lead
 * auto-reply, and the documents signature request all route through it. The
 * signature-request case below drives that real path end to end.
 *
 * Nothing here logs a captured request body: a body echoes a submission, which
 * is personal data.
 */

const WORDMARK = "GivenTake · Devs";
const SIGNATURE = "GivenTake Goods LLC · giventakedevs.com · build@giventakedevs.com";
const COLORS = ["#0a0a0a", "#f7f7f5", "#6366f1", "#565656", "#eaeaea"];

const tests = [];
function test(name, run) {
  tests.push({ name, run });
}

const vite = await createServer({ logLevel: "silent", server: { middlewareMode: true } });
const realFetch = globalThis.fetch;

try {
  const { renderBrandedEmail } = await vite.ssrLoadModule("/src/lib/email-brand.ts");
  const { sendMail } = await vite.ssrLoadModule("/src/lib/intake.ts");
  const { sendSignatureRequest } = await vite.ssrLoadModule("/src/server/documents/mailer.ts");

  /* ---------------------------------------------------------------- renderer */

  const rendered = renderBrandedEmail({
    subject: "Project brief",
    textBody: "Hi there,\n\nFirst line.\nSecond line.",
    kind: "transactional",
  });

  test("the html carries the wordmark and every brand colour", () => {
    assert.ok(rendered.html.includes(WORDMARK), "wordmark missing from html");
    for (const color of COLORS) {
      assert.ok(rendered.html.includes(color), `brand colour ${color} missing from html`);
    }
  });

  test("the html uses Inter Tight with system fallbacks", () => {
    assert.ok(rendered.html.includes("'Inter Tight', system-ui, sans-serif"));
  });

  test("the wordmark links to the site", () => {
    assert.ok(rendered.html.includes('href="https://giventakedevs.com"'));
  });

  test("both parts end with the signature and the booking link", () => {
    assert.ok(rendered.text.includes(SIGNATURE));
    assert.ok(rendered.text.includes("Book a call: https://giventakedevs.com/book"));
    assert.ok(rendered.html.includes(SIGNATURE));
    assert.ok(rendered.html.includes("https://giventakedevs.com/book"));
  });

  test("the text part keeps the body it was given", () => {
    assert.ok(rendered.text.startsWith("Hi there,\n\nFirst line.\nSecond line."));
  });

  test("blank lines become paragraphs and single newlines become breaks", () => {
    assert.ok(rendered.html.includes("First line.<br />Second line."));
    assert.equal(rendered.html.split("<p style=").length - 1, 4);
  });

  test("plain text in, escaped html out, and only escaped once", () => {
    const hostile = renderBrandedEmail({
      subject: "<script>alert(1)</script>",
      textBody: 'Company: <script>alert("x")</script> & Sons',
      kind: "transactional",
    });
    assert.ok(!hostile.html.includes("<script>"), "raw markup from user input reached the html");
    assert.ok(hostile.html.includes("&lt;script&gt;"));
    assert.ok(hostile.html.includes("&amp; Sons"));
    assert.ok(!hostile.html.includes("&amp;lt;"), "double-escaped output");
    assert.ok(hostile.text.includes('<script>alert("x")</script> & Sons'));
  });

  test("a url in the body becomes an accent-coloured link", () => {
    const withUrl = renderBrandedEmail({
      subject: "Please sign",
      textBody: "https://giventakedevs.com/sign/abc123",
      kind: "transactional",
    });
    assert.ok(
      withUrl.html.includes(
        '<a href="https://giventakedevs.com/sign/abc123" style="color:#6366f1">',
      ),
    );
  });

  test("marketing adds an unsubscribe line to both parts, transactional does not", () => {
    const marketing = renderBrandedEmail({
      subject: "News",
      textBody: "Body.",
      kind: "marketing",
    });
    assert.ok(marketing.text.includes("unsubscribe"));
    assert.ok(marketing.html.includes("unsubscribe"));
    assert.ok(!rendered.text.includes("unsubscribe"));
    assert.ok(!rendered.html.includes("unsubscribe"));
  });

  test("no em dash reaches a recipient", () => {
    const marketing = renderBrandedEmail({ subject: "S", textBody: "B", kind: "marketing" });
    for (const part of [rendered.html, rendered.text, marketing.html, marketing.text]) {
      assert.ok(!part.includes("—"), "em dash in branded output");
    }
  });

  /* ----------------------------------------------------------------- sendMail */

  function captureSend({ ok = true, status = 200 } = {}) {
    const calls = [];
    globalThis.fetch = async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return {
        ok,
        status,
        async json() {
          return { id: "msg-1" };
        },
      };
    };
    return calls;
  }

  process.env.RESEND_API_KEY = "test-key";
  process.env.INTAKE_FROM_EMAIL = "build@giventakedevs.com";

  test("every send carries a branded html part alongside the text", async () => {
    const calls = captureSend();
    const result = await sendMail("lead@example.com", "Project brief", "Body.", "r@example.com");
    assert.deepEqual(result, { status: "sent" });
    const { body } = calls[0];
    assert.ok(body.html.includes(WORDMARK), "html part is not branded");
    for (const color of COLORS) assert.ok(body.html.includes(color), `missing ${color}`);
    assert.ok(body.text.includes(SIGNATURE), "text part is not signed");
  });

  test("the from header carries the studio display name", async () => {
    const calls = captureSend();
    await sendMail("lead@example.com", "S", "Body.", "r@example.com");
    assert.equal(calls[0].body.from, "GivenTake Devs <build@giventakedevs.com>");
  });

  test("a from address that already names a sender is passed through", async () => {
    process.env.INTAKE_FROM_EMAIL = "Studio Desk <desk@giventakedevs.com>";
    const calls = captureSend();
    await sendMail("lead@example.com", "S", "Body.", "r@example.com");
    assert.equal(calls[0].body.from, "Studio Desk <desk@giventakedevs.com>");
    process.env.INTAKE_FROM_EMAIL = "build@giventakedevs.com";
  });

  test("user input is escaped in the html part", async () => {
    const calls = captureSend();
    await sendMail("lead@example.com", "S", "Company: <b>Acme</b> & Co", "r@example.com");
    const { html } = calls[0].body;
    assert.ok(!/<b>/.test(html), "raw markup from user input reached the html part");
    assert.ok(html.includes("&lt;b&gt;Acme&lt;/b&gt; &amp; Co"));
  });

  test("attachments and reply-to still ride along", async () => {
    const calls = captureSend();
    await sendMail("lead@example.com", "S", "Body.", "r@example.com", [
      { filename: "cv.pdf", content: "AAA" },
    ]);
    assert.equal(calls[0].body.reply_to, "r@example.com");
    assert.equal(calls[0].body.attachments[0].filename, "cv.pdf");
  });

  test("a caller-supplied html part is sent as given", async () => {
    const calls = captureSend();
    await sendMail("lead@example.com", "S", "Body.", "r@example.com", undefined, "<p>mine</p>");
    assert.equal(calls[0].body.html, "<p>mine</p>");
    assert.equal(calls[0].body.text, "Body.");
  });

  test("a provider failure reports the status code and nothing else", async () => {
    const logged = [];
    const realError = console.error;
    console.error = (...args) => logged.push(args.join(" "));
    captureSend({ ok: false, status: 500 });
    try {
      const result = await sendMail("lead@example.com", "S", "Secret body.", "r@example.com");
      assert.equal(result.status, "error");
    } finally {
      console.error = realError;
    }
    assert.deepEqual(logged, ["Intake mail failed: 500"]);
  });

  test("the documents signature request inherits the branding", async () => {
    const calls = captureSend();
    const { sent } = await sendSignatureRequest(sendMail, {
      to: "ada@example.com",
      recipientName: "Ada Lovelace",
      documentTitle: "Statement of work",
      signUrl: "https://giventakedevs.com/sign/abc123",
      replyTo: "build@giventakedevs.com",
    });
    assert.equal(sent, true);
    const { body } = calls[0];
    assert.ok(body.html.includes(WORDMARK));
    assert.ok(body.html.includes('href="https://giventakedevs.com/sign/abc123"'));
    assert.equal(body.from, "GivenTake Devs <build@giventakedevs.com>");
  });

  let failures = 0;
  for (const { name, run } of tests) {
    try {
      await run();
      console.log(`ok - ${name}`);
    } catch (error) {
      failures += 1;
      console.error(`not ok - ${name}: ${error.message}`);
    }
  }
  if (failures) throw new Error(`${failures} email brand test(s) failed`);
  console.log("Email brand invariants passed.");
} finally {
  globalThis.fetch = realFetch;
  await vite.close();
}
