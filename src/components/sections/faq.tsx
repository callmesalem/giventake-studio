import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { faqs } from "@/lib/faq-data";


export function FAQ() {
  return (
    <section className="border-b border-hairline">
      <div className="mx-auto max-w-7xl px-6 py-24 md:py-28">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="text-[13px] font-medium text-violet">FAQ</p>
            <h2 className="mt-3 font-display text-4xl font-medium leading-[1.02] tracking-[-0.03em] text-ink md:text-5xl">
              Questions, answered.
            </h2>
            <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-muted-ink">
              Still on the fence? Book a 30-minute call. No pitch, no pressure.
            </p>
          </div>
          <div>
            <Accordion type="single" collapsible className="w-full space-y-3">
              {faqs.map((f, i) => (
                <AccordionItem
                  key={f.q}
                  value={`item-${i}`}
                  className="rounded-2xl border border-hairline bg-white px-5 shadow-soft"
                >
                  <AccordionTrigger className="py-5 text-left text-[16px] font-semibold text-ink hover:no-underline">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="pb-5 text-[15px] leading-relaxed text-muted-ink">
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
