export type PlaybookStage = {
  id: number;
  name: string;
  goal: string;
  gate: string;
  artifact: string;
  prompt: string;
  actions: string[];
};

export const SALES_STAGES: PlaybookStage[] = [
  {
    id: 0,
    name: "Lead arrives",
    goal: "Capture the opportunity without losing context.",
    gate: "Lead record is complete.",
    artifact: "Lead record",
    prompt:
      "Thanks for reaching out. Before we schedule time, what are you trying to build or fix, and what is making it important now?",
    actions: [
      "Confirm contact details and lead source",
      "Record the problem in the prospect's words",
      "Book the free 30-minute call",
    ],
  },
  {
    id: 1,
    name: "Qualify",
    goal: "Confirm a real problem, plausible budget, timing, and authority.",
    gate: "Budget and fit are plausible.",
    artifact: "Qualification note",
    prompt: "Walk me through what happens if this problem stays unsolved for the next six months.",
    actions: [
      "Ask what happens if they do nothing",
      "Confirm budget range and timeline driver",
      "Identify the decision-maker",
      "Decline cleanly if the fit is wrong",
    ],
  },
  {
    id: 2,
    name: "Discovery",
    goal: "Understand and quantify the current process before proposing a solution.",
    gate: "You can explain their process step by step with numbers.",
    artifact: "Discovery notes + same-day summary",
    prompt:
      "Walk me through the last real time this happened, from start to finish. Who touched it, how long did it take, and where did it break down?",
    actions: [
      "Use concrete recent examples",
      "Quantify frequency, time, errors, and cost",
      "Do not design or quote on the call",
      "Send a same-day 'did I get this right?' summary",
    ],
  },
  {
    id: 3,
    name: "Scope",
    goal: "Turn the verified problem into an objective, bounded engagement.",
    gate: "Proposal and SOW are complete.",
    artifact: "Proposal + SOW",
    prompt:
      "I want to think through the right approach rather than throw out a number on the call. I’ll send a written recommendation with scope, timeline, and price.",
    actions: [
      "Write the problem in their words",
      "Define inclusions and exclusions",
      "Make acceptance criteria testable",
      "Mark client dependencies",
      "Use paid discovery for ambiguity",
    ],
  },
  {
    id: 4,
    name: "Close",
    goal: "Reach a clear decision without promising beyond the written scope.",
    gate: "MSA and SOW signed; deposit cleared.",
    artifact: "Signed MSA/SOW + deposit",
    prompt:
      "The scope is designed around the outcome we agreed on. What would prevent you from moving forward with it?",
    actions: [
      "Send the AI-use disclosure proactively",
      "Handle the real objection, not a discount reflex",
      "Never begin code before signature and payment",
      "Record the decision and next step",
    ],
  },
  {
    id: 5,
    name: "Kickoff",
    goal: "Create the operating conditions and baseline for delivery.",
    gate: "Access is granted and baseline is recorded.",
    artifact: "Kickoff note + baseline",
    prompt:
      "Before we change anything, let’s record how the process performs today so we can prove what improved.",
    actions: [
      "Confirm one decision-maker",
      "Collect access securely",
      "Schedule the recurring weekly demo",
      "Measure time, volume, errors, people, and cost",
    ],
  },
  {
    id: 6,
    name: "Build cycles",
    goal: "Keep the expectation gap no wider than one week.",
    gate: "Client sees working software every week.",
    artifact: "Working demo + written update",
    prompt:
      "Here is what is working this week, what comes next, what we need from you, and what could affect the timeline.",
    actions: [
      "Demo working software weekly",
      "Send a written update",
      "Document client delays",
      "Use a written change order for scope changes",
    ],
  },
  {
    id: 7,
    name: "Delivery review",
    goal: "Verify quality, security, and contractual promises before release.",
    gate: "Human review checklist is complete.",
    artifact: "Delivery review checklist",
    prompt:
      "We are at the delivery review gate. Nothing ships until the critical paths, security checks, dependencies, and acceptance criteria pass.",
    actions: [
      "Review auth, authorization, and payments line by line",
      "Run critical-path tests",
      "Check secrets, licenses, SBOM, and vulnerabilities",
      "Save the completed checklist",
    ],
  },
  {
    id: 8,
    name: "Acceptance",
    goal: "Test against the SOW, not a new verbal standard.",
    gate: "Written acceptance is received.",
    artifact: "Acceptance record",
    prompt:
      "Please review the build against the acceptance criteria in the SOW. Report any material defect in writing during the acceptance window.",
    actions: [
      "Test each acceptance criterion",
      "Fix qualifying defects",
      "Route additions through change control",
      "Get acceptance in writing",
    ],
  },
  {
    id: 9,
    name: "Handoff",
    goal: "Leave the client able to operate what they own.",
    gate: "Handoff package is delivered and access is reduced.",
    artifact: "Code, docs, recording, access record",
    prompt:
      "You now have the code, documentation, walkthrough, and operating access. We’ll confirm our access has been removed or reduced in writing.",
    actions: [
      "Transfer source and deployment access",
      "Deliver written docs and recorded walkthrough",
      "Deliver SBOM/license report",
      "Reduce GivenTake access",
    ],
  },
  {
    id: 10,
    name: "Support",
    goal: "Resolve defects and identify legitimate ongoing needs.",
    gate: "Window expires or converts to ongoing support.",
    artifact: "Support log",
    prompt:
      "I’ve logged this request. I’ll confirm whether it is a defect covered by the 30 days of post-launch support, something the $99/mo care plan covers, or new work that needs a written quote, before work begins.",
    actions: [
      "Log every request",
      "Classify defect vs new scope",
      "Track response and resolution time",
      "Offer ongoing support when the pattern proves the need",
    ],
  },
  {
    id: 11,
    name: "Retro",
    goal: "Turn delivery into learning, evidence, and referrals.",
    gate: "Metrics and lessons are recorded.",
    artifact: "Retro + testimonial + case-study metrics",
    prompt:
      "Now that the project is live, I’d like to compare the baseline with the result and capture what worked, what we should improve, and what you would tell another owner considering us.",
    actions: [
      "Compare before-and-after metrics",
      "Record delivery lessons",
      "Request testimonial and referral",
      "Confirm case-study permission",
    ],
  },
];

