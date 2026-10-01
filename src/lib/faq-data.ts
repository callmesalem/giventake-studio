// Plain data, no components: the pricing route imports this for FAQPage JSON-LD
// without pulling the accordion (and Radix) into the critical bundle.
//
// These answers are also emitted as structured data, so they are public factual
// claims. The studio is new: do not write answers that imply an existing client
// base ("most clients do X", "we do this often") until that is actually true.
export const faqs = [
  {
    q: "How much does it cost?",
    a: "Custom websites start at $499. The final number depends on scope, and you get it in writing as a quote and proposal before any work starts. Payment plans and financing are available. After launch there's an optional care plan at $99 per month covering hosting, updates, backups, monitoring, small content edits, and a monthly report. You can skip it or cancel it any time.",
  },
  {
    q: "Do I own my website?",
    a: "Yes, outright. The design, the code, your content, your domain, and your customer data are all yours once the build is paid for. The care plan is a separate, optional service, not a licence on your own site. If you cancel it, the site stays yours and we hand over everything you need to keep running.",
  },
  {
    q: "What if I already have a site?",
    a: "Start with the free site check on the homepage. We'll record a 5-minute video showing what's slowing it down and the one fix we'd make first. From there we'll tell you honestly whether it's worth fixing or worth rebuilding. Whichever costs you less.",
  },
  {
    q: "How fast can we start?",
    a: "Scoping and the written quote usually happen within a week of your first message. A marketing site build goes live in two to four weeks depending on scope. You'll see real pages as they're built, not a mockup a month later.",
  },
  {
    q: "What does the monthly report actually include?",
    a: "Leads you got, where they came from, what we changed that month, what worked, and what we'd do next. Plain English, no jargon. The point is that you always know what the site is doing for your business.",
  },
  {
    q: "Can I cancel?",
    a: "The care plan is month to month with no minimum term, so you can cancel any time. There's nothing to cancel on the build itself: once it's paid for, the site is yours.",
  },
  {
    q: "Do you use AI to build the sites?",
    a: "We use AI tooling to build faster, and a human reviews everything before it ships. That's the whole story. What you're buying isn't how the site gets built. It's a site that brings in work and a report that tells you what's working.",
  },
];
