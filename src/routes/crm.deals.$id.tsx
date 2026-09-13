import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  crmDeal,
  crmStages,
  advanceStage,
  saveDeal,
  assignRecord,
  addNote,
  convertDealToClient,
} from "@/lib/crm-data";
import { listAssignableMembers } from "@/lib/crm-auth";
import {
  generateSowDraft,
  finaliseDocument,
  listDealDocuments,
  sendForSignature,
  type DealDocumentVM,
  type DealDocumentsVM,
  type DealSignatureVM,
} from "@/lib/documents-data";
import {
  listDealDemoSites,
  requestDealDemoSite,
  type DemoSitesVM,
  type DemoSiteVM,
} from "@/lib/demo-sites-data";
import type { Gate } from "@/lib/crm-guards";
import { cn } from "@/lib/utils";
import {
  Card,
  DetailHeader,
  DetailLayout,
  Field,
  FieldList,
  FormControl,
  Timeline,
  Badge,
  EntityForm,
  Disclosure,
  OwnerPicker,
} from "@/components/crm/ui";

export const Route = createFileRoute("/crm/deals/$id")({
  loader: async ({ params }) => ({
    deal: await crmDeal({ data: { id: params.id } }),
    stages: await crmStages(),
    members: (await listAssignableMembers()).members,
    // Degrades, but is not exception-free. listDealDocuments answers
    // { available: false } when the documents schema cannot be reached, so a
    // deal page does not 500 on an environment where the migration has not
    // been applied yet. It DOES still throw a 404 Response when the caller may
    // not see this deal — the same authorisation check crmDeal above makes,
    // and the loader has already thrown on it by the time this line runs.
    documents: await listDealDocuments({ data: { dealId: params.id } }),
    // Degrades the same way, and for the same reason: the demo_sites migration
    // is not applied everywhere yet, and a missing RPC must cost one card
    // rather than the whole record.
    demoSites: await listDealDemoSites({ data: { dealId: params.id } }),
  }),
  component: Deal,
});

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function Deal() {
  const { deal, stages, members, documents, demoSites } = Route.useLoaderData();
  const router = useRouter();
  const reload = () => router.invalidate();
  return (
    <div>
      <DetailHeader
        backTo="/crm/deals"
        backLabel="Deals"
        title={deal.name}
        subtitle={
          deal.company ? (
            <a href={`/crm/companies/${deal.company.id}`} className="underline underline-offset-2">
              {deal.company.name}
            </a>
          ) : null
        }
        badge={deal.stage ? <Badge value={deal.stage} /> : null}
        action={
          <Disclosure label="Edit" openLabel={`Edit ${deal.name}`}>
            <EntityForm
              fields={[
                { name: "name", label: "Name", required: true },
                { name: "valueUsd", label: "Value (USD)", type: "number" },
              ]}
              values={{ name: deal.name, valueUsd: deal.value_usd ?? "" }}
              submitLabel="Save changes"
              columns={2}
              onSubmit={(data) => saveDeal({ data: { ...data, id: deal.id } })}
            />
          </Disclosure>
        }
      />
      <DetailLayout
        main={
          <>
            {/* The gate for the current stage, on the record itself. A gate
                written in a document nobody opens is not a control. */}
            {deal.stageGate && (deal.stageGate.gate || deal.stageGate.artifact) && (
              <Card title="This stage">
                <FieldList>
                  <Field label="Artifact">{deal.stageGate.artifact}</Field>
                  <Field label="Gate to pass">{deal.stageGate.gate}</Field>
                </FieldList>
              </Card>
            )}

            <Card title="Documents">
              <Documents
                dealId={deal.id}
                vm={documents}
                defaultClientName={deal.company?.name ?? deal.name}
                defaultProjectName={deal.name}
                onChanged={reload}
              />
            </Card>

            <Card title="Demo site">
              <DemoSites dealId={deal.id} vm={demoSites} onChanged={reload} />
            </Card>

            <Card title="Becomes a client">
              <Disclosure label="Create client" openLabel="Create a client from this deal">
                <p className="mb-3 text-xs text-muted-foreground">
                  Stage 4 of the process: signed and paid. This carries the deal's originating lead
                  through, so revenue can be traced back to the channel that produced it.
                </p>
                <EntityForm
                  fields={[
                    { name: "name", label: "Client name", required: true },
                    { name: "projectName", label: "First project", placeholder: "Optional" },
                  ]}
                  values={{ name: deal.company?.name ?? deal.name }}
                  submitLabel="Create client"
                  columns={2}
                  onSubmit={(data) => convertDealToClient({ data: { ...data, dealId: deal.id } })}
                />
                <p className="mt-3 text-xs text-muted-foreground">
                  AI processing stays off for a new client. Turn it on only when the client has
                  agreed to it.
                </p>
              </Disclosure>
            </Card>

            <Card title="Move stage">
              <StageFourConditions vm={documents} />
              <Disclosure label="Advance stage" openLabel="Advance this deal">
                <p className="mb-3 text-xs text-muted-foreground">
                  The note is required. It is the evidence that the gate was met, and it is recorded
                  against your name.
                </p>
                <EntityForm
                  fields={[
                    {
                      name: "toStage",
                      label: "Move to",
                      type: "select",
                      required: true,
                      options: stages.map((s) => ({ value: s.name, label: s.name })),
                    },
                    {
                      name: "note",
                      label: "What satisfied the gate?",
                      type: "textarea",
                      required: true,
                      rows: 3,
                    },
                  ]}
                  submitLabel="Advance"
                  onSubmit={(data) => advanceStage({ data: { ...data, dealId: deal.id } })}
                />
              </Disclosure>
            </Card>

            <Card title="Activity">
              {/* Notes hang off the company, which is where the schema puts
                  them - so a note added here is visible on the company too,
                  and on every other deal with that company. That is the
                  correct behaviour for an account note, and it is worth
                  knowing rather than discovering. */}
              {deal.company && (
                <div className="mb-4">
                  <Disclosure label="Add note" openLabel={`Note on ${deal.company.name}`}>
                    <EntityForm
                      fields={[
                        { name: "title", label: "Title", placeholder: "Optional" },
                        {
                          name: "content",
                          label: "Note",
                          type: "textarea",
                          required: true,
                          rows: 4,
                        },
                      ]}
                      submitLabel="Save note"
                      onSubmit={(data) =>
                        addNote({ data: { ...data, companyId: deal.company!.id } })
                      }
                    />
                  </Disclosure>
                </div>
              )}
              <Timeline events={deal.events} />
            </Card>
          </>
        }
        aside={
          <>
            <Card title="Assignment">
              <OwnerPicker
                members={members}
                value={deal.owner_id}
                onChange={(userId) =>
                  assignRecord({
                    data: { table: "deals", column: "owner_id", id: deal.id, userId: userId ?? "" },
                  }).then(() => router.invalidate())
                }
              />
            </Card>
            <Card title="Details">
              <FieldList>
                <Field label="Value">
                  {deal.value_usd != null ? usd.format(deal.value_usd) : null}
                </Field>
                <Field label="Stage">{deal.stage}</Field>
                <Field label="Source">{deal.source}</Field>
                <Field label="Originating lead">
                  {deal.lead ? (
                    <a href={`/crm/leads/${deal.lead.id}`} className="underline underline-offset-2">
                      {deal.lead.name ?? deal.lead.email ?? "Lead"}
                    </a>
                  ) : null}
                </Field>
                <Field label="Closed">
                  {deal.closed_at ? new Date(deal.closed_at).toLocaleDateString() : null}
                </Field>
                <Field label="Lost reason">{deal.lost_reason}</Field>
                <Field label="Created">
                  {deal.created_at ? new Date(deal.created_at).toLocaleDateString() : null}
                </Field>
              </FieldList>
            </Card>
          </>
        }
      />
    </div>
  );
}

