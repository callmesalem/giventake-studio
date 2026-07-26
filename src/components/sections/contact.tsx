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

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  company: z.string().trim().max(120).optional(),
  description: z.string().trim().min(10, "Tell us a bit more about your project").max(1500),
  budget: z.string().min(1, "Select a budget"),
  timeline: z.string().min(1, "Select a timeline"),
});

export function ContactCTA() {
  const [submitted, setSubmitted] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const result = schema.safeParse(data);
    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    setSubmitted(true);
    form.reset();
  }

  return (
    <section id="contact" className="border-b border-ink/80 bg-ink text-paper">
      <div className="mx-auto grid max-w-7xl grid-cols-12 gap-8 px-6 py-24 md:py-32">
        <div className="col-span-12 lg:col-span-5">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-ochre">
            № 10 / Commission
          </span>
          <h2 className="mt-6 font-display text-5xl font-light leading-[0.95] tracking-[-0.02em] text-paper md:text-7xl">
            Let's build
            <br />
            <span className="italic">something great.</span>
          </h2>
          <p className="mt-8 max-w-md font-display text-xl italic leading-snug text-paper/75">
            Send us a few lines about what you're working on. You'll hear back within one business day, usually the same afternoon.
          </p>

          <ul className="mt-10 space-y-3 border-t border-paper/20 pt-6">
            {[
              ["A", "A 30-minute strategy call, free"],
              ["B", "A fixed scope, timeline, and price in writing"],
              ["C", "Weekly demos once the build starts"],
            ].map(([m, i]) => (
              <li key={m} className="flex items-baseline gap-4">
                <span className="stamp h-6 w-6 text-[11px] border-paper text-paper">{m}</span>
                <span className="font-display text-lg text-paper/90">{i}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="col-span-12 lg:col-span-6 lg:col-start-7">
          <div className="border border-paper/25 bg-paper text-ink">
            <div className="flex items-center justify-between border-b border-ink/30 px-6 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-ink/60">
              <span>Commission Form</span>
              <span>№ {new Date().getFullYear()}</span>
            </div>
            <div className="p-6 md:p-8">
              {submitted ? (
                <div className="flex flex-col items-start py-10">
                  <span className="stamp h-10 w-10 text-lg border-copper text-copper">✓</span>
                  <h3 className="mt-6 font-display text-3xl italic text-ink">Received, thank you.</h3>
                  <p className="mt-2 max-w-sm text-[15px] text-ink/70">
                    We'll be in touch within one business day.
                  </p>
                </div>
              ) : (
                <form onSubmit={onSubmit} className="space-y-5" noValidate>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Name">
                      <Input name="name" required maxLength={100} placeholder="Jane Doe" className="rounded-none border-0 border-b border-ink/30 bg-transparent px-0 focus-visible:ring-0 focus-visible:border-copper" />
                    </Field>
                    <Field label="Email">
                      <Input name="email" type="email" required maxLength={255} placeholder="jane@company.com" className="rounded-none border-0 border-b border-ink/30 bg-transparent px-0 focus-visible:ring-0 focus-visible:border-copper" />
                    </Field>
                  </div>
                  <Field label="Company">
                    <Input name="company" maxLength={120} placeholder="Company Inc." className="rounded-none border-0 border-b border-ink/30 bg-transparent px-0 focus-visible:ring-0 focus-visible:border-copper" />
                  </Field>
                  <Field label="Project description">
                    <Textarea
                      name="description"
                      required
                      maxLength={1500}
                      rows={4}
                      placeholder="What are you building, and what problem does it solve?"
                      className="rounded-none border-0 border-b border-ink/30 bg-transparent px-0 focus-visible:ring-0 focus-visible:border-copper"
                    />
                  </Field>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Budget">
                      <Select name="budget" required>
                        <SelectTrigger className="rounded-none border-0 border-b border-ink/30 bg-transparent px-0 focus:ring-0">
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
                        <SelectTrigger className="rounded-none border-0 border-b border-ink/30 bg-transparent px-0 focus:ring-0">
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

                  <button
                    type="submit"
                    className="mt-2 w-full border border-ink bg-ink px-6 py-3.5 font-mono text-[11px] uppercase tracking-[0.22em] text-paper transition hover:bg-copper hover:border-copper"
                  >
                    Send commission →
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/60">
        {label}
      </label>
      {children}
    </div>
  );
}
