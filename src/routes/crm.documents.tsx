import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, Clipboard, FileText, Search } from "lucide-react";
import { Card, PageHeader } from "@/components/crm/ui";
import msa from "../../docs/contracts/msa-template.md?raw";
import sow from "../../docs/contracts/sow-template.md?raw";
import aiDisclosure from "../../docs/contracts/ai-use-disclosure.md?raw";
import discovery from "../../docs/templates/discovery-notes.md?raw";
import deliveryReview from "../../docs/templates/delivery-review-checklist.md?raw";
import handoff from "../../docs/templates/handoff-checklist.md?raw";
import weeklyUpdate from "../../docs/templates/weekly-update.md?raw";

export const Route = createFileRoute("/crm/documents")({ component: DocumentLibrary });

const DOCUMENTS = [
  {
    id: "msa",
    name: "Master Services Agreement",
    when: "Send once per client before the first project.",
    caution: "Template only. Attorney review required before use.",
    body: msa,
  },
  {
    id: "sow",
    name: "Statement of Work",
    when: "Complete and sign for every project before work begins.",
    caution:
      "Match scope, exclusions, acceptance criteria, price, and dependencies to the approved proposal.",
    body: sow,
  },
  {
    id: "ai",
    name: "AI Use Disclosure",
    when: "Send with the MSA and SOW, before the client raises the question.",
    caution: "Do not make promises that contradict the actual delivery controls.",
    body: aiDisclosure,
  },
  {
    id: "discovery",
    name: "Discovery Notes",
    when: "Complete during or immediately after discovery, then send the client summary the same day.",
    caution: "Record facts and client statements. Mark assumptions clearly.",
    body: discovery,
  },
  {
    id: "review",
    name: "Delivery Review Checklist",
    when: "Required before anything ships.",
    caution: "Save the completed copy in the project repository as evidence of review.",
    body: deliveryReview,
  },
  {
    id: "handoff",
    name: "Handoff Checklist",
    when: "Run after written acceptance and before closing delivery.",
    caution: "Confirm GivenTake access is removed or reduced in writing.",
    body: handoff,
  },
  {
    id: "weekly",
    name: "Weekly Client Update",
    when: "Send after every weekly working demo.",
    caution: "State client dependencies and timeline risks plainly.",
    body: weeklyUpdate,
  },
] as const;

function DocumentLibrary() {
  const [selected, setSelected] = useState<(typeof DOCUMENTS)[number]["id"]>(DOCUMENTS[0].id);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const filtered = useMemo(
    () => DOCUMENTS.filter((d) => d.name.toLowerCase().includes(query.toLowerCase())),
    [query],
  );
  const document = DOCUMENTS.find((d) => d.id === selected) ?? DOCUMENTS[0];
  async function copy() {
    await navigator.clipboard.writeText(document.body);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents & Templates"
        subtitle="The controlled source library for sales and delivery. Copy a fresh template for each client."
      />
      <div className="grid overflow-hidden rounded-lg border border-border bg-card lg:grid-cols-[280px_1fr]">
        <aside className="border-b border-border p-3 lg:border-b-0 lg:border-r">
          <label className="flex items-center gap-2 rounded-md border border-input bg-background px-3">
            <Search className="size-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a document"
              className="w-full bg-transparent py-2 text-sm outline-none"
            />
          </label>
          <div className="mt-3 space-y-1">
            {filtered.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelected(d.id)}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${selected === d.id ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
              >
                <FileText className="size-4 shrink-0" />
                {d.name}
              </button>
            ))}
          </div>
        </aside>
        <section className="min-w-0 p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">{document.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{document.when}</p>
            </div>
            <button
              type="button"
              onClick={() => void copy()}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {copied ? <Check className="size-4" /> : <Clipboard className="size-4" />}
              {copied ? "Copied" : "Copy template"}
            </button>
          </div>
          <Card className="mt-5 border-amber-300 bg-amber-50 text-amber-950">
            <p className="text-xs font-semibold uppercase tracking-wide">Use note</p>
            <p className="mt-1 text-sm">{document.caution}</p>
          </Card>
          <pre className="mt-5 max-h-[680px] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-4 font-mono text-xs leading-6 text-foreground">
            {document.body}
          </pre>
        </section>
      </div>
    </div>
  );
}
