import { pageHead } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { IconArrowRight } from "@/components/marks";
import { dsarSchema } from "@/lib/intake-schema";
import { submitDsar } from "@/lib/intake";

const PRIVACY_EMAIL = "privacy@giventake.dev";

const REQUEST_TYPES = [
  { value: "access", label: "Access — send me a copy of my data" },
  { value: "correction", label: "Correction — fix inaccurate information" },
  { value: "deletion", label: "Deletion — erase my data" },
  { value: "portability", label: "Portability — export my data in a portable format" },
  { value: "restriction", label: "Restriction — limit how my data is used" },
  { value: "objection", label: "Objection — stop processing my data" },
];

const schema = dsarSchema.extend({
  consent: z.string().refine((v) => v === "on", { message: "Please confirm the declaration" }),
});

export const Route = createFileRoute("/data-request")({
  head: () =>
    pageHead({
      path: "/data-request",
      title: "Data Rights Request · GivenTake Goods Devs",
      description:
        "Request access, correction, deletion, or portability of your personal data held by GivenTake Goods Devs under GDPR and CCPA.",
    }),
  component: DataRequestPage,
});

function DataRequestPage() {
  const [outcome, setOutcome] = useState<"idle" | "sent" | "mailto">("idle");
  const [submitting, setSubmitting] = useState(false);

  /**
   * Fallback when no mail provider is configured or the request fails. A data
   * rights request that silently disappears is a compliance failure, not just a
   * bad form, so this path must always be available.
   */
  function handOffToMailClient(d: z.infer<typeof schema>) {
    const label = REQUEST_TYPES.find((r) => r.value === d.requestType)?.label ?? d.requestType;
    const subject = `Data rights request · ${label.split(" — ")[0]} · ${d.name}`;
    const body = [
      `Name: ${d.name}`,
      `Email on file: ${d.email}`,
      d.residency ? `Residency / jurisdiction: ${d.residency}` : null,
      `Request type: ${label}`,
      "",
      "Details:",
      d.details,
      "",
      d.identity ? `Identity verification notes:\n${d.identity}` : null,
      "",
      "Declaration: I confirm the information above is accurate and that I am the data subject or an authorized agent.",
    ]
      .filter(Boolean)
      .join("\n");
    window.location.href = `mailto:${PRIVACY_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setOutcome("mailto");
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }

    const { consent: _consent, ...payload } = parsed.data;
    setSubmitting(true);
    try {
      const result = await submitDsar({ data: payload });
      if (result.status === "sent") {
        setOutcome("sent");
        form.reset();
        return;
      }
      if (result.status === "error") toast.error(result.message);
      handOffToMailClient(parsed.data);
      form.reset();
    } catch {
      handOffToMailClient(parsed.data);
      form.reset();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen text-foreground antialiased">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-20">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-ink">
          Your privacy rights
        </p>
        <h1 className="mt-2 font-display text-5xl font-medium tracking-tight text-ink">
          Data rights request
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-ink">
          Use this form to exercise any of your privacy rights under GDPR, UK GDPR, CCPA/CPRA, or
          similar laws. We reply within 30 days (45 days for CCPA), and there is no fee for
          reasonable requests.
        </p>

        <div className="mt-10 rounded-2xl border border-hairline bg-white p-6 shadow-lift md:p-8">
          {outcome !== "idle" ? (
            <div className="flex flex-col items-start py-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                <svg viewBox="0 0 20 20" className="h-6 w-6" fill="none">
                  <path
                    d="M4 10l4 4 8-9"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h2 className="mt-5 text-[22px] font-semibold tracking-tight text-ink">
                {outcome === "sent" ? "Request received." : "Request drafted."}
              </h2>
              <p className="mt-2 max-w-md text-[14.5px] text-muted-ink">
                {outcome === "sent" ? (
                  <>
                    We&rsquo;ve received your request and will respond within 30 days, as set out in
                    our{" "}
                    <a href="/privacy" className="font-semibold text-ink underline">
                      Privacy Policy
                    </a>
                    . If you don&rsquo;t hear from us, follow up at{" "}
                    <a
                      href={`mailto:${PRIVACY_EMAIL}`}
                      className="font-semibold text-ink underline"
                    >
                      {PRIVACY_EMAIL}
                    </a>
                    .
                  </>
                ) : (
                  <>
                    Your mail client should have opened with the request addressed to{" "}
                    <a
                      href={`mailto:${PRIVACY_EMAIL}`}
                      className="font-semibold text-ink underline"
                    >
                      {PRIVACY_EMAIL}
                    </a>
                    . Review it and hit send. If nothing opened, email us directly at that address
                    and include the request type in the subject line.
                  </>
                )}
              </p>
              <button
                type="button"
                onClick={() => setOutcome("idle")}
                className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink hover:opacity-70"
              >
                Submit another request
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name">
                  <Input
                    name="name"
                    required
                    maxLength={100}
                    placeholder="Jane Doe"
                    className="h-11 rounded-xl border-hairline bg-paper focus-visible:border-violet focus-visible:ring-0"
                  />
                </Field>
                <Field label="Email on file">
                  <Input
                    name="email"
                    type="email"
                    required
                    maxLength={255}
                    placeholder="jane@company.com"
                    className="h-11 rounded-xl border-hairline bg-paper focus-visible:border-violet focus-visible:ring-0"
                  />
                </Field>
              </div>

              <Field
                label="Residency (optional)"
                hint="Helps us apply the right law (GDPR, UK GDPR, CCPA, etc.)"
              >
                <Input
                  name="residency"
                  maxLength={80}
                  placeholder="California, Germany, United Kingdom…"
                  className="h-11 rounded-xl border-hairline bg-paper focus-visible:border-violet focus-visible:ring-0"
                />
              </Field>

              <Field label="Request type">
                <Select name="requestType" required>
                  <SelectTrigger className="h-11 rounded-xl border-hairline bg-paper focus:ring-0">
                    <SelectValue placeholder="Select the right you want to exercise" />
                  </SelectTrigger>
                  <SelectContent>
                    {REQUEST_TYPES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field
                label="Details"
                hint="Which data, from when, and any context that helps us locate your records"
              >
                <Textarea
                  name="details"
                  required
                  maxLength={1500}
                  rows={4}
                  placeholder="e.g. Please delete the project brief I submitted around March 2026 and any related emails."
                  className="rounded-xl border-hairline bg-paper focus-visible:border-violet focus-visible:ring-0"
                />
              </Field>

              <Field
                label="Identity verification (optional)"
                hint="Optional now — we may follow up to confirm your identity before acting on the request"
              >
                <Textarea
                  name="identity"
                  maxLength={500}
                  rows={2}
                  placeholder="Any details that help us verify you (e.g. the email address you used to contact us)"
                  className="rounded-xl border-hairline bg-paper focus-visible:border-violet focus-visible:ring-0"
                />
              </Field>

              <label className="flex items-start gap-3 rounded-xl border border-hairline bg-paper p-3.5">
                <input
                  type="checkbox"
                  name="consent"
                  required
                  className="mt-0.5 h-4 w-4 flex-none accent-ink"
                />
                <span className="text-[12.5px] leading-relaxed text-muted-ink">
                  I confirm the information above is accurate and that I am the data subject, or an
                  authorized agent acting on their behalf. I understand GivenTake Goods Devs will
                  use these details to verify and fulfill the request, and for no other purpose.
                </span>
              </label>

              <p className="text-[11.5px] leading-relaxed text-muted-ink">
                Your request is sent to our privacy team and answered within 30 days. If your
                browser can&rsquo;t reach us, it will open your mail client with the request
                pre-filled instead. Please don&rsquo;t include sensitive information (government
                IDs, health, financial data) in this form &mdash; if we need identity documents,
                we&rsquo;ll ask through a secure channel.
              </p>

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-6 py-3.5 text-[14px] font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Sending…" : "Send request"}
                {!submitting && <IconArrowRight className="h-4 w-4" />}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-[12.5px] text-muted-ink">
          Prefer email? Write directly to{" "}
          <a href={`mailto:${PRIVACY_EMAIL}`} className="font-medium text-ink underline">
            {PRIVACY_EMAIL}
          </a>
          . For opt-out of sale or sharing, see{" "}
          <a href="/do-not-sell" className="font-medium text-ink underline">
            Do Not Sell or Share
          </a>
          .
        </p>
      </main>
      <SiteFooter />
      <Toaster />
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[13px] font-medium text-ink">{label}</label>
      {hint && <p className="text-[11.5px] text-muted-ink">{hint}</p>}
      {children}
    </div>
  );
}
