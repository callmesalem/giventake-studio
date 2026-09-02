import { createFileRoute } from "@tanstack/react-router";
import {
  CONSENT_TEXT,
  performSignature,
  viewSigningRequest,
} from "@/server/documents/sign-flow.ts";
import { createSupabaseDocumentStore } from "@/server/documents/store.ts";
import type { SignFlowStore } from "@/server/documents/sign-flow.ts";

const PAGE = (body: string, status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8" } });

/**
 * Escapes text for interpolation into HTML. The document title and body come
 * from a document an internal user authored, but this page is public and
 * unauthenticated, so treat them as attacker-influenced in principle rather
 * than trust the source.
 */
function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Reads Supabase config from the environment. Null when either is missing,
 *  which the caller renders as the same generic unavailable page it uses for
 *  every other refusal - not a distinct "misconfigured" message. */
function store(): SignFlowStore | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseDocumentStore({ url, serviceRoleKey: key });
}

const UNAVAILABLE_PAGE = PAGE(
  `<!doctype html><meta charset="utf-8"><title>Link unavailable</title>` +
    `<p>This signing link is not available. It may be invalid, expired, or already ` +
    `responded to. Please contact the sender for a new link.</p>`,
);

function alreadySignedPage(signedAt: string | null | undefined): Response {
  const when = signedAt ? ` on ${escape(new Date(signedAt).toLocaleString())}` : "";
  return PAGE(
    `<!doctype html><meta charset="utf-8"><title>Already signed</title>` +
      `<p>This document was already signed${when}. No further action is needed.</p>`,
  );
}

/**
 * The caller's IP, as far as this deployment can tell. `cf-connecting-ip`
 * only - the edge sets it to the peer that actually opened the connection and
 * overwrites anything the client sent under that name, so it is the one value
 * here a caller cannot choose for itself. The leftmost `x-forwarded-for` entry
 * is the opposite: caller-controlled, so keying signature evidence to it would
 * let the signer choose what gets recorded. See
 * supabase/functions/_shared/channel-auth.ts for the measured reasoning.
 */
function clientIp(request: Request): string | null {
  const ip = request.headers.get("cf-connecting-ip")?.trim();
  return ip ? ip.slice(0, 64) : null;
}

export const Route = createFileRoute("/sign/$token")({
  server: {
    handlers: {
      /**
       * Render only. Mail clients and security scanners prefetch links, so a
       * GET that can sign would silently sign the document for a client who
       * never clicked - see sign-flow.ts. viewSigningRequest has no path to
       * markSigned; this handler adds none either.
       */
      GET: async ({ params }) => {
        const documentStore = store();
        if (!documentStore) return UNAVAILABLE_PAGE;

        const result = await viewSigningRequest(documentStore, params.token, new Date());

        if (!result.ok) {
          if (result.reason === "already-signed") return alreadySignedPage(result.signedAt);
          // not-found, expired, and declined all render identically: a
          // distinct message per case would let someone probe which tokens
          // are real, and there is nothing a legitimate signer can do about
          // any of them anyway.
          return UNAVAILABLE_PAGE;
        }

        const { view } = result;
        const action = `/sign/${encodeURIComponent(params.token)}`;
        return PAGE(
          `<!doctype html><meta charset="utf-8"><title>${escape(view.title)}</title>` +
            `<h1>${escape(view.title)}</h1>` +
            `<pre style="white-space:pre-wrap">${escape(view.body)}</pre>` +
            `<form method="post" action="${action}">` +
            `<p><label><input type="checkbox" name="consent" value="yes" required> ${escape(CONSENT_TEXT)}</label></p>` +
            `<p><label>Type your full legal name<br>` +
            `<input type="text" name="typedName" required></label></p>` +
            `<button type="submit">Sign</button>` +
            `</form>`,
        );
      },

      POST: async ({ params, request }) => {
        const documentStore = store();
        if (!documentStore) return UNAVAILABLE_PAGE;

        const form = await request.formData();
        const result = await performSignature(
          documentStore,
          params.token,
          {
            typedName: String(form.get("typedName") ?? ""),
            consent: form.get("consent") === "yes",
          },
          new Date(),
          {
            ip: clientIp(request),
            userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
          },
        );

        if (result.ok) {
          return PAGE(
            `<!doctype html><meta charset="utf-8"><title>Signed</title>` +
              `<p>Thank you. Your signature has been recorded.</p>`,
          );
        }

        if (result.reason === "invalid-input") {
          const back = `/sign/${encodeURIComponent(params.token)}`;
          return PAGE(
            `<!doctype html><meta charset="utf-8"><title>Missing information</title>` +
              `<p>Please tick the consent box and type your full legal name.</p>` +
              `<p><a href="${back}">Go back</a></p>`,
            400,
          );
        }

        // already-signed must never be reported as success: a resubmitted
        // request raced past canSign while a first submission was already
        // being written, and the database - not this handler - is what
        // decided that. See performSignature's doc comment.
        if (result.reason === "already-signed") return alreadySignedPage(undefined);

        // not-found and unavailable render identically to GET's refusal, for
        // the same reason: no distinct message per case.
        return UNAVAILABLE_PAGE;
      },
    },
  },
});
