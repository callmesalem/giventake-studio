import { Reveal } from "@/components/reveal";
import { IconArrowRight } from "@/components/marks";
import { CaseStudies } from "@/components/sections/case-studies";

/**
 * Real projects only. The tiles below are abstract illustrations, not
 * screenshots, so nothing here implies a UI that does not exist. Detail and
 * verified figures live in the case studies underneath.
 */
const commissions = [
  {
    title: "A claims platform a firm runs on daily",
    kind: "Live product",
    body: "Claims, documents, email, e-signature, client portal and books in one system. AI reads carrier estimates and pulls the numbers off them. Live in production and still shipping.",
    tags: ["React", "Postgres", "AI documents"],
    preview: "dashboard",
  },
  {
    title: "AI that analyses an insurance policy",
    kind: "AI application",
    body: "Upload a policy, add the claim facts, get a coverage analysis with a citation on every finding. Detects scanned documents and reroutes them through OCR automatically.",
    tags: ["AI pipeline", "OCR", "Next.js"],
    preview: "intake",
  },
  {
    title: "Documents turned into narrated audio",
    kind: "Product build",
    body: "Upload a PDF, DOCX or EPUB, paste text, or share a link, then listen to it as narration split into chapters. Pick a voice, bookmark where you stopped, and keep a library of past sessions. Installs from the browser as an app.",
    tags: ["TypeScript", "Supabase", "OpenAI TTS"],
    preview: "calendar",
  },
  {
    title: "A one-page site for a local deli",
    kind: "Website",
    body: "Full menu, catering tiers and real opening hours on a single page with no framework and no build step. Marked up for local search so it can show up in Maps.",
    tags: ["No framework", "Local SEO", "Fast"],
    preview: "site",
  },
];

function Preview({ kind }: { kind: string }) {
  if (kind === "calendar") {
    return (
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 21 }).map((_, i) => (
          <div
            key={i}
            className={`aspect-square rounded ${
              i === 10 ? "bg-ink" : i === 11 || i === 15 ? "bg-violet" : "bg-white/70"
            }`}
          />
        ))}
      </div>
    );
  }
  if (kind === "dashboard") {
    return (
      <div className="flex h-full flex-col justify-end gap-3">
        <div className="grid grid-cols-3 gap-2">
          {["24", "12", "$18k"].map((v) => (
            <div
              key={v}
              className="rounded-lg bg-white/80 px-2 py-1.5 text-center text-[13px] font-semibold text-ink"
            >
              {v}
            </div>
          ))}
        </div>
        <div className="flex h-16 items-end gap-1">
          {[40, 60, 45, 72, 55, 82, 68, 90, 74, 88].map((h, i) => (
            <div
              key={i}
              className={`flex-1 rounded-t ${i === 9 ? "bg-ink" : "bg-white/70"}`}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
    );
  }
  if (kind === "intake") {
    return (
      <div className="space-y-2">
        {[
          { n: "A", t: "New enquiry · MVP scope", c: "bg-violet-soft text-violet" },
          { n: "B", t: "New enquiry · Internal tool", c: "bg-emerald-50 text-emerald-700" },
          { n: "C", t: "New enquiry · Retainer", c: "bg-amber-50 text-amber-700" },
        ].map((r) => (
          <div key={r.n} className="flex items-center gap-2 rounded-lg bg-white/80 px-2 py-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-semibold ${r.c}`}
            >
              {r.n}
            </div>
            <span className="truncate text-[12px] font-medium text-ink">{r.t}</span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="h-3 w-2/3 rounded bg-white/80" />
      <div className="h-2 w-full rounded bg-white/60" />
      <div className="h-2 w-5/6 rounded bg-white/60" />
      <div className="mt-2 grid grid-cols-3 gap-2">
        <div className="h-12 rounded-lg bg-white/70" />
        <div className="h-12 rounded-lg bg-white/70" />
        <div className="h-12 rounded-lg bg-white/70" />
      </div>
    </div>
  );
}

const bgTint: Record<string, string> = {
  calendar: "bg-gradient-to-br from-violet-100 to-indigo-100",
  dashboard: "bg-gradient-to-br from-emerald-100 to-teal-100",
  intake: "bg-gradient-to-br from-amber-50 to-rose-100",
  site: "bg-gradient-to-br from-slate-100 to-zinc-200",
};

export function Work() {
  return (
    <section id="work" className="border-b border-hairline bg-secondary/50">
      <div className="mx-auto max-w-7xl px-6 py-24 md:py-28">
        <Reveal className="mb-14 max-w-2xl">
          <p className="text-[13px] font-medium text-violet">Work</p>
          <h2 className="mt-3 font-display text-4xl font-medium leading-[1.02] tracking-[-0.03em] text-ink md:text-5xl">
            Built with AI agents, reviewed by a human.
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-muted-ink">
            Four systems I have actually built. AI handled the repetitive parts; I owned the
            architecture, the data model, and every decision that costs money to get wrong.
          </p>
        </Reveal>

        <div className="grid gap-4 md:grid-cols-2">
          {commissions.map((p, i) => (
            <Reveal key={p.title} delay={i * 80}>
              <article className="card-lift group flex h-full flex-col overflow-hidden rounded-2xl border border-hairline bg-white">
                <div
                  className={`relative h-56 overflow-hidden border-b border-hairline p-6 ${bgTint[p.preview]}`}
                >
                  <div className="absolute left-5 top-5 inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-ink backdrop-blur">
                    {p.kind}
                  </div>
                  <div className="mt-10 h-full">
                    <Preview kind={p.preview} />
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="text-[20px] font-semibold tracking-tight text-ink">{p.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted-ink">{p.body}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {p.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-hairline bg-secondary px-2.5 py-1 text-[11px] font-medium text-ink"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <a
                    href="#contact"
                    className="btn-icon-nudge mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-violet transition group-hover:gap-2.5"
                  >
                    Commission this
                    <IconArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal delay={120}>
          <CaseStudies />
        </Reveal>
      </div>
    </section>
  );
}
