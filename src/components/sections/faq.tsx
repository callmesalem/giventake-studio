import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  { q: "How long does a project take?", a: "Most landing pages ship in 2 to 3 weeks. Custom apps and automations typically run 6 to 12 weeks. We share a firm timeline after the strategy call." },
  { q: "Can you build from just an idea?", a: "Yes. Most engagements start from a rough idea or a spreadsheet. We turn it into scope, then a working product. You don't need to speak engineer." },
  { q: "Do I need technical knowledge?", a: "None required. You bring the business context, we bring the technology. Weekly demos keep you in the loop without needing to read code." },
  { q: "Can you improve existing software?", a: "Yes. We regularly take over half-finished projects, add features, fix performance, and modernize legacy stacks." },
  { q: "What technologies do you use?", a: "React, Next.js, TypeScript, Postgres, and modern AI tooling. We pick the stack that fits the problem, not the other way around." },
  { q: "Do you offer ongoing support?", a: "Yes, through monthly retainers. Ship continuously, get bug fixes and iterations, cancel any time." },
];

export function FAQ() {
  return (
    <section className="border-b border-ink/80">
      <div className="mx-auto max-w-7xl px-6 py-20 md:py-28">
        <div className="mb-14 grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-5">
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-copper">
              № 09 / The Answers
            </span>
            <h2 className="mt-6 font-display text-4xl font-light leading-[1] tracking-[-0.02em] text-ink md:text-6xl">
              Questions,
              <br />
              <span className="italic">answered.</span>
            </h2>
          </div>
          <div className="col-span-12 lg:col-span-6 lg:col-start-7">
            <Accordion type="single" collapsible className="w-full border-t border-ink">
              {faqs.map((f, i) => (
                <AccordionItem key={f.q} value={`item-${i}`} className="border-b border-ink/30">
                  <AccordionTrigger className="py-6 text-left font-display text-xl font-normal leading-tight text-ink hover:no-underline">
                    <span className="flex items-baseline gap-4">
                      <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-copper">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>{f.q}</span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-6 pl-11 text-[15px] leading-relaxed text-ink/70">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </div>
    </section>
  );
}