export const OFFERS = [
  {
    name: "Marketing website",
    price: "From $499",
    timeline: "2–4 weeks",
    fit: "A credible, conversion-focused public presence with clear content and lead capture.",
  },
  {
    name: "AI lead intake",
    price: "From $4,500",
    timeline: "3–5 weeks",
    fit: "Qualify, route, and follow up with inbound leads while preserving human review.",
  },
  {
    name: "Booking + payments",
    price: "From $5,000",
    timeline: "4–6 weeks",
    fit: "Reduce scheduling friction and collect payment through a defined customer flow.",
  },
  {
    name: "Internal dashboard",
    price: "From $6,000",
    timeline: "4–8 weeks",
    fit: "Replace fragmented spreadsheets and manual status chasing with one operating view.",
  },
  {
    name: "Website care plan",
    price: "$99/mo",
    timeline: "Starts at launch",
    fit: "Optional, cancel anytime: hosting, security updates, backups, uptime monitoring, a few small content edits a month, and the monthly proof report. New pages, new features, and redesigns are quoted separately as project work.",
  },
];

export const OBJECTIONS = [
  {
    title: "Your price is too high",
    response:
      "Compared with which alternative: leaving the problem in place, hiring internally, or another proposal? I want to understand what you are comparing before changing scope.",
  },
  {
    title: "I need to think about it",
    response:
      "Of course. What specifically do you need to become comfortable with: the outcome, timing, price, or confidence in us?",
  },
  {
    title: "Why not hire an employee?",
    response:
      "An employee can be the right long-term answer. We are useful when you need a defined outcome now without recruiting, managing, and carrying a full development team.",
  },
  {
    title: "AI-built software sounds risky",
    response:
      "We use AI to accelerate implementation, not to remove accountability. Humans own architecture, security review, testing, and the delivery gate, and our AI-use disclosure explains the controls in writing.",
  },
  {
    title: "Can you start before the paperwork?",
    response:
      "We can reserve a start window, but work begins only after the SOW is signed and the deposit clears. That protects the scope and expectations for both sides.",
  },
];

export const GUARDRAILS = [
  "Never quote a custom project live on a call.",
  "Never promise functionality, integrations, or dates outside the written SOW.",
  "Never begin work before the agreement is signed and the deposit clears.",
  "Never hide GivenTake's use of AI or make unsupported performance claims.",
  "Never accept a scope change verbally. Use a written change order.",
  "Never place client credentials, private code, or identifying data into an unapproved tool.",
  "Never contact a prospect through text without documented consent.",
];
