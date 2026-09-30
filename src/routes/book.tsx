import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Reveal } from "@/components/reveal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { z } from "zod";
import { toast } from "sonner";
import { IconArrowRight } from "@/components/marks";
import { contactSchema, CONTACT_SOURCE_OPTIONS } from "@/lib/intake-schema";
import { readLeadAttribution, type LeadAttribution } from "@/lib/lead-attribution";
import { submitContact } from "@/lib/intake";
import { trackLeadEvent } from "@/lib/tracking";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/book")({
  head: () =>
    pageHead({
      path: "/book",
      title: "Book a Free Strategy Call · GivenTake Devs",
      description:
        "Book a free 30-minute strategy call with GivenTake Devs. Tell us what you're working on and when you're free — we reply within one business day to lock in a time.",
    }),
  component: BookPage,
});

const CONTACT_EMAIL = "build@giventakedevs.com";

/**
 * The call-request form reuses the contact intake schema: a strategy call is a
 * lead with a topic, not a project brief. Budget and timeline are fixed to the
 * honest defaults — a call requester hasn't stated either yet.
 */
const schema = contactSchema.extend({
  topic: z
    .string()
    .trim()
    .min(10, { error: "Tell us a little about what you want to discuss" })
    .max(1500),
  preferred_times: z
    .string()
    .trim()
    .min(2, { error: "Tell us when you're generally free" })
    .max(200),
  consent: z
    .unknown()
    .refine((v) => v === "on", { error: "Please confirm you've read the privacy notice" }),
});

type Outcome = "idle" | "sent" | "mailto";

