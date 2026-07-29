import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  { q: "How long does a project take?", a: "Depends on what you're building. A landing page is usually two to three weeks. A real web app or internal tool is closer to six to twelve weeks. After our first call I can give you a tighter number for your specific project." },
  { q: "Can you build from just an idea?", a: "Yeah, that's how most of our projects start. You bring the context of your business and what you're trying to solve. We handle turning it into scope, screens, and code. You don't need a spec doc or wireframes." },
  { q: "Do I need technical knowledge?", a: "No. Honestly, some of my favorite clients have never opened a code editor. My job is to translate what you know about your business into the software, and to show you progress every week in a way that makes sense." },
  { q: "Can you improve existing software?", a: "Yes, and we do it often. Sometimes it's picking up a project a previous developer left half-finished. Sometimes it's adding features to something that's working but showing its age. We'll take a look and tell you honestly whether it's worth fixing or worth rebuilding." },
  { q: "What technologies do you use?", a: "Mostly React, Next.js, and TypeScript on the front end, Postgres on the back end, plus whatever AI or automation tooling makes sense for the problem. We pick the stack based on what you're building, not what's trendy that quarter." },
  { q: "Do you offer ongoing support?", a: "Yes. Most clients keep us on a monthly retainer after launch, so we can keep shipping features, fix things, and adjust as they learn more from users. You can pause or cancel with 30 days' notice." },
];

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
