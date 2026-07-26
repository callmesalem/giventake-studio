import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight, Check } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  company: z.string().trim().max(120).optional(),
  description: z
    .string()
    .trim()
    .min(10, "Tell us a bit more about your project")
    .max(1500),
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
    <section id="contact" className="relative overflow-hidden border-b border-border/60">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid bg-radial-fade opacity-40" />
        <div className="absolute left-1/2 top-0 aurora h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--brand),transparent_70%)] opacity-20 blur-3xl" />
      </div>

      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-24 md:grid-cols-[1.05fr_1fr] md:py-32">
        <div className="md:pt-6">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand">Get in touch</p>
          <h2 className="mt-3 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
            Let's build something great.
          </h2>
          <p className="mt-4 max-w-md text-muted-foreground">
            Tell us about your project. We'll reply within one business day with next steps — no pitch decks, no runaround.
          </p>

          <ul className="mt-8 space-y-3 text-sm">
            {[
              "Free 30-minute strategy call",
              "Clear scope, timeline, and price before we start",
              "Weekly demos once we're building",
            ].map((i) => (
              <li key={i} className="flex items-center gap-2.5 text-foreground/90">
                <Check className="h-4 w-4 text-brand" strokeWidth={2} />
                {i}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-[0_20px_60px_-30px_color-mix(in_oklab,var(--brand)_40%,transparent)] md:p-8">
          {submitted ? (
            <div className="flex h-full flex-col items-center justify-center py-14 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-brand/10">
                <Check className="h-6 w-6 text-brand" />
              </div>
              <h3 className="mt-5 text-lg font-semibold tracking-tight">Thanks — we've got it.</h3>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                We'll be in touch within one business day.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name">
                  <Input name="name" required maxLength={100} placeholder="Jane Doe" />
                </Field>
                <Field label="Email">
                  <Input name="email" type="email" required maxLength={255} placeholder="jane@company.com" />
                </Field>
              </div>
              <Field label="Company">
                <Input name="company" maxLength={120} placeholder="Company Inc." />
              </Field>
              <Field label="Project description">
                <Textarea
                  name="description"
                  required
                  maxLength={1500}
                  rows={4}
                  placeholder="What are you building, and what problem does it solve?"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Budget">
                  <Select name="budget" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2.5-10k">$2.5k – $10k</SelectItem>
                      <SelectItem value="10-25k">$10k – $25k</SelectItem>
                      <SelectItem value="25-75k">$25k – $75k</SelectItem>
                      <SelectItem value="75k+">$75k+</SelectItem>
                      <SelectItem value="retainer">Monthly retainer</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Timeline">
                  <Select name="timeline" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asap">ASAP</SelectItem>
                      <SelectItem value="1-3mo">1–3 months</SelectItem>
                      <SelectItem value="3-6mo">3–6 months</SelectItem>
                      <SelectItem value="exploring">Just exploring</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Button type="submit" size="lg" className="mt-2 h-11 w-full rounded-full">
                Send message
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
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
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
