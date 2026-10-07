import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Website AI assistant — a short, guarded conversation that helps a visitor
 * articulate what they want built, then captures them as a CRM lead.
 *
 * Guardrails (baked into the system prompt AND the product design):
 *   - It qualifies and captures. It may share the published starting prices,
 *     because they are on the site, but exact pricing comes in the written
 *     quote after a call. It never promises a timeline or commits to anything.
 *   - It degrades gracefully: with no OPENAI_API_KEY it returns a friendly
 *     fallback and the widget falls back to "leave your details".
 *   - Lead capture reuses the proven `capture_website_lead` RPC (track-only,
 *     never sends), so the assistant path stores exactly like the contact form.
 *
 * Config: OPENAI_API_KEY must be set as a Cloudflare Worker secret for the AI
 * to reply. SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY for lead capture.
 */

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(4000),
});
const chatSchema = z.array(messageSchema).min(1).max(40);
export type ChatMessage = z.infer<typeof messageSchema>;

const SYSTEM_PROMPT = `You are the friendly assistant on the GivenTake Devs website.

GivenTake Devs is a lean, AI-assisted software studio that builds websites, web apps, MVPs, internal business tools, automations, and AI applications for founders and small businesses. The AI-assisted process means work ships fast without a big agency price tag.

Your job: have a short, warm conversation to understand what the visitor wants built or the problem they're trying to solve, and help them figure out what they actually need. Many visitors don't know exactly what they want, so offer concrete options (a website, an automation, an AI assistant, an internal tool) to help them decide.

Rules, follow them strictly:
- Keep replies short: 2 to 4 sentences. Ask ONE question at a time.
- You MAY share the published starting prices: custom websites start at $499, there's an optional care plan at $99 per month covering hosting, updates, backups, monitoring, small content edits and a monthly report, payment plans and financing are available, and the client owns the site outright. Always add that exact pricing comes in a written quote and proposal after a short call, because it depends on scope.
- Do not invent a price, a discount, or a number that isn't above. Never promise a timeline or commit to anything else.
- Be helpful and human, not salesy. No hype.
- Once you understand their need, warmly invite them to leave their name and email so the team can follow up, and mention they can book a quick call.
- Never make up facts about past clients or results.`;

function env(key: string): string | undefined {
  const v = process.env[key];
  return v && v.trim() ? v.trim() : undefined;
}

export const assistantChat = createServerFn({ method: "POST" })
  .validator((data: ChatMessage[]) => chatSchema.parse(data))
  .handler(async ({ data }): Promise<{ reply: string; configured: boolean }> => {
    const key = env("OPENAI_API_KEY");
    if (!key) {
      return {
        reply:
          "Our assistant is briefly offline, but I'd still love to help. Tell me what you're looking to build, or leave your name and email below and the team will reach out.",
        configured: false,
      };
    }
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 220,
          temperature: 0.6,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...data],
        }),
      });
      if (!response.ok) {
        console.error(`Assistant chat failed: ${response.status}`);
        return {
          reply:
            "I hit a snag just now. Tell me a bit about what you need, or leave your details below and we'll follow up.",
          configured: true,
        };
      }
      const json = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const reply = json.choices?.[0]?.message?.content?.trim();
      return {
        reply:
          reply ||
          "Tell me a little more about what you're trying to build and I'll point you in the right direction.",
        configured: true,
      };
    } catch (error) {
      console.error("Assistant chat threw", error instanceof Error ? error.message : "unknown");
      return {
        reply:
          "Something went wrong on our end. Leave your name and email below and we'll reach out shortly.",
        configured: true,
      };
    }
  });

const chatLeadSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  summary: z.string().trim().max(4000).optional(),
});
export type ChatLeadInput = z.infer<typeof chatLeadSchema>;

export const submitChatLead = createServerFn({ method: "POST" })
  .validator((data: ChatLeadInput) => chatLeadSchema.parse(data))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const url = env("SUPABASE_URL");
    const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceRoleKey) return { ok: false };
    try {
      const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/capture_website_lead`, {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_payload: {
            email: data.email,
            name: data.name,
            description: data.summary || "Started a chat on the website.",
            source: "website_chat",
          },
        }),
      });
      if (!response.ok) {
        console.error(`Chat lead capture failed: ${response.status}`);
        return { ok: false };
      }
      return { ok: true };
    } catch (error) {
      console.error("Chat lead capture threw", error instanceof Error ? error.message : "unknown");
      return { ok: false };
    }
  });
