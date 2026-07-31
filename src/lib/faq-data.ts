// Plain data, no components: the homepage route imports this for FAQPage JSON-LD
// without pulling the accordion (and Radix) into the critical bundle.
//
// These answers are also emitted as structured data, so they are public factual
// claims. The studio is new: do not write answers that imply an existing client
// base ("most clients do X", "we do this often") until that is actually true.
export const faqs = [
  {
    q: "How long does a project take?",
    a: "Depends on what you're building. A landing page is usually two to three weeks. A real web app or internal tool is closer to six to twelve weeks. Because I build with AI coding agents, the early parts move fast, and we still review everything before it ships. After our first call I can give you a tighter number for your specific project.",
  },
  {
    q: "Do you use AI to write the code?",
    a: "Yes. I use AI coding agents to handle scaffolding, tests, and repetitive work, then review, refine, and ship everything myself. You still get one person responsible for the outcome. The AI makes me faster; it doesn't replace the thinking.",
  },
  {
    q: "What does 'vibe coding' mean here?",
    a: "It means I describe what the software should do in plain language, and AI coding agents generate the code, tests, and migrations. Then I read it, run it, fix what's wrong, and tune it until it works. It's not random experimentation on your dime; it's a deliberate way to move fast without skipping the human review.",
  },
  {
    q: "What do I actually receive when the project is done?",
    a: "You get the source code, a working deployment, and a handoff walkthrough. For most projects that includes a repository you can keep, a staging environment, and written notes on how the system works. If you want to host it yourself, we'll set it up on your infrastructure. If you want us to keep running it, we can do that too.",
  },
  {
    q: "What do you not automate?",
    a: "The important parts. I don't let AI make architecture decisions, choose your stack, or design the user experience. I don't automate security review, client communication, or the final sign-off. AI writes a lot of code; I decide what ships, and I talk to you directly if something isn't working.",
  },
  {
    q: "Can you build from just an idea?",
    a: "Yes, and that's the way I prefer to start. You bring the context of your business and what you're trying to solve. I handle turning it into scope, screens, and code. You don't need a spec doc or wireframes.",
  },
  {
    q: "Do I need technical knowledge?",
    a: "No. You don't need to have ever opened a code editor. My job is to translate what you know about your business into the software, and to show you progress every week in a way that makes sense.",
  },
  {
    q: "Can you improve existing software?",
    a: "Yes. That might mean picking up a project a previous developer left half-finished, or adding features to something that works but is showing its age. I'll take a look and tell you honestly whether it's worth fixing or worth rebuilding.",
  },
  {
    q: "What technologies do you use?",
    a: "Mostly React, Next.js, and TypeScript on the front end, Postgres on the back end, plus AI agent workflows and LLM integrations where they fit. We pick the stack based on what you're building, not what's trendy that quarter.",
  },
  {
    q: "Do you offer ongoing support?",
    a: "Yes. Every project includes a support window after launch, and you can move onto a monthly retainer if you want features shipped continuously rather than in one-off projects. Retainers can be paused or cancelled with 30 days' notice.",
  },
];
