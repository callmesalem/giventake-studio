/**
 * Productized offers — one entry per page at /services/<slug>.
 *
 * These are the backbone of the acquisition plan (docs/business/08 §4): each
 * one is simultaneously an SEO target, a cold-email offer, a referral
 * leave-behind, and a sales tool. That only works if each has a real price, a
 * real timeline, and an explicit exclusion list.
 *
 * Truthfulness rules for this file, same as everywhere else on the site:
 *   - No outcome metrics ("saves 10 hours a week") without a delivered project
 *     and written permission to publish the numbers.
 *   - "From" prices must be prices you'd actually honour.
 *   - The `excludes` list is not optional. It prevents more scope disputes than
 *     any other copy on the site, and it pre-qualifies the buyer.
 */

export type Offer = {
  slug: string;
  /** Card + hero title. */
  title: string;
  /** One line under the title. */
  tagline: string;
  /** <title> and OG title. */
  metaTitle: string;
  metaDescription: string;
  priceFrom: string;
  timeline: string;
  /** The problem, in the buyer's words. */
  problem: string[];
  /** What the system does. */
  outcome: string;
  includes: string[];
  excludes: string[];
  /** Discovery prompts shown as "questions we'll ask" — signals process. */
  questions: string[];
  goodFit: string;
};