/* ── Documents & e-signature ────────────────────────────────────────────────
 *
 * The operator half of the documents feature. Everything here reads the same
 * Card / Disclosure / FormControl kit the rest of this page uses; no new design
 * system, and nothing here writes except through the four server functions in
 * src/server/documents/deal-actions.ts.
 *
 * The workflow is four steps on purpose — DRAFT → EDIT → FINALISE → SEND —
 * because docs/contracts/sow-template.md carries merge fields this system
 * cannot derive: the pricing table's `$[X]` repeats per line item, and
 * [MSA DATE] refers to an agreement signed outside this system. So a draft
 * KEEPS its unfilled placeholders, the operator completes them in the textarea,
 * and finalising is the step that refuses anything still open.
 */

function when(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** An inline message with the same weight as EntityForm's error box. Three
 *  tones only, so a refusal never has to be dressed up as a crash. */
function Notice({ tone, children }: { tone: "info" | "warn" | "error"; children: ReactNode }) {
  const style =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : tone === "warn"
        ? "border-amber-300 bg-amber-50 text-amber-950"
        : "border-border bg-muted/50 text-muted-foreground";
  return (
    <div role="alert" className={cn("rounded-md border px-3 py-2 text-sm", style)}>
      {children}
    </div>
  );
}

/**
 * Stage 4's two conditions, on the record, beside the control that would cross
 * them.
 *
 * They are NOT the same kind of thing and this must not pretend otherwise:
 *
 *   Signed SOW   — BLOCKING. advanceDealStage asks deal_has_signed_sow and
 *                  throws on an advance into Close without one.
 *   Deposit paid — INFORMATIONAL ONLY. invoices.paid_at depends on Stripe
 *                  reconciliation, and a webhook that arrives late, retries or
 *                  drops would block work that is genuinely signed and genuinely
 *                  paid. See advanceBlockedByUnsignedSow in crm-guards.ts, whose
 *                  comment promises this surface exists.
 *
 * Nothing here disables anything, deposit included — and the advance form is
 * not disabled on an unsigned SOW either, because the stage picker offers all
 * twelve stages and refusing every advance over one stage's gate would be
 * wrong. The server enforces; this explains.
 */
function StageFourConditions({ vm }: { vm: DealDocumentsVM }) {
  if (!vm.available) {
    return (
      <div className="mb-3">
        <Notice tone="warn">
          Stage 4&rsquo;s conditions cannot be read: document storage is unreachable. An advance to
          Close will be refused until it is.
        </Notice>
      </div>
    );
  }
  return (
    <div className="mb-3 space-y-1 text-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Stage 4 &mdash; Close
      </p>
      <p className={vm.signedSow ? "text-emerald-700" : "text-red-700"}>
        <span aria-hidden="true">{vm.signedSow ? "✓" : "✗"}</span>{" "}
        <span className="font-medium">Signed SOW</span>{" "}
        {vm.signedSow ? "on record" : "— required; the advance will be refused without it"}
      </p>
      <p className={vm.depositPaid ? "text-emerald-700" : "text-muted-foreground"}>
        <span aria-hidden="true">{vm.depositPaid ? "✓" : "✗"}</span>{" "}
        <span className="font-medium">Deposit paid</span>{" "}
        {vm.depositPaid ? "on record" : "— not recorded"}{" "}
        <span className="text-xs text-muted-foreground">
          (informational; payment does not block the advance)
        </span>
      </p>
    </div>
  );
}

function Documents({
  dealId,
  vm,
  defaultClientName,
  defaultProjectName,
  onChanged,
}: {
  dealId: string;
  vm: DealDocumentsVM;
  defaultClientName: string;
  defaultProjectName: string;
  onChanged: () => void;
}) {
  if (!vm.available) {
    return (
      <Notice tone="warn">
        Document storage is not reachable from this environment, so documents and signature status
        cannot be shown here. The documents migration may not be applied yet. Nothing has been lost
        &mdash; this panel is read-only whenever it says this.
      </Notice>
    );
  }
  return (
    <div className="space-y-4">
      <GenerateSow
        dealId={dealId}
        defaultClientName={defaultClientName}
        defaultProjectName={defaultProjectName}
        onGenerated={onChanged}
      />
      {vm.documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">No documents on this deal yet.</p>
      ) : (
        <ul className="space-y-4">
          {vm.documents.map((document) => (
            <li key={document.id}>
              <DocumentPanel dealId={dealId} document={document} onChanged={onChanged} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Generate a SOW draft from what the deal knows.
 *
 * This REFUSES TODAY, and that is the feature working rather than a fault to
 * route around: docs/contracts/sow-template.md carries the banner
 * "DRAFT — NOT FOR USE WITHOUT ATTORNEY REVIEW", so draftDocument declines it
 * and writes nothing at all. The refusal is rendered in words, because the
 * operator cannot fix it from this page and needs to know who can.
 */
function GenerateSow({
  dealId,
  defaultClientName,
  defaultProjectName,
  onGenerated,
}: {
  dealId: string;
  defaultClientName: string;
  defaultProjectName: string;
  onGenerated: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Disclosure label="Generate SOW draft" openLabel="Generate a Statement of Work draft">
      <p className="mb-3 text-xs text-muted-foreground">
        This produces a <strong>draft</strong>, not a sendable contract. The pricing table and the
        MSA date cannot be derived from the deal, so they stay as visible blanks for you to complete
        before finalising.
      </p>
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setBusy(true);
          setRefused(false);
          setError(null);
          try {
            const result = await generateSowDraft({
              data: {
                dealId,
                clientLegalName: String(form.get("clientLegalName") ?? ""),
                projectName: String(form.get("projectName") ?? ""),
              },
            });
            if (result.ok) {
              onGenerated();
              return;
            }
            setRefused(true);
          } catch (cause) {
            setError(cause instanceof Error && cause.message ? cause.message : "That didn't work.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormControl
            field={{ name: "clientLegalName", label: "Client legal name", required: true }}
            defaultValue={defaultClientName}
          />
          <FormControl
            field={{ name: "projectName", label: "Project name", required: true }}
            defaultValue={defaultProjectName}
          />
        </div>

        {refused && (
          <Notice tone="warn">
            <p className="font-medium">
              The Statement of Work template has not been through attorney review.
            </p>
            <p className="mt-1">
              docs/contracts/sow-template.md still carries the banner{" "}
              <span className="font-mono text-xs">
                DRAFT &mdash; NOT FOR USE WITHOUT ATTORNEY REVIEW
              </span>
              , so nothing was created. This is deliberate: an un-reviewed contract must not reach a
              client, even as a draft. Have the template reviewed and the banner removed, then
              generate again.
            </p>
          </Notice>
        )}
        {error && <Notice tone="error">{error}</Notice>}

        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Generating…" : "Generate draft"}
        </button>
      </form>
    </Disclosure>
  );
}

function DocumentPanel({
  dealId,
  document,
  onChanged,
}: {
  dealId: string;
  document: DealDocumentVM;
  onChanged: () => void;
}) {
  return (
    <div className="rounded-lg border border-border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{document.title}</p>
          <p className="text-xs text-muted-foreground">
            {document.docType} &middot; updated {when(document.updatedAt ?? document.createdAt)}
          </p>
        </div>
        <Badge value={document.status} />
      </div>
      <div className="space-y-3 p-3">
        {document.status === "draft" ? (
          <DraftEditor dealId={dealId} document={document} onFinalised={onChanged} />
        ) : (
          <>
            <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 font-mono text-xs leading-6 text-foreground">
              {document.body}
            </pre>
            {document.status === "final" && (
              <SendForSignature dealId={dealId} document={document} onSent={onChanged} />
            )}
          </>
        )}
        <Signatures document={document} />
      </div>
    </div>
  );
}

/**
 * The edit step. The body is editable because it has to be: a generated draft
 * deliberately still contains the blanks the deal could not fill.
 *
 * A refused finalise NAMES the placeholders still open. Telling an operator a
 * contract is "not ready" without saying which blanks remain is how a document
 * gets finalised by trial and error, or worse, gets sent with [AMOUNT] in it.
 */
function DraftEditor({
  dealId,
  document,
  onFinalised,
}: {
  dealId: string;
  document: DealDocumentVM;
  onFinalised: () => void;
}) {
  const [body, setBody] = useState(document.body);
  const [busy, setBusy] = useState(false);
  const [placeholders, setPlaceholders] = useState<string[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <label htmlFor={`body-${document.id}`} className="block text-xs font-medium text-foreground">
        Document body
      </label>
      <textarea
        id={`body-${document.id}`}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={18}
        spellCheck={false}
        className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs leading-6 text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60"
      />

      {placeholders && placeholders.length > 0 && (
        <Notice tone="warn">
          <p className="font-medium">
            Not finalised. {placeholders.length}{" "}
            {placeholders.length === 1 ? "blank is" : "blanks are"} still unfilled:
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 font-mono text-xs">
            {placeholders.map((name) => (
              <li key={name}>[{name}]</li>
            ))}
          </ul>
          <p className="mt-1 text-xs">
            Fill each one in the text above, then finalise again. A repeating cell &mdash; the
            pricing table&rsquo;s <span className="font-mono">$[X]</span> &mdash; is listed once but
            may appear on several rows.
          </p>
        </Notice>
      )}
      {message && <Notice tone="error">{message}</Notice>}

      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setPlaceholders(null);
          setMessage(null);
          try {
            const result = await finaliseDocument({
              data: { dealId, documentId: document.id, body },
            });
            if (result.ok) {
              onFinalised();
              return;
            }
            if (result.reason === "unfilled-placeholders") {
              setPlaceholders(result.placeholders);
            } else if (result.reason === "unresolved-review") {
              setMessage(
                "This document still carries an attorney-review marker or the DRAFT banner. " +
                  "Remove it only once the review has actually happened.",
              );
            } else {
              setMessage("This document is no longer a draft. Reload the page to see its state.");
            }
          } catch (cause) {
            setMessage(
              cause instanceof Error && cause.message ? cause.message : "That didn't save.",
            );
          } finally {
            setBusy(false);
          }
        }}
        className="rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {busy ? "Finalising…" : "Finalise"}
      </button>
    </div>
  );
}

/** The send step, offered only on a final document. */
function SendForSignature({
  dealId,
  document,
  onSent,
}: {
  dealId: string;
  document: DealDocumentVM;
  onSent: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "info" | "warn" | "error"; text: string } | null>(
    null,
  );

  return (
    <Disclosure label="Send for signature" openLabel={`Send ${document.title} for signature`}>
      <p className="mb-3 text-xs text-muted-foreground">
        The recipient receives a private signing link. The document&rsquo;s current hash is frozen
        onto the request, so any later edit shows up here as a stale signature rather than silently
        changing what was signed.
      </p>
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setBusy(true);
          setMessage(null);
          try {
            const result = await sendForSignature({
              data: {
                dealId,
                documentId: document.id,
                bodyHash: document.bodyHash,
                recipientName: String(form.get("recipientName") ?? ""),
                recipientEmail: String(form.get("recipientEmail") ?? ""),
              },
            });
            if (result.ok && result.sent) {
              onSent();
              return;
            }
            if (result.ok) {
              // The request exists; only the mail failed. Say so precisely —
              // "try again" would create a second signature request.
              setMessage({
                tone: "warn",
                text:
                  "The signature request was created but the email did not go out. Do not send " +
                  "again: check the mail provider configuration, then resend the link from the " +
                  "existing request.",
              });
              onSent();
              return;
            }
            setMessage({
              tone: "error",
              text:
                result.reason === "not-configured"
                  ? "Nothing was sent: SITE_BASE_URL is not set, so the signing link would have " +
                    "been a relative path and the email useless. Set it in wrangler.jsonc's vars."
                  : result.reason === "not-final"
                    ? "Only a finalised document can be sent. Finalise it first."
                    : "This page is showing an older version of the document. Reload, then send.",
            });
          } catch (cause) {
            setMessage({
              tone: "error",
              text: cause instanceof Error && cause.message ? cause.message : "That didn't send.",
            });
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormControl field={{ name: "recipientName", label: "Recipient name", required: true }} />
          <FormControl
            field={{
              name: "recipientEmail",
              label: "Recipient email",
              type: "email",
              required: true,
            }}
          />
        </div>
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Sending…" : "Send for signature"}
        </button>
      </form>
    </Disclosure>
  );
}

/**
 * Every signature raised against this document, and the warning that makes the
 * hash snapshot worth taking.
 *
 * signatureIsStale compares the document's CURRENT hash with the hash frozen
 * onto the signature when it was sent. A mismatch means the document was edited
 * afterwards, so what was signed is not what is on screen. Recording that and
 * never showing it would be the worst of both: evidence that exists and is
 * never read.
 */
function Signatures({ document }: { document: DealDocumentVM }) {
  if (document.signatures.length === 0) {
    return <p className="text-xs text-muted-foreground">No signature has been requested yet.</p>;
  }
  return (
    <ul className="space-y-2">
      {document.signatures.map((signature) => (
        <li key={signature.id} className="rounded-md border border-border px-3 py-2">
          <SignatureLine document={document} signature={signature} />
        </li>
      ))}
    </ul>
  );
}

function SignatureLine({
  document,
  signature,
}: {
  document: DealDocumentVM;
  signature: DealSignatureVM;
}) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <Badge value={signature.status} />
        <span className="text-sm text-foreground">{signature.recipientName}</span>
        <span className="break-all text-xs text-muted-foreground">{signature.recipientEmail}</span>
      </div>
      {signature.status === "signed" ? (
        <p className="text-xs text-muted-foreground">
          Signed by{" "}
          <span className="font-medium text-foreground">{signature.signedName ?? "—"}</span> on{" "}
          {when(signature.signedAt)}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Sent {when(signature.sentAt)}
          {signature.viewedAt ? ` · opened ${when(signature.viewedAt)}` : ""} · expires{" "}
          {when(signature.expiresAt)}
        </p>
      )}
      {signature.stale && (
        <Notice tone="error">
          <span className="font-medium">This signature is against an earlier version.</span> The
          document has been edited since the request was sent, so what the recipient was shown is
          not what is above. Send a fresh request for the current version rather than relying on
          this one.
        </Notice>
      )}
    </div>
  );
}

/**
 * The operator half of the demo-site feature.
 *
 * WHAT THIS CARD MUST NEVER CLAIM: that it built anything. The CRM cannot. The
 * generator is a Python + headless pipeline on the VPS holding the Google Maps
 * and Vercel keys, and this page only writes a row saying a demo is wanted. The
 * gap between "queued" and "live" is real and can be minutes or forever, so
 * every string here is written to survive it — the button says Queue, the
 * status comes from the row, and a url appears only when the builder has
 * actually put one there.
 */
function DemoSites({
  dealId,
  vm,
  onChanged,
}: {
  dealId: string;
  vm: DemoSitesVM;
  onChanged: () => void;
}) {
  if (!vm.available) {
    return (
      <Notice tone="warn">
        Demo-site storage is not reachable from this environment, so demos cannot be listed or
        requested here. The demo_sites migration may not be applied yet. Nothing has been lost
        &mdash; this panel is read-only whenever it says this.
      </Notice>
    );
  }
  return (
    <div className="space-y-4">
      <RequestDemoSite dealId={dealId} vm={vm} onRequested={onChanged} />
      {vm.demoSites.length === 0 ? (
        <p className="text-sm text-muted-foreground">No demo site requested for this deal yet.</p>
      ) : (
        <ul className="space-y-3">
          {vm.demoSites.map((demo) => (
            <li key={demo.id}>
              <DemoSitePanel demo={demo} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The gates, in words.
 *
 *  Every gate is shown, passing ones included, rather than only what is
 *  currently wrong. An operator who can see the whole list can tell the
 *  difference between "one thing to fix" and "this is switched off globally",
 *  and only the second is worth escalating. */
function GateList({ gates }: { gates: Gate[] }) {
  return (
    <ul className="space-y-1.5">
      {gates.map((gate) => (
        <li key={gate.id} className="flex gap-2 text-sm">
          <span aria-hidden className={gate.pass ? "text-emerald-600" : "text-amber-700"}>
            {gate.pass ? "✓" : "✗"}
          </span>
          <span>
            <span className="font-medium">{gate.label}</span>
            <span className="sr-only">{gate.pass ? " passes" : " does not pass"}</span>
            <span className="text-muted-foreground"> &mdash; {gate.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function RequestDemoSite({
  dealId,
  vm,
  onRequested,
}: {
  dealId: string;
  vm: DemoSitesVM;
  onRequested: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [refusedGates, setRefusedGates] = useState<Gate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Disclosure label="Request demo site" openLabel="Request a demo site for this business">
      <p className="mb-3 text-xs text-muted-foreground">
        This <strong>queues</strong> a build; it does not build anything here. The generator runs on
        the VPS, pulls photos and reviews from Google Places, and deploys a static site. It will
        appear below as <span className="font-mono">requested</span>, then{" "}
        <span className="font-mono">building</span>, then <span className="font-mono">live</span>{" "}
        with a link.
      </p>
      <p className="mb-3 text-xs text-muted-foreground">
        The business name is what gets searched on Google Places, so it should be the name on the
        door rather than the deal name. An address narrows it when the name is ambiguous.
      </p>

      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setBusy(true);
          setRefusedGates(null);
          setError(null);
          try {
            const result = await requestDealDemoSite({
              data: {
                dealId,
                businessName: String(form.get("businessName") ?? ""),
                address: String(form.get("address") ?? ""),
                vertical: String(form.get("vertical") ?? ""),
              },
            });
            if (result.ok) {
              onRequested();
              return;
            }
            // The server re-evaluated the gates against facts read just now.
            // Show ITS answer, not the one the page rendered with: the kill
            // switch may have been thrown since this card loaded.
            setRefusedGates(result.gates);
          } catch (cause) {
            setError(cause instanceof Error && cause.message ? cause.message : "That didn't work.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormControl
            field={{ name: "businessName", label: "Business name", required: true }}
            defaultValue={vm.suggestedName}
          />
          <FormControl field={{ name: "address", label: "Address", placeholder: "Optional" }} />
          <FormControl
            field={{
              name: "vertical",
              label: "Vertical",
              placeholder: "Optional, e.g. restaurant",
            }}
          />
        </div>

        {!vm.requestable && !refusedGates && (
          <Notice tone="warn">
            <p className="mb-1.5 font-medium">This cannot be queued right now.</p>
            <GateList gates={vm.gates} />
          </Notice>
        )}

        {refusedGates && (
          <Notice tone="warn">
            <p className="mb-1.5 font-medium">Refused &mdash; nothing was queued.</p>
            <GateList gates={refusedGates} />
          </Notice>
        )}

        {error && <Notice tone="error">{error}</Notice>}

        <button
          type="submit"
          disabled={busy || !vm.requestable}
          className="rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Queueing…" : "Queue demo build"}
        </button>
      </form>
    </Disclosure>
  );
}

function DemoSitePanel({ demo }: { demo: DemoSiteVM }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{demo.businessName}</p>
          {demo.address && <p className="truncate text-xs text-muted-foreground">{demo.address}</p>}
        </div>
        <Badge value={demo.status} />
      </div>

      {/* A link appears only when the builder wrote one. 'live' without a url
          would be a row in an impossible state, and inventing a link for it
          would send somebody to a page that does not exist. */}
      {demo.url && (
        <p className="mt-2 text-sm">
          <a
            href={demo.url}
            target="_blank"
            rel="noreferrer noopener"
            className="underline underline-offset-2"
          >
            {demo.url}
          </a>
        </p>
      )}

      {/* The builder's own message, verbatim. It is the only account of why
          there is no demo, and paraphrasing it here would leave nobody able to
          act on it. */}
      {demo.status === "failed" && demo.error && (
        <p className="mt-2 text-sm text-red-800">{demo.error}</p>
      )}

      <p className="mt-2 text-xs text-muted-foreground">
        Requested {new Date(demo.createdAt).toLocaleString()}
        {demo.updatedAt !== demo.createdAt && (
          <> &middot; updated {new Date(demo.updatedAt).toLocaleString()}</>
        )}
      </p>
    </div>
  );
}
