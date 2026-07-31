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

const PRIVACY_EMAIL = "privacy@giventake.dev";

const REQUEST_TYPES = [
  { value: "access", label: "Access — send me a copy of my data" },
  { value: "correction", label: "Correction — fix inaccurate information" },
  { value: "deletion", label: "Deletion — erase my data" },
  { value: "portability", label: "Portability — export my data in a portable format" },
  { value: "restriction", label: "Restriction — limit how my data is used" },
  { value: "objection", label: "Objection — stop processing my data" },
];

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  residency: z.string().trim().max(80).optional(),
  requestType: z.string().min(1, "Select the type of request"),
  details: z.string().trim().min(10, "Add a short description so we can find your records").max(1500),
  identity: z.string().trim().max(500).optional(),
  consent: z.string().refine((v) => v === "on", { message: "Please confirm the declaration" }),
});

export const Route = createFileRoute("/data-request")({
  head: () => pageHead({
    path: "/data-request",
    title: "Data Rights Request · GivenTake Goods Devs",
    description:
      "Request access, correction, deletion, or portability of your personal data held by GivenTake Goods Devs under GDPR and CCPA.",
  }),
  component: DataRequestPage,
});

function DataRequestPage() {
  const [sent, setSent] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    const label =
      REQUEST_TYPES.find((r) => r.value === parsed.data.requestType)?.label ?? parsed.data.requestType;
    const subject = `Data rights request · ${label.split(" — ")[0]} · ${parsed.data.name}`;
    const body = [
      `Name: ${parsed.data.name}`,
      `Email on file: ${parsed.data.email}`,
      parsed.data.residency ? `Residency / jurisdiction: ${parsed.data.residency}` : null,
      `Request type: ${label}`,
      "",
      "Details:",
      parsed.data.details,
      "",
      parsed.data.identity ? `Identity verification notes:\n${parsed.data.identity}` : null,
      "",
      "Declaration: I confirm the information above is accurate and that I am the data subject or an authorized agent.",
    ]
      .filter(Boolean)
      .join("\n");
    const href = `mailto:${PRIVACY_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
    setSent(true);
    form.reset();
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
          {sent ? (
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
                Request drafted.
              </h2>
              <p className="mt-2 max-w-md text-[14.5px] text-muted-ink">
                Your mail client should have opened with the request addressed to{" "}
                <a href={`mailto:${PRIVACY_EMAIL}`} className="font-semibold text-ink underline">
                  {PRIVACY_EMAIL}
                </a>
                . Review it and hit send. If nothing opened, email us directly at that address and
                include the request type in the subject line.
              </p>
              <button
                type="button"
                onClick={() => setSent(false)}
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

              <Field label="Residency (optional)" hint="Helps us apply the right law (GDPR, UK GDPR, CCPA, etc.)">
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
                  authorized agent acting on their behalf. I understand this request is sent from my
                  own mail client and that GivenTake Goods Devs will use the details to verify and
                  fulfill the request, and for no other purpose.
                </span>
              </label>

              <p className="text-[11.5px] leading-relaxed text-muted-ink">
                Please don't include sensitive information (government IDs, health, financial data)
                in this form. If we need identity documents, we'll ask through a secure channel.
              </p>

              <button
                type="submit"
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-6 py-3.5 text-[14px] font-medium text-white transition hover:opacity-90"
              >
                Send request
                <IconArrowRight className="h-4 w-4" />
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
