import { useState } from "react";
import { Reveal } from "@/components/reveal";
import { Input } from "@/components/ui/input";
import { z } from "zod";
import { toast } from "sonner";
import { IconArrowRight } from "@/components/marks";
import { siteCheckSchema } from "@/lib/intake-schema";
import { readLeadAttribution, type LeadAttribution } from "@/lib/lead-attribution";
import { submitSiteCheck } from "@/lib/intake";
import { trackLeadEvent } from "@/lib/tracking";

const schema = siteCheckSchema.extend({
  // Same unchecked-box handling as the contact form: an unchecked box arrives
  // as `undefined`, so accept unknown and refine for the readable message.
  consent: z
    .unknown()
    .refine((v) => v === "on", { error: "Please confirm you've read the privacy notice" }),
});

const CONTACT_EMAIL = "build@giventakedevs.com";

type Outcome = "idle" | "sent" | "mailto";

export function SiteCheck() {
  const [outcome, setOutcome] = useState<Outcome>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [attribution] = useState<LeadAttribution>(() => readLeadAttribution());

  /** Fallback used when no mail provider is configured, or the send fails. */
  function handOffToMailClient(d: z.infer<typeof schema>) {
    const subject = `Free site check · ${d.name} · ${d.website}`;
    const body = [
      `Name: ${d.name}`,
      `Email: ${d.email}`,
      `Website to review: ${d.website}`,
      d.utm_source ? `UTM source: ${d.utm_source}` : null,
      d.utm_medium ? `UTM medium: ${d.utm_medium}` : null,
      d.utm_campaign ? `UTM campaign: ${d.utm_campaign}` : null,
      d.utm_content ? `UTM content: ${d.utm_content}` : null,
      d.utm_term ? `UTM term: ${d.utm_term}` : null,
      d.referrer ? `Referrer: ${d.referrer}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    trackLeadEvent("lead_form_mailto_fallback", { source: "site_check" });
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
    const { consent: _consent, ...rest } = parsed.data;
    const payload = { ...rest, consent_given: true, consent_text: consentText };
    setSubmitting(true);
    try {
      const result = await submitSiteCheck({ data: payload });
      if (result.status === "sent") {
        trackLeadEvent("lead_form_submit_success", { source: "site_check" });
        setOutcome("sent");
        form.reset();
        return;
      }
      if (result.status === "error") {
        trackLeadEvent("lead_form_submit_error", { source: "site_check" });
        toast.error(result.message);
      }
      handOffToMailClient(parsed.data);
      form.reset();
    } catch {
      trackLeadEvent("lead_form_submit_error", { source: "site_check" });
      handOffToMailClient(parsed.data);
      form.reset();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="site-check" className="border-b border-hairline bg-secondary/50">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-24 md:py-28 lg:grid-cols-[1fr_1fr]">
        <Reveal>
          <div>
            <p className="text-[13px] font-medium text-violet">Free site check</p>
            <h2 className="mt-3 font-display text-4xl font-medium leading-[1.02] tracking-[-0.03em] text-ink md:text-5xl">
              Wondering what your current site is costing you?
            </h2>
            <p className="mt-6 max-w-md text-[17px] leading-relaxed text-muted-ink">
              Send us your URL. We&rsquo;ll record a free 5-minute video showing what&rsquo;s
              slowing it down, what&rsquo;s confusing your customers, and the one fix we&rsquo;d
              make first.
            </p>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted-ink">
              No pitch, no obligation. It&rsquo;s the same first step we&rsquo;d do as your studio.
              You just get to watch.
            </p>
            <ul className="mt-8 space-y-3">
              {[
                "A real person watches your site like a customer would",
                "Recorded video, yours to keep, in one business day",
                "One concrete fix, whether you hire us or not",
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
                  <span className="text-[15px] text-ink">{i}</span>
                </li>
              ))}
            </ul>
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
                  {outcome === "sent" ? "You're on the list." : "Almost there."}
                </h3>
                <p className="mt-2 max-w-sm text-[15px] text-muted-ink">
                  {outcome === "sent" ? (
                    <>
                      Thanks. We&rsquo;ll record your teardown and send the video within one
                      business day.
                    </>
                  ) : (
                    <>
                      Your mail client should have opened with the request pre-filled. Hit send and
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
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-medium text-ink">Name</label>
                    <Input
                      name="name"
                      required
                      maxLength={100}
                      placeholder="Jane Doe"
                      className="h-11 rounded-xl border-hairline bg-paper focus-visible:border-violet focus-visible:ring-0"
                    />
                    {errors.name && (
                      <p role="alert" className="text-[12.5px] font-medium text-red-600">
                        {errors.name}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-medium text-ink">Email</label>
                    <Input
                      name="email"
                      type="email"
                      required
                      maxLength={255}
                      placeholder="jane@company.com"
                      className="h-11 rounded-xl border-hairline bg-paper focus-visible:border-violet focus-visible:ring-0"
                    />
                    {errors.email && (
                      <p role="alert" className="text-[12.5px] font-medium text-red-600">
                        {errors.email}
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-ink">Your website</label>
                  <Input
                    name="website"
                    required
                    maxLength={255}
                    inputMode="url"
                    placeholder="https://yourbusiness.com"
                    className="h-11 rounded-xl border-hairline bg-paper focus-visible:border-violet focus-visible:ring-0"
                  />
                  {errors.website && (
                    <p role="alert" className="text-[12.5px] font-medium text-red-600">
                      {errors.website}
                    </p>
                  )}
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
                    and agree that GivenTake Devs may use the details I&rsquo;ve submitted to send
                    my site check video. My data is not sold, not used to train AI models, and I can
                    request deletion any time at{" "}
                    <a
                      href="mailto:privacy@giventakedevs.com"
                      className="font-medium text-ink underline"
                    >
                      privacy@giventakedevs.com
                    </a>
                    .
                  </span>
                </label>

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
                  {submitting ? "Sending…" : "Get my free site check"}
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
