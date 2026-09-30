import { useState } from "react";
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
import {
  contactSchema,
  CONTACT_BUDGET_OPTIONS,
  CONTACT_SOURCE_OPTIONS,
  CONTACT_TIMELINE_OPTIONS,
} from "@/lib/intake-schema";
import { readLeadAttribution, type LeadAttribution } from "@/lib/lead-attribution";
import { submitContact } from "@/lib/intake";
import { trackLeadEvent } from "@/lib/tracking";

const schema = contactSchema.extend({
  // An unchecked box is omitted from FormData entirely, so this arrives as
  // `undefined`, not "". z.string() then failed on TYPE before .refine could
  // run, showing the visitor Zod's raw "expected string, received undefined".
  // z.unknown() accepts the value so the readable message is what they see.
  consent: z
    .unknown()
    .refine((v) => v === "on", { error: "Please confirm you've read the privacy notice" }),
});

const CONTACT_EMAIL = "build@giventakedevs.com";

type Outcome = "idle" | "sent" | "mailto";

export function ContactCTA() {
  const [outcome, setOutcome] = useState<Outcome>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [attribution] = useState<LeadAttribution>(() => readLeadAttribution());

  function leadEventProps(d: z.infer<typeof schema>) {
    return {
      budget: d.budget,
      timeline: d.timeline,
      source: d.source,
    };
  }

  /** Fallback used when no mail provider is configured, or the send fails. */
  function handOffToMailClient(d: z.infer<typeof schema>) {
    const subject = `Project brief · ${d.name}${d.company ? ` · ${d.company}` : ""}`;
    const body = [
      `Name: ${d.name}`,
      `Email: ${d.email}`,
      d.company ? `Company: ${d.company}` : null,
      `Budget: ${d.budget}`,
      `Timeline: ${d.timeline}`,
      `Source: ${d.source}`,
      d.source_detail ? `Source detail: ${d.source_detail}` : null,
      d.utm_source ? `UTM source: ${d.utm_source}` : null,
      d.utm_medium ? `UTM medium: ${d.utm_medium}` : null,
      d.utm_campaign ? `UTM campaign: ${d.utm_campaign}` : null,
      d.utm_content ? `UTM content: ${d.utm_content}` : null,
      d.utm_term ? `UTM term: ${d.utm_term}` : null,
      d.referrer ? `Referrer: ${d.referrer}` : null,
      "",
      "Project:",
      d.description,
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
      // A toast alone is easy to miss, and the dropdowns give no other signal
      // that they are the reason nothing happened. Put the message on the field
      // and move the cursor there.
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

    // Store the wording the visitor actually saw, read from the rendered label
    // rather than a constant. A constant drifts silently the day someone edits
    // the copy; the DOM cannot disagree with itself.
    const consentText = form
      .querySelector("[data-consent-label]")
      ?.textContent?.replace(/\s+/g, " ")
      .trim();
    const { consent: _consent, ...rest } = parsed.data;
    const payload = { ...rest, consent_given: true, consent_text: consentText };
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
      // Network failure or the server function is unavailable — never drop the
      // enquiry, hand it to the mail client instead.
      trackLeadEvent("lead_form_submit_error", leadEventProps(parsed.data));
      handOffToMailClient(parsed.data);
      form.reset();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="contact" className="border-b border-hairline bg-paper/60 backdrop-blur-[2px]">
      <div className="mx-auto max-w-7xl px-6 pt-24 md:pt-28">
        <Reveal>
          <div className="aspect-[1904/480] overflow-hidden rounded-2xl border border-hairline shadow-soft">
            <video
              className="block h-full w-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              preload="none"
              poster="/hero/giventake-cta-poster.jpg"
              aria-label="GivenTake Devs: you give us the problem, we take it from there."
            >
              <source src="/hero/giventake-cta.mp4" type="video/mp4" />
            </video>
          </div>
        </Reveal>
      </div>
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-24 md:py-28 lg:grid-cols-[1fr_1.15fr]">
        <Reveal>
          <div>
            <p className="text-[13px] font-medium text-violet">Contact</p>
            <h2 className="mt-3 font-display text-5xl font-medium leading-[0.98] tracking-[-0.035em] text-ink md:text-6xl">
              Let's build something great.
            </h2>
            <p className="mt-6 max-w-md text-[17px] leading-relaxed text-muted-ink">
              Send us a few lines about what you're working on. You'll hear back within one business
              day, usually the same afternoon.
            </p>

            <ul className="mt-10 space-y-4">
              {[
                "A 30-minute strategy call, free",
                "A fixed scope, timeline, and price in writing",
                "Weekly demos once the build starts",
              ].map((i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-violet-soft text-violet">
                    <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none">
                      <path
                        d="M4 10l4 4 8-9"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  {i === "A 30-minute strategy call, free" ? (
                    <a
                      href="/book"
                      className="text-[15px] font-medium text-ink underline decoration-violet/60 underline-offset-4 hover:text-violet"
                    >
                      {i}. Book it here
                    </a>
                  ) : (
                    <span className="text-[15px] text-ink">{i}</span>
                  )}
                </li>
              ))}
            </ul>

            <div className="mt-12 rounded-2xl border border-hairline bg-white p-5 shadow-soft card-lift">
              <p className="text-[12px] font-medium uppercase tracking-wider text-muted-ink">
                Prefer email?
              </p>
              <a
                href="mailto:build@giventakedevs.com"
                className="mt-1 block text-[16px] font-semibold text-ink hover:text-violet"
              >
                build@giventakedevs.com
              </a>
            </div>
          </div>
        </Reveal>

        <Reveal delay={100}>
          <div className="rounded-2xl border border-hairline bg-white p-6 shadow-lift md:p-8">
            {outcome !== "idle" ? (
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
                <h3 className="mt-6 text-[24px] font-semibold tracking-tight text-ink">
                  {outcome === "sent" ? "Brief received." : "Almost there."}
                </h3>
                <p className="mt-2 max-w-sm text-[15px] text-muted-ink">
                  {outcome === "sent" ? (
                    <>
                      Thanks. We&rsquo;ve got it and we&rsquo;ll reply within one business day. If
                      you don&rsquo;t hear back, email us directly at{" "}
                      <a
                        href={`mailto:${CONTACT_EMAIL}`}
                        className="font-semibold text-ink underline"
                      >
                        {CONTACT_EMAIL}
                      </a>
                      .
                    </>
                  ) : (
                    <>
                      Your mail client should have opened with the brief pre-filled. Hit send and
                      we&rsquo;ll reply within one business day. If nothing opened, email us
                      directly at{" "}
                      <a
                        href={`mailto:${CONTACT_EMAIL}`}
                        className="font-semibold text-ink underline"
                      >
                        {CONTACT_EMAIL}
                      </a>
                      .
                    </>
                  )}
                </p>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-5" noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Name">
                    <Input
                      name="name"
                      required
                      maxLength={100}
                      placeholder="Jane Doe"
                      className="h-11 rounded-xl border-hairline bg-paper focus-visible:border-violet focus-visible:ring-0"
                    />
                  </Field>
                  <Field label="Email">
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
                <Field label="Company">
                  <Input
                    name="company"
                    maxLength={120}
                    placeholder="Company Inc."
                    className="h-11 rounded-xl border-hairline bg-paper focus-visible:border-violet focus-visible:ring-0"
                  />
                </Field>
                <Field label="Project description">
                  <Textarea
                    name="description"
                    required
                    maxLength={1500}
                    rows={4}
                    placeholder="What are you working on? A few lines is fine. What's eating your week?"
                    className="rounded-xl border-hairline bg-paper focus-visible:border-violet focus-visible:ring-0"
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
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
                  <Field label="Source detail">
                    <Input
                      name="source_detail"
                      maxLength={160}
                      placeholder="Name, partner, or short context"
                      className="h-11 rounded-xl border-hairline bg-paper focus-visible:border-violet focus-visible:ring-0"
                    />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Budget" error={errors.budget}>
                    <Select name="budget" required>
                      <SelectTrigger
                        aria-label="Budget"
                        className="h-11 rounded-xl border-hairline bg-paper focus:ring-0"
                      >
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTACT_BUDGET_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Timeline" error={errors.timeline}>
                    <Select name="timeline" required>
                      <SelectTrigger
                        aria-label="Timeline"
                        className="h-11 rounded-xl border-hairline bg-paper focus:ring-0"
                      >
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTACT_TIMELINE_OPTIONS.map((option) => (
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
                    I've read the{" "}
                    <a href="/privacy" className="font-medium text-ink underline">
                      Privacy Policy
                    </a>{" "}
                    and agree that GivenTake Devs may use the details I've submitted to reply to my
                    enquiry and prepare a proposal. My data is not sold, not used to train AI
                    models, and I can request deletion any time at{" "}
                    <a
                      href="mailto:privacy@giventakedevs.com"
                      className="font-medium text-ink underline"
                    >
                      privacy@giventakedevs.com
                    </a>
                    .
                  </span>
                </label>

                <p className="text-[11.5px] leading-relaxed text-muted-ink">
                  Your brief is emailed to us so we can reply. See the{" "}
                  <a href="/privacy" className="font-medium text-ink underline">
                    Privacy Policy
                  </a>{" "}
                  for how long we keep it. If your browser can&rsquo;t reach us, it will open your
                  mail client with the brief pre-filled instead. Do not include regulated,
                  financial, health, credential, or sensitive personal data in this form.
                </p>

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
                  {submitting ? "Sending…" : "Send project brief"}
                  {!submitting && <IconArrowRight className="h-4 w-4" />}
                </button>
              </form>
            )}
          </div>
        </Reveal>
      </div>
    </section>
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
