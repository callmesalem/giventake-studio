## Goal

Make it clear that GivenTake Goods Devs is an AI-native development studio where software is built with AI coding agents and "vibe coding" workflows. Keep the honest founder voice, avoid hype terms like "unlock" or "autonomous AI," and update every section where a visitor would reasonably expect to see this positioning.

## Key message

"One developer + AI agents shipping faster than a traditional team." This is the framing we'll use instead of hiding the AI angle or pretending it's a conventional agency.

## Copy changes

### 1. Hero — headline and subhead

- **LIVE pill** stays "Booking projects for 2026" but add a small secondary line or keep it.
- **Subhead** becomes:
  "I'm a solo developer who builds with AI coding agents and modern tools. You get the speed of a small team without the overhead of hiring one. Tell me what you need. A few weeks later, you're using it."
- **CTAs** stay: "Start a project" and "See the work".
- **Honest status line** adds one line about the method:
  "New studio, taking on our first commissions of 2026. AI-assisted delivery means faster prototypes and fewer handoffs."

### 2. Trusted partner band — add the AI-native angle

Replace the current four facts with:

- "AI-assisted delivery" / "Faster builds, fewer meetings"
- "Founder-led" / "Every project"
- "Weeks, not quarters" / "Typical timeline"
- "You own the code" / "No lock-in"

### 3. Who we help — keep audiences, add AI framing

- **Small businesses**: mention that AI tools can integrate their existing stack without a full engineering hire.
- **Founders**: add that the AI-native workflow means MVPs ship in weeks, not months.
- **Growing companies**: note that agentic workflows can fill gaps between hires.

### 4. Services — add "Agentic systems" as a service

Add an eighth service card at the top or near the top:

- **Title:** "Agentic systems & AI workflows"
- **Body:** "Custom AI agents that handle intake, research, drafting, or routing. Built to plug into your existing tools, not replace your team."
- **Icon:** a simple bot/agent glyph (or reuse `IconSpark` if no new icon is needed).

Reframe the existing "AI integrations" copy to be more specific:
- **Body:** "LLM-powered features wired into your product: summarization, extraction, search, and routing. We skip the demo and ship the workflow."

### 5. How it works — add an AI step

Insert a fourth step between "We design and build" and "Launch and iterate" (or fold into step 2):

- **Step 2b (optional):** "AI agents do the heavy lifting"
  "Code generation, tests, and repetitive tasks are handled by AI agents. I review, refine, and ship. You get quality code without the traditional agency clock."

Or, simpler: rewrite step 2 to include it:
- **Step 2:** "We design and build with AI"
  "I use AI coding agents and modern frameworks to move fast. You see progress every week. Real screens, real data, real code. If something isn't landing, we catch it early."

### 6. Work — reframe the examples as AI-built projects

Update the section intro:
- **H2:** "Built with AI agents, reviewed by a human."
- **Body:** "These are the kinds of projects we ship. AI handles the repetitive parts; I handle architecture, review, and delivery."

Reframe the project cards:
- **AI intake tool** already fits — make it the lead example and mention it's an agentic workflow.
- **Booking system** and **dashboard** can note "shipped in weeks with AI-assisted development."
- **Marketing site** can mention "AI-assisted content and code, fully editable by your team."

Add tags where appropriate: "AI Agents", "LLM Workflows", "Vibe Coding".

### 7. Pricing — keep tiers, add AI speed angle

- **Starter:** "AI-assisted build" in features, keep timeline "Live in two to three weeks."
- **Growth:** "AI agents + custom code for the parts that matter."
- **Dedicated:** "A retained AI-native team. Continuous shipping without the overhead."

### 8. Founder note — explain the AI-native approach honestly

Add a paragraph to the founder note:

"I build with AI coding agents and modern tools. That means I can prototype faster, write less boilerplate, and spend more time on the parts that actually need judgment: architecture, UX, and making sure the thing solves your problem. It's not magic, and it's not a replacement for thinking. It's just a better way to ship."

### 9. FAQ — add one AI-specific question, tweak others

Add:
- **Q:** "Do you use AI to write the code?"
- **A:** "Yes. I use AI coding agents to handle scaffolding, tests, and repetitive work, then review, refine, and ship everything myself. You still get one person responsible for the outcome."

Update the technologies FAQ to mention agentic tools:
- "Mostly React, Next.js, TypeScript, and Postgres, plus AI agent workflows and LLM integrations where they fit. We pick the stack based on the problem, not the trend."

### 10. Contact form — add a field or placeholder hint

- In the project description placeholder, hint at AI/agentic work: "What are you building? Mention if you want AI automation, an internal agent, or a traditional web app."
- Keep the form logic unchanged.

### 11. Footer / meta — minor SEO update

- **Footer tagline:** "Your on-demand, AI-native development team."
- **SEO title/description in `src/routes/index.tsx`:** update to include "AI-native" and "agentic development" without keyword stuffing.
  - Title: "GivenTake Goods Devs | AI-Native Development Team for Hire"
  - Description: "AI-native development studio building websites, apps, internal tools, and agentic workflows for small businesses and founders. One developer, AI-assisted delivery."

## Files to change

- `src/routes/index.tsx` — SEO meta
- `src/components/sections/hero.tsx` — headline area, subhead, status line
- `src/components/sections/trusted.tsx` — facts band
- `src/components/sections/who.tsx` — audience cards
- `src/components/sections/services.tsx` — add agentic service, reframe AI copy
- `src/components/sections/how.tsx` — process step copy
- `src/components/sections/work.tsx` — section intro and project framing
- `src/components/sections/pricing.tsx` — feature bullets
- `src/components/sections/testimonials.tsx` — founder note
- `src/components/sections/faq.tsx` — add AI question, update tech answer
- `src/components/sections/contact.tsx` — placeholder text
- `src/components/site-chrome.tsx` — footer tagline

## Out of scope

- No new design system or layout changes.
- No new dependencies or components.
- No changes to the consent, tracking, or legal pages.
- No changes to form submission logic or contact email.

## Verification

After edits, run a quick site scan to confirm all sections read consistently, no broken imports, and the new service card renders correctly on mobile and desktop.