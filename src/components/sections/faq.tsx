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