function BookPage() {
  return (
    <div className="min-h-screen text-foreground antialiased">
      <SiteHeader />
      <main>
        <section className="border-b border-hairline">
          <div className="mx-auto max-w-3xl px-6 py-16 md:py-20">
            <Reveal>
              <p className="text-[13px] font-medium text-violet">Strategy call</p>
              <h1 className="mt-3 font-display text-[36px] font-medium leading-[1.05] tracking-[-0.03em] text-ink md:text-[48px]">
                Book your free 30-minute call.
              </h1>
              <p className="mt-5 max-w-xl text-[18px] leading-relaxed text-muted-ink">
                Tell us what you want to talk about and when you're free. A human reads every
                request and replies within one business day to lock in a time. No pitch decks, no
                pressure — just a working conversation about what you're trying to build.
              </p>
            </Reveal>
            <Reveal delay={100}>
              <div className="mt-10 rounded-2xl border border-hairline bg-white p-6 shadow-lift md:p-8">
                <BookCallForm />
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function BookCallForm() {
  const [outcome, setOutcome] = useState<Outcome>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [attribution] = useState<LeadAttribution>(() => readLeadAttribution());

  function leadEventProps(d: z.infer<typeof schema>) {
    return { budget: d.budget, timeline: d.timeline, source: d.source };
  }

  /** Fallback when no mail provider is configured, or the send fails. */
  function handOffToMailClient(d: z.infer<typeof schema>) {
    const subject = `Strategy call request · ${d.name}${d.company ? ` · ${d.company}` : ""}`;
    const body = [
      `Name: ${d.name}`,
      `Email: ${d.email}`,
      d.company ? `Company: ${d.company}` : null,
      `Preferred times: ${d.preferred_times}`,
      `Source: ${d.source}`,
      "",
      "Topic:",
      d.topic,
    ]
      .filter(Boolean)
      .join("\n");
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    trackLeadEvent("lead_form_mailto_fallback", leadEventProps(d));
    setOutcome("mailto");
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      const firstKey = Object.keys(next)[0];
      if (firstKey) {
        const el = form.querySelector<HTMLElement>(`[name="${firstKey}"]`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        el?.focus?.();
      }
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    setErrors({});

    const consentText = form
      .querySelector("[data-consent-label]")
      ?.textContent?.replace(/\s+/g, " ")
      .trim();
    const { consent: _consent, topic, preferred_times, ...rest } = parsed.data;
    const payload = {
      ...rest,
      description: `Strategy call request.\n\nPreferred times: ${preferred_times}\n\nTopic:\n${topic}`,
      consent_given: true,
      consent_text: consentText,
    };
    setSubmitting(true);
    try {
      const result = await submitContact({ data: payload });
      if (result.status === "sent") {
        trackLeadEvent("lead_form_submit_success", leadEventProps(parsed.data));
        setOutcome("sent");
        form.reset();
        return;
      }
      if (result.status === "error") {
        trackLeadEvent("lead_form_submit_error", leadEventProps(parsed.data));
        toast.error(result.message);
      }
      handOffToMailClient(parsed.data);
      form.reset();
    } catch {
      trackLeadEvent("lead_form_submit_error", leadEventProps(parsed.data));
      handOffToMailClient(parsed.data);
      form.reset();
    } finally {
      setSubmitting(false);
    }
  }

  if (outcome !== "idle") {
    return (
      <div className="flex flex-col items-start py-10">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-soft text-violet">
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
        <h2 className="mt-6 text-[24px] font-semibold tracking-tight text-ink">
          {outcome === "sent" ? "Request received." : "Almost there."}
        </h2>
        <p className="mt-2 max-w-sm text-[15px] text-muted-ink">
          {outcome === "sent" ? (
            <>
              Thanks — we&rsquo;ve got it and we&rsquo;ll reply within one business day to lock in a
              time. If you don&rsquo;t hear back, email us directly at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-ink underline">
                {CONTACT_EMAIL}
              </a>
              .
            </>
          ) : (
            <>
              Your mail client should have opened with the request pre-filled. Hit send and
              we&rsquo;ll reply within one business day. If nothing opened, email us directly at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-ink underline">
                {CONTACT_EMAIL}
              </a>
              .
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" error={errors.name}>
          <Input
            name="name"
            required
            maxLength={100}
            placeholder="Jane Doe"
            className="h-11 rounded-xl border-hairline bg-paper focus-visible:border-violet focus-visible:ring-0"
          />
        </Field>
        <Field label="Email" error={errors.email}>
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
      <Field label="Company (optional)">
        <Input
          name="company"
          maxLength={120}
          placeholder="Company Inc."
          className="h-11 rounded-xl border-hairline bg-paper focus-visible:border-violet focus-visible:ring-0"
        />
      </Field>
      <Field label="What should we talk about?" error={errors.topic}>
        <Textarea
          name="topic"
          required
          maxLength={1500}
          rows={4}
          placeholder="A few lines on what you're working on and what you want from the call."
          className="rounded-xl border-hairline bg-paper focus-visible:border-violet focus-visible:ring-0"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="When are you generally free?" error={errors.preferred_times}>
          <Input
            name="preferred_times"
            required
            maxLength={200}
            placeholder="e.g. Tue/Thu afternoons, ET"
            className="h-11 rounded-xl border-hairline bg-paper focus-visible:border-violet focus-visible:ring-0"
          />
        </Field>
        <Field label="How did you hear about us?" error={errors.source}>
          <Select name="source" required>
            <SelectTrigger
              aria-label="How did you hear about us?"
              className="h-11 rounded-xl border-hairline bg-paper focus:ring-0"
            >
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {CONTACT_SOURCE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <label className="mt-2 flex items-start gap-3 rounded-xl border border-hairline bg-paper p-3.5">
        <input
          type="checkbox"
          name="consent"
          required
          className="mt-0.5 h-4 w-4 flex-none accent-ink"
        />
        <span data-consent-label className="text-[12.5px] leading-relaxed text-muted-ink">
          I&rsquo;ve read the{" "}
          <a href="/privacy" className="font-medium text-ink underline">
            Privacy Policy
          </a>{" "}
          and agree that GivenTake Devs may use the details I&rsquo;ve submitted to arrange the
          call. My data is not sold, not used to train AI models, and I can request deletion any
          time at{" "}
          <a href="mailto:privacy@giventakedevs.com" className="font-medium text-ink underline">
            privacy@giventakedevs.com
          </a>
          .
        </span>
      </label>

      <p className="text-[11.5px] leading-relaxed text-muted-ink">
        Your request is emailed to us so we can reply — see the{" "}
        <a href="/privacy" className="font-medium text-ink underline">
          Privacy Policy
        </a>{" "}
        for how long we keep it. If your browser can&rsquo;t reach us, it will open your mail client
        with the request pre-filled instead. Do not include regulated, financial, health,
        credential, or sensitive personal data in this form.
      </p>

      {/* Honest defaults: a call requester hasn't stated a budget or timeline yet. */}
      <input type="hidden" name="budget" value="discovery" />
      <input type="hidden" name="timeline" value="exploring" />
      <input type="hidden" name="utm_source" value={attribution.utm_source ?? ""} />
      <input type="hidden" name="utm_medium" value={attribution.utm_medium ?? ""} />
      <input type="hidden" name="utm_campaign" value={attribution.utm_campaign ?? ""} />
      <input type="hidden" name="utm_content" value={attribution.utm_content ?? ""} />
      <input type="hidden" name="utm_term" value={attribution.utm_term ?? ""} />
      <input type="hidden" name="referrer" value={attribution.referrer ?? ""} />

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-6 py-3.5 text-[14px] font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Sending…" : "Request my strategy call"}
        {!submitting && <IconArrowRight className="h-4 w-4" />}
      </button>
    </form>
  );
}

function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[13px] font-medium text-ink">{label}</label>
      {children}
      {error ? (
        <p role="alert" className="text-[12.5px] font-medium text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
