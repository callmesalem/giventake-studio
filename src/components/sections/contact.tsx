import { useState } from "react";
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

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  company: z.string().trim().max(120).optional(),
  description: z.string().trim().min(10, "Tell us a bit more about your project").max(1500),
  budget: z.string().min(1, "Select a budget"),
  timeline: z.string().min(1, "Select a timeline"),
  consent: z.string().refine((v) => v === "on", { message: "Please confirm you've read the privacy notice" }),
});

// Owner: replace with your real inbox before launch.
const CONTACT_EMAIL = "hello@giventake.dev";

export function ContactCTA() {
  const [handedOff, setHandedOff] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    const result = schema.safeParse(data);
    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    // No backend is wired up. Hand off to the user's mail client with the
    // brief pre-filled — nothing is stored, nothing is silently discarded.
    const subject = `Project brief · ${result.data.name}${result.data.company ? ` · ${result.data.company}` : ""}`;
    const body = [
      `Name: ${result.data.name}`,
      `Email: ${result.data.email}`,
      result.data.company ? `Company: ${result.data.company}` : null,
      `Budget: ${result.data.budget}`,
      `Timeline: ${result.data.timeline}`,
      "",
      "Project:",
      result.data.description,
    ]
      .filter(Boolean)
      .join("\n");
    const href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
    setHandedOff(true);
    form.reset();
  }

  return (
    <section id="contact" className="border-b border-hairline bg-paper">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-24 md:py-28 lg:grid-cols-[1fr_1.15fr]">
        <div>
          <p className="text-[13px] font-medium text-violet">Contact</p>
          <h2 className="mt-3 font-display text-5xl font-medium leading-[0.98] tracking-[-0.035em] text-ink md:text-6xl">
            Let's build something great.
          </h2>
          <p className="mt-6 max-w-md text-[17px] leading-relaxed text-muted-ink">
            Send us a few lines about what you're working on. You'll hear back within one business day, usually the same afternoon.
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
                    <path d="M4 10l4 4 8-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="text-[15px] text-ink">{i}</span>
              </li>
            ))}
          </ul>

          <div className="mt-12 rounded-2xl border border-hairline bg-white p-5 shadow-soft">
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

        <div className="rounded-2xl border border-hairline bg-white p-6 shadow-lift md:p-8">
          {handedOff ? (
            <div className="flex flex-col items-start py-10">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-soft text-violet">
                <svg viewBox="0 0 20 20" className="h-6 w-6" fill="none">
                  <path d="M4 10l4 4 8-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="mt-6 text-[24px] font-semibold tracking-tight text-ink">
                Almost there.
              </h3>
              <p className="mt-2 max-w-sm text-[15px] text-muted-ink">
                Your mail client should have opened with the brief pre-filled. Hit send and we&rsquo;ll reply within one business day. If nothing opened, email us directly at{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-ink underline">
                  {CONTACT_EMAIL}
                </a>
                .
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name">
                  <Input name="name" required maxLength={100} placeholder="Jane Doe" className="h-11 rounded-xl border-hairline bg-paper focus-visible:border-violet focus-visible:ring-0" />
                </Field>
                <Field label="Email">
                  <Input name="email" type="email" required maxLength={255} placeholder="jane@company.com" className="h-11 rounded-xl border-hairline bg-paper focus-visible:border-violet focus-visible:ring-0" />
                </Field>
              </div>
              <Field label="Company">
                <Input name="company" maxLength={120} placeholder="Company Inc." className="h-11 rounded-xl border-hairline bg-paper focus-visible:border-violet focus-visible:ring-0" />
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
                    <SelectTrigger aria-label="Budget" className="h-11 rounded-xl border-hairline bg-paper focus:ring-0">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
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
                    <SelectTrigger aria-label="Timeline" className="h-11 rounded-xl border-hairline bg-paper focus:ring-0">
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
                  <a href="mailto:privacy@giventake.dev" className="font-medium text-ink underline">
                    privacy@giventake.dev
                  </a>
                  .
                </span>
              </label>

              <p className="text-[11.5px] leading-relaxed text-muted-ink">
                Submitting this form opens your email client with the brief pre-filled — the message
                is sent from your inbox, not stored on our servers. Please don't include sensitive
                personal, financial, or health information.
              </p>

              <button
                type="submit"
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-6 py-3.5 text-[14px] font-medium text-white transition hover:opacity-90"
              >
                Send project brief
                <IconArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[13px] font-medium text-ink">
        {label}
      </label>
      {children}
    </div>
  );
}
