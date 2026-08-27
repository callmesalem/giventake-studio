import { createFileRoute, Link } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { Bot, BookOpen, CornerDownLeft, LockKeyhole, Sparkles, User } from "lucide-react";
import { Card, PageHeader } from "@/components/crm/ui";

export const Route = createFileRoute("/crm/sami")({ component: SamiWorkspace });

type Message = { role: "user" | "assistant"; content: string };

const STARTERS = [
  "Help me prepare for a discovery call",
  "Which offer fits this lead?",
  "Help me respond to a price objection",
  "What should happen at this deal stage?",
];

function SamiWorkspace() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "I’m inside the CRM with you. Ask me about the sales process, an offer, discovery, scoping, objections, or the next step on a deal. Live deal-aware actions will activate after the secure Sami bridge is connected.",
    },
  ]);
  const [draft, setDraft] = useState("");
  function submit(value = draft) {
    const clean = value.trim();
    if (!clean) return;
    setMessages((m) => [
      ...m,
      { role: "user", content: clean },
      {
        role: "assistant",
        content:
          "The workspace interface is ready, but the secure VPS bridge is not connected on this branch yet. Use the Sales Playbook now; once the bridge is activated, I’ll answer here with CRM context and approved tools.",
      },
    ]);
    setDraft("");
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Sami Workspace"
        subtitle="Your CRM copilot for guided selling, scoping, and delivery."
      />
      <div className="grid min-h-[650px] overflow-hidden rounded-lg border border-border bg-card lg:grid-cols-[220px_1fr]">
        <aside className="border-b border-border bg-muted/30 p-4 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" />
            Workspace
          </div>
          <nav className="mt-4 space-y-1">
            <div className="rounded-md bg-accent px-3 py-2 text-sm font-medium">Chat with Sami</div>
            <Link
              to="/crm/playbook"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <BookOpen className="size-4" />
              Sales Playbook
            </Link>
          </nav>
          <div className="mt-8 rounded-md border border-border bg-background p-3">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <LockKeyhole className="size-3.5 text-emerald-600" />
              Protected bridge
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              No VPS keys or terminal access are exposed to the browser.
            </p>
          </div>
        </aside>
        <section className="flex min-w-0 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
                {m.role === "assistant" && (
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <Bot className="size-4" />
                  </div>
                )}
                <div
                  className={`max-w-2xl rounded-lg px-4 py-3 text-sm leading-6 ${m.role === "user" ? "bg-primary text-primary-foreground" : "border border-border bg-background"}`}
                >
                  {m.content}
                </div>
                {m.role === "user" && (
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                    <User className="size-4" />
                  </div>
                )}
              </div>
            ))}
            {messages.length === 1 && (
              <div className="grid gap-2 pt-4 sm:grid-cols-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => submit(s)}
                    className="rounded-md border border-border p-3 text-left text-sm hover:bg-accent"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              submit();
            }}
            className="border-t border-border p-4"
          >
            <div className="flex items-end gap-2 rounded-lg border border-input bg-background p-2 focus-within:ring-2 focus-within:ring-ring">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                rows={2}
                placeholder="Ask Sami about this lead, deal, or process…"
                className="min-h-12 flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none"
              />
              <button
                type="submit"
                aria-label="Send"
                className="rounded-md bg-primary p-2.5 text-primary-foreground hover:bg-primary/90"
              >
                <CornerDownLeft className="size-4" />
              </button>
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Sami can guide and draft. External sends, pricing changes, and production actions
              still require approval.
            </p>
          </form>
        </section>
      </div>
    </div>
  );
}