export const offers: Offer[] = [
  {
    slug: "internal-dashboard",
    title: "Replace your spreadsheets with one dashboard",
    tagline: "Job status, invoices, and numbers in one place instead of five files.",
    metaTitle: "Internal Dashboard Development | Replace Spreadsheets · GivenTake Devs",
    metaDescription:
      "Custom internal dashboards that replace shared spreadsheets with one source of truth. Fixed price from $6,000, live in about four weeks.",
    priceFrom: "From $6,000",
    timeline: "About 4 weeks",
    problem: [
      "Job status, invoices, and client notes live across several shared spreadsheets.",
      "Nobody fully trusts the numbers, because two files disagree and no one knows which is current.",
      "Someone spends an evening a week reconciling by hand.",
      "You can't answer a simple question about the business without opening four tabs.",
    ],
    outcome:
      "One dashboard reading from one data model, showing live status, invoices, and the numbers you actually run the business on. Role-based access so the right people see the right things.",
    includes: [
      "A single data model behind every view",
      "Live status, invoice, and revenue tracking",
      "Role-based access for staff and owner",
      "Migration of your existing spreadsheet data",
      "Every calculated field verified against your real numbers",
      "Automated tests on the paths that matter",
      "Source code, documentation, and a recorded walkthrough",
      "60 days of support after launch",
    ],
    excludes: [
      "Ongoing hosting and third-party subscription costs",
      "Integrations not identified during scoping",
      "Historical data older than what you provide at kickoff",
      "Native mobile apps (the dashboard is mobile-responsive)",
      "Training beyond the handoff walkthrough",
    ],
    questions: [
      "Who opens this, how often, and what decision are they making with it?",
      "Where does the data live now, and who owns it?",
      "How current does it need to be: live, hourly, daily?",
      "What's the one number that would change how you run the business if it were always visible?",
    ],
    goodFit:
      "You have a working business and a data problem, not a software problem. If your spreadsheets are load-bearing and you're afraid to touch them, this is the build.",
  },
  {
    slug: "ai-lead-intake",
    title: "AI lead intake and routing",
    tagline: "Enquiries read, classified, and routed before anyone opens the inbox.",
    metaTitle: "AI Lead Intake & Routing Automation | GivenTake Devs",
    metaDescription:
      "A custom AI agent that reads incoming enquiries, classifies intent, and routes them to the right person. Fixed price from $4,500, live in about three weeks.",
    priceFrom: "From $4,500",
    timeline: "About 3 weeks",
    problem: [
      "Enquiries arrive as unstructured email and form submissions.",
      "Someone has to read every one, work out what it is, and forward it manually.",
      "Response times slip into days, and the good leads go cold first.",
      "Nobody can tell you how many enquiries came in last month, or what they were about.",
    ],
    outcome:
      "An AI agent reads each enquiry, classifies intent and urgency, routes it to the right person or channel, and posts a structured summary instead of a raw forward. Low-confidence cases go to a human queue rather than being guessed at.",
    includes: [
      "Parsing of email and web-form submissions",
      "Intent and urgency classification tuned to your business",
      "Routing rules written and owned by a human, not the model",
      "A review queue for anything the system isn't confident about",
      "Structured summaries posted to Slack, email, or your CRM",
      "Reporting on volume and category",
      "Source code, documentation, and a recorded walkthrough",
      "60 days of support after launch",
    ],
    excludes: [
      "Model and API usage costs (billed to you at cost, typically modest)",
      "A CRM, if you don't already have one",
      "Automated replies to customers unless explicitly scoped",
      "Integrations not identified during scoping",
    ],
    questions: [
      "What starts the process: an email, a form, a phone call?",
      "What decision is the automation making, and what are the possible outcomes?",
      "How often is a human wrong at this today?",
      "What should happen when the system isn't confident: queue it, take a safe default, or escalate?",
    ],
    goodFit:
      "You get enough enquiries that sorting them is a real job, and they're varied enough that a simple rule wouldn't work. Under roughly twenty a week, a person is still cheaper, and we'll tell you so.",
  },
  {
    slug: "booking-and-payments",
    title: "Booking and payments for service businesses",
    tagline: "Customers book, pay, and reschedule themselves.",
    metaTitle: "Booking & Payment System Development | GivenTake Devs",
    metaDescription:
      "Custom self-service booking with deposits, reminders, and rescheduling for service businesses. Fixed price from $5,000, live in three to four weeks.",
    priceFrom: "From $5,000",
    timeline: "3–4 weeks",
    problem: [
      "Customers book by phone or DM, so someone has to be available to answer.",
      "Availability goes out by hand and the diary lives in one person's head.",
      "Deposits get chased, or skipped, and no-shows cost real money.",
      "Nobody can see the week at a glance without asking.",
    ],
    outcome:
      "Customers pick a slot, pay or leave a deposit, and reschedule themselves within your rules. You see one shared schedule and get paid before the appointment starts.",
    includes: [
      "Self-service booking, rescheduling, and cancellation",
      "Deposit or full payment at time of booking",
      "Cancellation and refund rules you define",
      "Automated confirmations and reminders",
      "Calendar sync for your team",
      "One shared view of the schedule",
      "Payment flow tested end to end by hand before launch",
      "Source code, documentation, and a recorded walkthrough",
      "60 days of support after launch",
    ],
    excludes: [
      "Payment processor fees, and their account approval",
      "Ongoing hosting and subscription costs",
      "SMS costs, where reminders go by text",
      "Complex multi-location routing unless scoped",
    ],
    questions: [
      "Who books today, and how?",
      "Deposits, full payment, or pay later?",
      "What's your cancellation policy, and who can override it?",
      "What happens on a no-show right now?",
    ],
    goodFit:
      "You're a service business losing time to scheduling admin and money to no-shows. Payment is handled by a hosted provider, so card details never touch your systems or ours.",
  },
  {
    slug: "marketing-site",
    title: "A marketing site your team can actually update",
    tagline: "A site that reflects what the business does now, with a CMS behind it.",
    metaTitle: "Marketing Website Development with CMS | GivenTake Devs",
    metaDescription:
      "Fast, accessible marketing sites with a CMS your team can edit without a developer. Fixed price from $2,500, live in two to three weeks.",
    priceFrom: "From $2,500",
    timeline: "2–3 weeks",
    problem: [
      "The current site describes a business you no longer are.",
      "Every change needs a developer, so changes don't happen.",
      "It's slow on a phone, and you suspect that's costing you.",
      "You're not sure it's bringing in anything at all.",
    ],
    outcome:
      "A fast, accessible site built around one clear action for the visitor, with a CMS your team can edit without touching code.",
    includes: [
      "Design and build, mobile-first",
      "CMS your team can edit",
      "Accessibility built in, not bolted on",
      "Performance and technical SEO fundamentals",
      "Redirects mapped if we're replacing an existing site",
      "Analytics with a compliant cookie consent banner",
      "Source code, documentation, and a recorded walkthrough",
      "30 days of tweaks after launch",
    ],
    excludes: [
      "Copywriting and content production unless scoped",
      "Photography, illustration, and licensed stock",
      "Brand identity design: we work to your existing brand",
      "Ongoing SEO strategy beyond technical fundamentals",
      "Domain, hosting, and subscription costs",
    ],
    questions: [
      "What's the one action a visitor should take?",
      "What's failing now: traffic, conversion, or that you can't update it?",
      "Who needs to edit it, and how comfortable are they with software?",
      "Are we replacing an existing site? (Redirects are where SEO usually gets destroyed.)",
    ],
    goodFit:
      "You need a working site quickly and you'd rather own it than rent a page builder. If you need brand strategy and a content programme, that's a different engagement and we'll say so.",
  },
  {
    slug: "business-automation",
    title: "Automate the process eating your week",
    tagline: "The repetitive thing someone does by hand every day, done by software.",
    metaTitle: "Business Process Automation Development | GivenTake Devs",
    metaDescription:
      "Custom automation for the repetitive manual processes running your business: data re-entry, document assembly, status chasing. Fixed price from $4,000.",
    priceFrom: "From $4,000",
    timeline: "2–4 weeks",
    problem: [
      "The same information gets typed into two or three systems.",
      "Someone assembles the same document from the same sources every time.",
      "Chasing status takes longer than doing the work.",
      "It only works because one person remembers all the steps.",
    ],
    outcome:
      "The repetitive path runs on its own, with a human checkpoint where judgement is genuinely needed and a clear record of what ran and what didn't.",
    includes: [
      "Mapping your current process end to end before anything is built",
      "Automation of the repetitive path",
      "Human checkpoints where judgement is required",
      "Error handling and alerting when something fails",
      "A log of what ran, so you can audit it",
      "Source code, documentation, and a recorded walkthrough",
      "60 days of support after launch",
    ],
    excludes: [
      "Licences for systems being integrated",
      "Changes to third-party systems we don't control",
      "Processes that aren't documented or agreed before we start",
      "Ongoing subscription and usage costs",
    ],
    questions: [
      "Walk me through the last time this happened, start to finish.",
      "What workaround have people already invented to cope with it?",
      "What happens when the person who normally does this is away?",
      "How often does it happen, and how long does it take each time?",
    ],
    goodFit:
      "You can name the process and roughly how long it takes. If you can't describe how it works today, start with a discovery sprint. A scope written on guesses helps nobody.",
  },
  {
    slug: "mvp-development",
    title: "Get an MVP in front of real users",
    tagline: "The smallest thing that tests whether people actually want it.",
    metaTitle: "MVP Development for Founders | GivenTake Devs",
    metaDescription:
      "MVP development for founders with paying-customer intent: the smallest build that tests the riskiest assumption. Scoped and quoted after discovery.",
    priceFrom: "Custom quote",
    timeline: "6–10 weeks",
    problem: [
      "You have a clear idea and, ideally, people already asking for it.",
      "What you don't have is a year to find a technical co-founder.",
      "Every week you don't ship is a week you don't learn anything.",
      "You're not sure how much of what you've imagined actually needs building first.",
    ],
    outcome:
      "A working product in front of real users, built around the riskiest assumption rather than the full feature list, so you find out what's true before spending the rest of the budget.",
    includes: [
      "Scoping down to the riskiest assumption",
      "A working product real users can use",
      "Analytics so you learn something from launch",
      "Weekly demos throughout",
      "Automated tests on critical paths",
      "Source code, documentation, and a recorded walkthrough",
      "60 days of support after launch",
    ],
    excludes: [
      "Everything deliberately cut from the first version",
      "User acquisition and marketing",
      "Fundraising material",
      "Scale engineering before there's usage to justify it",
    ],
    questions: [
      "Who are the first ten users, and can you name them?",
      "What's the riskiest assumption: the one that, if wrong, means none of this matters?",
      "What's the smallest thing that tests it?",
      "What does 'it's working' look like in 90 days?",
    ],
    goodFit:
      "You can name ten prospective users. If you can't, that's the real project right now, and building software won't fix it. We'd rather tell you that before you spend the money.",
  },
];

export const offerBySlug = (slug: string) => offers.find((o) => o.slug === slug);
