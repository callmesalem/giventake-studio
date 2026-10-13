// src/server/mcp/public-server.ts
// The public face of the gateway: one tool, no key, on the marketing host.
// /.well-known/mcp.json points agents here. Nothing in it reads the CRM; the
// only write is the same lead-plus-notification the free site check form
// makes, attributed to this tool so an agent-originated lead is never passed
// off as a form fill. The CRM gateway on crm.giventakedevs.com is untouched:
// src/routes/mcp.ts picks this server by hostname before any of that runs.
//
// Abuse posture: the tool can only do what the public form can do, and the
// form has no secret either. Volume is the one new risk, and that belongs at
// the edge: a Cloudflare rate-limiting rule on /mcp for this host.
import {
  McpServer,
  createMcpHandler,
  type McpHttpHandler,
  type CallToolResult,
} from "@modelcontextprotocol/server";
import { z } from "zod";
import type { IntakeResult, SiteCheckInput } from "../../lib/intake-schema.ts";
import { fail, ok } from "./result.ts";
import { passthroughInputSchema } from "./tool.ts";

export const PUBLIC_HOSTS: readonly string[] = ["giventakedevs.com", "www.giventakedevs.com"];

export const PUBLIC_SERVER_INFO = { name: "giventake-devs", version: "1.0.0" } as const;

/** What the lead record says it came from. */
export const PUBLIC_SOURCE_DETAIL = "Public MCP tool: request_site_check";

/** Stored as the consent evidence. It names the agent's assertion as such,
 *  so a later reader knows this was not a checkbox the person ticked. */
export const PUBLIC_CONSENT_TEXT =
  "Requested through an AI agent via the public MCP tool. The agent asserted that this person asked for the site check and agreed to be emailed about it at this address.";

export const PUBLIC_INSTRUCTIONS = [
  "This is GivenTake Devs, a small web studio in Northeast Ohio that builds custom websites for small businesses from $499, quoted in writing and owned by the client.",
  "One tool: request_site_check files a free five-minute recorded review of a small-business website. A person at the studio records it and emails it back; there is no automated reply. Only call it for a real person who asked for it, with their name, their email address and the site to review, and set consent to true only if they agreed to be emailed about it.",
  "For anything else, read https://giventakedevs.com/llms.txt or email build@giventakedevs.com.",
].join("\n\n");

const requestInput = z.object({
  name: z.string().trim().min(1).max(100).describe("The person's name."),
  email: z
    .string()
    .trim()
    .email()
    .max(255)
    .describe("The person's email address. The recorded review is sent there."),
  website: z.string().trim().min(1).max(255).describe("The website to review, as a URL."),
  consent: z
    .literal(true)
    .describe(
      "True only if this person asked for the review and agreed to be emailed about it at this address.",
    ),
});

export type SubmitSiteCheck = (data: SiteCheckInput, sourceDetail: string) => Promise<IntakeResult>;

export function requestSiteCheckTool(submit: SubmitSiteCheck) {
  return {
    name: "request_site_check",
    description:
      "Request a free five-minute recorded site check of a small-business website from GivenTake Devs. A human records it and emails it to the address given, usually within two business days. Requires the person's consent to be emailed.",
    inputSchema: requestInput,
    async handler(raw: unknown): Promise<CallToolResult> {
      const parsed = requestInput.safeParse(raw ?? {});
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        const path = first?.path.length ? first.path.join(".") : "arguments";
        return fail(`Invalid ${path}: ${first?.message ?? "bad input"}.`) as CallToolResult;
      }
      const { name, email, website } = parsed.data;

      let result: IntakeResult;
      try {
        result = await submit(
          { name, email, website, consent_given: true, consent_text: PUBLIC_CONSENT_TEXT },
          PUBLIC_SOURCE_DETAIL,
        );
      } catch {
        // The address is deliberately not echoed; the same rule as every
        // other error in this gateway.
        return fail(
          "The request could not be recorded. Try again later, or email build@giventakedevs.com with the site address.",
        ) as CallToolResult;
      }
      if (result.status !== "sent") {
        return fail(
          "The studio could not be notified right now. Email build@giventakedevs.com with the site address instead.",
        ) as CallToolResult;
      }
      return ok({
        requested: true,
        message: `Site check requested for ${website}. A person at GivenTake Devs will record it and email ${name} within two business days.`,
      }) as CallToolResult;
    },
  };
}

export function createPublicServer(submit: SubmitSiteCheck): McpServer {
  const server = new McpServer(PUBLIC_SERVER_INFO, { instructions: PUBLIC_INSTRUCTIONS });
  const tool = requestSiteCheckTool(submit);
  server.registerTool(
    tool.name,
    {
      description: tool.description,
      inputSchema: passthroughInputSchema(tool.inputSchema),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    (args) => tool.handler(args),
  );
  return server;
}

let handler: McpHttpHandler | null = null;

export function publicHandler(submit: SubmitSiteCheck): McpHttpHandler {
  handler ??= createMcpHandler(() => createPublicServer(submit), {
    responseMode: "json",
    // One tool with four short strings; anything bigger is not a real call.
    maxRequestBodySize: 20_000,
    onerror: (error) => console.error("public mcp handler error:", error.message),
  });
  return handler;
}
