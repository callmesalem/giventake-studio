import { IconBriefcase, IconSeed, IconTrend } from "@/components/marks";

const cards = [
  {
    Icon: IconBriefcase,
    title: "Small businesses",
    body: "You're running the business on a stack of tools that don't really talk to each other. We replace the duct tape with AI-assisted software that fits how your team actually works, without hiring a full engineer.",
  },
  {
    Icon: IconSeed,
    title: "Founders",
    body: "You have paying customers and a clear idea. What you don't have is a year to find a technical co-founder. Our AI-native workflow gets an MVP in front of users in weeks, not months.",
  },
  {
    Icon: IconTrend,
    title: "Growing companies",
    body: "Your roadmap is longer than your engineering team. We plug in with agentic workflows and custom code for the next quarter of shipping, then step back once it's out the door.",
  },
];

export function WhoWeHelp() {
  return (
    <section id="who" className="border-b border-hairline">
      <div className="mx-auto max-w-7xl px-6 py-24 md:py-28">
        <div className="mb-14 max-w-2xl">
          <p className="text-[13px] font-medium text-violet">Who we help</p>
          <h2 className="mt-3 font-display text-4xl font-medium leading-[1.02] tracking-[-0.03em] text-ink md:text-5xl">
            You focus on the business. We build the technology.
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-muted-ink">
            One team doing the work you'd normally split across five or six freelancers. One point of contact, one system that fits together.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {cards.map((c) => (
            <article
              key={c.title}
              className="group rounded-2xl border border-hairline bg-white p-7 shadow-soft transition hover:shadow-lift"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-soft text-violet">
                <c.Icon className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-[22px] font-semibold tracking-tight text-ink">
                {c.title}
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-ink">{c.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
