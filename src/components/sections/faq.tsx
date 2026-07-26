import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "How long does a project take?",
    a: "Most landing pages ship in 2–3 weeks. Custom apps and automations typically run 6–12 weeks. We share a firm timeline after the strategy call.",
  },
  {
    q: "Can you build from just an idea?",
    a: "Yes. Most of our engagements start from a rough idea or a spreadsheet. We turn it into scope, then a working product. You don't need to speak engineer.",
  },
  {
    q: "Do I need technical knowledge?",
    a: "None required. You bring the business context, we bring the technology. Weekly demos keep you in the loop without needing to read code.",
  },
  {
    q: "Can you improve existing software?",
    a: "Absolutely. We regularly take over half-finished projects, add features, fix performance, and modernize legacy stacks.",
  },
  {
    q: "What technologies do you use?",
    a: "React, Next.js, TypeScript, Postgres, and modern AI tooling. We pick the stack that fits the problem, not the other way around.",
  },
  {
    q: "Do you offer ongoing support?",
    a: "Yes, via monthly retainers. Ship continuously, get bug fixes and iterations, cancel any time.",
  },
];

export function FAQ() {
  return (
    <section className="border-b border-border/60">
      <div className="mx-auto max-w-3xl px-6 py-20 md:py-28">
        <div className="mb-10 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand">FAQ</p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Questions, answered.
          </h2>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {faqs.map((f, i) => (
            <AccordionItem
              key={f.q}
              value={`item-${i}`}
              className="border-border/70"
            >
              <AccordionTrigger className="py-5 text-left text-[15px] font-medium hover:no-underline">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="pb-5 text-sm leading-relaxed text-muted-foreground">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
