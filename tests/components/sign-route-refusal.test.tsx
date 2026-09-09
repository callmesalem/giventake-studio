import { describe, test, expect, beforeEach, vi } from "vitest";

/**
 * The public signing route's refusal page took the whole site down.
 *
 * On 2026-09-08 every page on giventakedevs.com and crm.giventakedevs.com
 * answered 500. The Cloudflare Workers runtime refuses to construct a Response
 * body outside a request ("Disallowed operation called within global scope"),
 * and src/routes/sign.$token.tsx built its "Link unavailable" Response once,
 * at module scope, as a shared constant. That route module is bundled into
 * the router chunk the SSR entry imports for every request, so the import
 * rejected and src/server.ts rendered its generic error page for every path.
 *
 * Node, and therefore CI, allow a Response at module scope, which is why the
 * pipeline stayed green while production died. The first test below encodes
 * the Workers rule in a form Node can check: importing the route module must
 * construct no Response at all.
 *
 * The second test is the consequence Node CAN see. A Response body can be
 * sent once; a shared refusal object would serve the first refused visitor and
 * fail every one after it. Each refusal must be a fresh Response.
 */

const ROUTE_MODULE = "@/routes/sign.$token";

type Handler = (ctx: {
  params: { token: string };
  request: Request;
  context: Record<string, never>;
}) => Promise<Response> | Response;

async function loadGetHandler(): Promise<Handler> {
  const { Route } = await import(ROUTE_MODULE);
  const options = Route.options as unknown as {
    server?: { handlers?: { GET?: Handler } };
  };
  const handler = options.server?.handlers?.GET;
  if (!handler) throw new Error("sign.$token exposes no GET server handler");
  return handler;
}

function refusedRequest(handler: Handler): Promise<Response> | Response {
  return handler({
    params: { token: "no-such-token" },
    request: new Request("https://giventakedevs.com/sign/no-such-token"),
    context: {},
  });
}

describe("/sign/$token refusal page", () => {
  beforeEach(() => {
    // No Supabase config: store() returns null and every request is refused
    // with the unavailable page, the path that was shared at module scope.
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    vi.resetModules();
  });

  test("importing the route constructs no Response - Workers forbids it at global scope", async () => {
    const RealResponse = globalThis.Response;
    let constructed = 0;
    globalThis.Response = class extends RealResponse {
      constructor(...args: ConstructorParameters<typeof Response>) {
        constructed += 1;
        super(...args);
      }
    };
    try {
      await import(ROUTE_MODULE);
    } finally {
      globalThis.Response = RealResponse;
    }
    expect(constructed).toBe(0);
  });

  test("every refusal is a fresh Response, so a second visitor can read the body", async () => {
    const GET = await loadGetHandler();

    const first = await refusedRequest(GET);
    const second = await refusedRequest(GET);

    expect(first).not.toBe(second);
    expect(await first.text()).toContain("Link unavailable");
    expect(second.bodyUsed).toBe(false);
    expect(await second.text()).toContain("Link unavailable");
  });
});
