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
import { contactSchema } from "@/lib/intake-schema";
import { submitContact } from "@/lib/intake";

const schema = contactSchema.extend({
  consent: z
    .string()
    .refine((v) => v === "on", { message: "Please confirm you've read the privacy notice" }),
});

const CONTACT_EMAIL = "hello@giventake.dev";

type Outcome = "idle" | "sent" | "mailto";

export function ContactCTA() {
  const [outcome, setOutcome] = useState<Outcome>("idle");
  const [submitting, setSubmitting] = useState(false);

  /** Fallback used when no mail provider is configured, or the send fails. */
  function handOffToMailClient(d: z.infer<typeof schema>) {
    const subject = `Project brief · ${d.name}${d.company ? ` · ${d.company}` : ""}`;
    const body = [
      `Name: ${d.name}`,
      `Email: ${d.email}`,
      d.company ? `Company: ${d.company}` : null,
      `Budget: ${d.budget}`,
      `Timeline: ${d.timeline}`,
      "",
      "Project:",
      d.description,
    ]
      .filter(Boolean)
      .join("\n");
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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
      const result = await submitContact({ data: payload });
      if (result.status === "sent") {
        setOutcome("sent");
        form.reset();
        return;
      }
      if (result.status === "error") toast.error(result.message);
      handOffToMailClient(parsed.data);
      form.reset();
    } catch {
      // Network failure or the server function is unavailable — never drop the
      // enquiry, hand it to the mail client instead.
      handOffToMailClient(parsed.data);
      form.reset();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="contact" className="border-b border-hairline bg-paper/60 backdrop-blur-[2px]">
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
                  <span className="text-[15px] text-ink">{i}</span>
                </li>
              ))}
            </ul>

            <div className="mt-12 rounded-2xl border border-hairline bg-white p-5 shadow-soft card-lift">
              <p className="text-[12px] font-medium uppercase tracking-wider text-muted-ink">
                Prefer email?
              </p>
              <a
                href="mailto:hello@giventake.dev"
                className="mt-1 block text-[16px] font-semibold text-ink hover:text-violet"
              >
                hello@giventake.dev
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
                      Thanks &mdash; we&rsquo;ve got it and we&rsquo;ll reply within one business
                      day. If you don&rsquo;t hear back, email us directly at{" "}
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
                    placeholder="What are you building? Mention if you want AI automation, an internal agent, or a traditional web app."
                    className="rounded-xl border-hairline bg-paper focus-visible:border-violet focus-visible:ring-0"
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Budget">
                    <Select name="budget" required>
                      <SelectTrigger
                        aria-label="Budget"
                        className="h-11 rounded-xl border-hairline bg-paper focus:ring-0"
                      >
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="discovery">Discovery sprint first</SelectItem>
                        <SelectItem value="2.5-10k">$2.5k to $10k</SelectItem>
                        <SelectItem value="10-25k">$10k to $25k</SelectItem>
                        <SelectItem value="25-75k">$25k to $75k</SelectItem>
                        <SelectItem value="75k+">$75k+</SelectItem>
                        <SelectItem value="retainer">Monthly retainer</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Timeline">
                    <Select name="timeline" required>
                      <SelectTrigger
                        aria-label="Timeline"
                        className="h-11 rounded-xl border-hairline bg-paper focus:ring-0"
                      >
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asap">ASAP</SelectItem>
                        <SelectItem value="1-3mo">1 to 3 months</SelectItem>
                        <SelectItem value="3-6mo">3 to 6 months</SelectItem>
                        <SelectItem value="exploring">Just exploring</SelectItem>
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
                  <span className="text-[12.5px] leading-relaxed text-muted-ink">
                    I've read the{" "}
                    <a href="/privacy" className="font-medium text-ink underline">
                      Privacy Policy
                    </a>{" "}
                    and agree that GivenTake Goods Devs may use the details I've submitted to reply
                    to my enquiry and prepare a proposal. My data is not sold, not used to train AI
                    models, and I can request deletion any time at{" "}
                    <a
                      href="mailto:privacy@giventake.dev"
                      className="font-medium text-ink underline"
                    >
                      privacy@giventake.dev
                    </a>
                    .
                  </span>
                </label>

                <p className="text-[11.5px] leading-relaxed text-muted-ink">
                  Your brief is emailed to us so we can reply — see the{" "}
                  <a href="/privacy" className="font-medium text-ink underline">
                    Privacy Policy
                  </a>{" "}
                  for how long we keep it. If your browser can&rsquo;t reach us, it will open your
                  mail client with the brief pre-filled instead. Please don&rsquo;t include
                  sensitive personal, financial, or health information.
                </p>

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[13px] font-medium text-ink">{label}</label>
      {children}
    </div>
  );
}
