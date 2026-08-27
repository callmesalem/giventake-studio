import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  BookOpen,
  Check,
  Clipboard,
  DollarSign,
  MessageSquareText,
  ShieldAlert,
} from "lucide-react";
import { GUARDRAILS, OBJECTIONS, OFFERS, SALES_STAGES } from "@/lib/sales-playbook";
import { Badge, Card, PageHeader } from "@/components/crm/ui";

export const Route = createFileRoute("/crm/playbook")({ component: SalesPlaybook });

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        })
      }
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
    >
      {copied ? <Check className="size-3.5" /> : <Clipboard className="size-3.5" />}
      {copied ? "Copied" : "Copy script"}
    </button>
  );
}

function SalesPlaybook() {
  const [section, setSection] = useState<"process" | "offers" | "objections" | "guardrails">(
    "process",
  );
  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Playbook"
        subtitle="The guided process for selling, scoping, closing, and delivering GivenTake work."
      />
      <div className="flex flex-wrap gap-2" role="tablist">
        {(
          [
            ["process", BookOpen, "Process"],
            ["offers", DollarSign, "Offers & pricing"],
            ["objections", MessageSquareText, "Negotiation"],
            ["guardrails", ShieldAlert, "Guardrails"],
          ] as const
        ).map(([id, Icon, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={section === id}
            onClick={() => setSection(id)}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${section === id ? "bg-primary text-primary-foreground" : "border border-border bg-card hover:bg-accent"}`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>
      {section === "process" && (
        <div className="space-y-4">
          {SALES_STAGES.map((stage) => (
            <Card key={stage.id} className="p-0">
              <div className="grid gap-5 p-5 lg:grid-cols-[180px_1fr]">
                <div>
                  <Badge value={`Stage ${stage.id}`} />
                  <h2 className="mt-2 font-semibold">{stage.name}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Artifact: {stage.artifact}</p>
                </div>
                <div>
                  <p className="text-sm">{stage.goal}</p>
                  <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                      Suggested wording
                    </p>
                    <p className="mt-2 text-sm leading-6">“{stage.prompt}”</p>
                    <div className="mt-3">
                      <CopyButton text={stage.prompt} />
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {stage.actions.map((a) => (
                      <div key={a} className="flex gap-2 text-sm">
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                        {a}
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 border-t border-border pt-3 text-xs font-medium">
                    Exit gate: {stage.gate}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      {section === "offers" && (
        <div className="grid gap-4 md:grid-cols-2">
          {OFFERS.map((o) => (
            <Card key={o.name}>
              <div className="flex items-start justify-between gap-4">
                <h2 className="font-semibold">{o.name}</h2>
                <Badge value={o.price} />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{o.fit}</p>
              <p className="mt-4 text-xs font-medium">Typical timeframe: {o.timeline}</p>
            </Card>
          ))}
        </div>
      )}
      {section === "objections" && (
        <div className="space-y-4">
          {OBJECTIONS.map((o) => (
            <Card key={o.title}>
              <h2 className="font-semibold">“{o.title}”</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{o.response}</p>
              <div className="mt-3">
                <CopyButton text={o.response} />
              </div>
            </Card>
          ))}
        </div>
      )}
      {section === "guardrails" && (
        <Card>
          <h2 className="font-semibold">Lines we do not cross</h2>
          <div className="mt-4 space-y-3">
            {GUARDRAILS.map((g) => (
              <div key={g} className="flex gap-3 text-sm">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                {g}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
