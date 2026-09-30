// Plain data, no components: the pricing route imports this for FAQPage JSON-LD
// without pulling the accordion (and Radix) into the critical bundle.
//
// These answers are also emitted as structured data, so they are public factual
// claims. The studio is new: do not write answers that imply an existing client
// base ("most clients do X", "we do this often") until that is actually true.
export const faqs = [
  {
    q: "How much does it cost?",
    a: "Managed website plans are $249, $399, or $549 per month depending on size and scope. Your first month is due at signing and covers the design and build. There are no setup fees and no separate hosting bills. If you'd rather own the site outright, one-time builds start at $4,500.",
  },
  {
    q: "Do I own my website?",
    a: "Your domain, your content, and your customer data are always yours. On a monthly plan the design and code are licensed to you for as long as you're subscribed; one-time builds transfer to you fully. If you ever leave, we hand over everything you need to keep running.",
  },
  {
    q: "What if I already have a site?",
    a: "Start with the free site check on the homepage. We'll record a 5-minute video showing what's slowing it down and the one fix we'd make first. From there we'll tell you honestly whether it's worth fixing or worth rebuilding. Whichever costs you less.",
  },
  {
    q: "How fast can we start?",
    a: "A discovery sprint can start within a week. Managed website builds typically go live in two to six weeks depending on scope. You'll see real pages as they're built, not a mockup a month later.",
  },
  {
    q: "What do the quarterly reports actually include?",
    a: "Traffic sources, what visitors did on the site, speed scores measured on real phones, and our recommended next fix, in plain English, no jargon. The point is that you always know what the site is doing for your business.",
  },
  {
    q: "Can I cancel?",
    a: "Yes. Monthly plans have a 12-month initial term, then continue month to month and can be cancelled with 30 days' notice. One-time builds are yours outright once delivered.",
  },
  {
    q: "Do you use AI to build the sites?",
    a: "We use AI tooling to build faster, and a human reviews everything before it ships. That's the whole story. What you're buying isn't how the site gets built. It's a site that brings in work and a report that tells you what's working.",
  },
];
