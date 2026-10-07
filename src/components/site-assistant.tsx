import { useEffect, useRef, useState } from "react";
import { assistantChat, submitChatLead, type ChatMessage } from "@/lib/assistant";

const GREETING =
  "Hi! I'm the GivenTake assistant. Tell me what you're looking to build, or a problem you're trying to solve, and I'll help you figure out what you need.";

/**
 * Floating website assistant. A short, guarded conversation that helps a visitor
 * articulate their need, then captures them as a CRM lead. Rendered only on the
 * public site (mounted in SiteFooter, which the CRM does not use).
 */
export function SiteAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [showLead, setShowLead] = useState(false);
  const [leadSent, setLeadSent] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, open, showLead, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      // Drop the UI greeting so the API history starts with the visitor.
      const { reply } = await assistantChat({ data: next.slice(1) });
      setMessages([...next, { role: "assistant", content: reply }]);
      if (next.filter((m) => m.role === "user").length >= 2) setShowLead(true);
    } catch {
      setMessages([
        ...next,
        {
          role: "assistant",
          content: "I hit a snag. Leave your details below and we'll reach out.",
        },
      ]);
      setShowLead(true);
    } finally {
      setBusy(false);
    }
  }

  async function sendLead(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const email = String(fd.get("email") ?? "").trim();
    if (!name || !email) return;
    const summary = messages
      .map((m) => `${m.role === "user" ? "Visitor" : "Assistant"}: ${m.content}`)
      .join("\n")
      .slice(0, 3500);
    try {
      await submitChatLead({ data: { name, email, summary } });
    } catch {
      // Non-blocking; the visitor still sees a thank-you.
    }
    setLeadSent(true);
    setShowLead(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close chat" : "Chat with us"}
        className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-[14px] font-medium text-white shadow-lg transition hover:opacity-90"
      >
        {open ? "Close" : "Chat with us"}
      </button>

      {open && (
        <div className="fixed bottom-20 right-5 z-50 flex h-[520px] w-[92vw] max-w-sm flex-col overflow-hidden rounded-2xl border border-hairline bg-background shadow-2xl">
          <div className="border-b border-hairline px-4 py-3">
            <p className="text-[14px] font-semibold text-ink">GivenTake assistant</p>
            <p className="text-[12px] text-muted-ink">
              Ask about your project. A person follows up.
            </p>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                <span
                  className={
                    m.role === "user"
                      ? "max-w-[85%] rounded-2xl bg-ink px-3.5 py-2 text-[14px] leading-relaxed text-white"
                      : "max-w-[85%] rounded-2xl bg-secondary px-3.5 py-2 text-[14px] leading-relaxed text-ink"
                  }
                >
                  {m.content}
                </span>
              </div>
            ))}
            {busy && <p className="text-[13px] text-muted-ink">Typing…</p>}
          </div>

          {leadSent ? (
            <div className="border-t border-hairline px-4 py-4 text-[14px] text-ink">
              Thanks! We've got your details and we'll be in touch shortly.
            </div>
          ) : showLead ? (
            <form onSubmit={sendLead} className="space-y-2 border-t border-hairline px-4 py-3">
              <p className="text-[13px] text-muted-ink">Leave your details and we'll follow up:</p>
              <input
                name="name"
                placeholder="Name"
                required
                className="w-full rounded-lg border border-hairline bg-background px-3 py-2 text-[14px] text-ink outline-none focus:border-ink"
              />
              <input
                name="email"
                type="email"
                placeholder="Email"
                required
                className="w-full rounded-lg border border-hairline bg-background px-3 py-2 text-[14px] text-ink outline-none focus:border-ink"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-white transition hover:opacity-90"
                >
                  Send my details
                </button>
                <button
                  type="button"
                  onClick={() => setShowLead(false)}
                  className="text-[13px] font-medium text-muted-ink hover:text-ink"
                >
                  Keep chatting
                </button>
              </div>
              <p className="text-[11px] leading-snug text-muted-ink">
                We use your name, email, and this conversation only to respond to your inquiry. See
                our{" "}
                <a href="/privacy" className="underline">
                  privacy policy
                </a>
                .
              </p>
            </form>
          ) : (
            <div className="flex items-center gap-2 border-t border-hairline px-3 py-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder="Type your message…"
                aria-label="Message"
                className="flex-1 rounded-lg border border-hairline bg-background px-3 py-2 text-[14px] text-ink outline-none focus:border-ink"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={busy}
                className="rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-white transition hover:opacity-90 disabled:opacity-60"
              >
                Send
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
