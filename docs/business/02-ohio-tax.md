# 02 — Ohio and federal tax

**This is the document to take to a CPA.** Ohio's treatment of software and
computer services is genuinely ambiguous at the edges, and the ambiguity falls
exactly across the middle of what this studio sells. Getting it wrong is not a
paperwork problem — uncollected sales tax becomes your liability, plus interest
and penalties, and it surfaces years later in an audit when the money is long
spent.

---

## 1. Ohio sales tax — the hard one

### Why this is not simple

Ohio does not have a single rule for "software." It has several categories that
are taxed differently, and which one a given engagement falls into is decided by
a **"true object of the transaction"** test — what was the customer really
buying?

Roughly:

| What you sell                                                       | General treatment                                        |
| ------------------------------------------------------------------- | -------------------------------------------------------- |
| **Custom software** written to one customer's specification         | Generally **exempt** — treated as a professional service |
| **Automatic data processing (ADP)** for business use                | Generally **taxable**                                    |
| **Computer services** for business use                              | Generally **taxable**                                    |
| **Electronic information services** delivered to business customers | Generally **taxable**                                    |
| Prewritten/canned software                                          | Taxable                                                  |
| Implementation, training, consulting, when **separately stated**    | Generally exempt                                         |

The "for use in business" qualifier matters: several of these categories are
taxable specifically on B2B sales, which is your entire market. Do not assume
selling to businesses keeps you out of it — in Ohio it is often what puts you in.

### How this maps onto your service tiers

**VERIFY (CPA) — this is my reading, not a determination:**

| Tier                                                      | Likely posture                | Why it's uncertain                                                                                          |
| --------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Growth — custom app, internal tool, automation            | Likely exempt custom software | Strongest case: bespoke, single customer, written to spec                                                   |
| Starter — marketing site build                            | **Genuinely unclear**         | Website development has been treated as taxable in some Ohio guidance; a bespoke build argues the other way |
| Essentials — small builds and fixes                       | **Genuinely unclear**         | Same as above, and small jobs look less "custom"                                                            |
| Dedicated — monthly retainer                              | **Highest risk**              | See below                                                                                                   |
| Hosting, maintenance, monitoring, ongoing data processing | Likely taxable                | These look like ADP / computer services, not custom development                                             |

### The retainer trap

A monthly retainer that bundles exempt custom development with taxable hosting
and maintenance into one undifferentiated line item is the worst structure you
can invoice. An auditor looking at "Development retainer — $6,000" has no basis
to apportion it, and the path of least resistance is to tax the whole thing.

**Mitigation — build this into your invoicing from the first invoice, not later:**

1. **Separately state and separately price** exempt development from taxable
   services on every invoice. Not a footnote — separate line items with separate
   dollar amounts.
2. **Match the SOW to the invoice.** If the SOW describes one blended service and
   the invoice splits it, the split looks retrofitted.
3. **Keep contemporaneous records** of what each line item covered. Reconstructing
   this during an audit is not possible.
4. **Collect exemption certificates** where a client claims an exemption.

### Actions

- [ ] **CPA consultation on your specific service mix** before the first invoice
- [ ] Consider requesting a **written determination from the Ohio Department of
      Taxation** for your service mix. It takes time, but a written determination
      is the only thing that actually settles this, and it is free
- [ ] Obtain an **Ohio vendor's license** via the Ohio Business Gateway if any of
      your services are taxable — required _before_ collecting any tax
- [ ] Set up invoicing with separated line items from day one
- [ ] **Do not collect sales tax without a vendor's license.** Collecting tax you
      aren't licensed to collect is its own violation

### Rates

Ohio state rate is 5.75%, plus county and transit authority rates, so the
combined rate varies by locality (roughly 6.5%–8%). Sourcing rules determine
which locality's rate applies — another CPA question, and one that matters more
if you sell to clients across multiple Ohio counties.

### Out-of-state clients

Selling to clients outside Ohio raises economic nexus in _their_ states, each
with its own software-taxability rules and thresholds. You are far below every
state's threshold today, so this is not an immediate concern — but revisit it
before you have meaningful revenue from any single other state, and note that
some states' thresholds are transaction-count based rather than dollar based.

---

## 2. Ohio Commercial Activity Tax (CAT) — you're exempt

The CAT exclusion rose to **$6 million** in taxable gross receipts for tax periods
beginning in 2025 and applies going forward. Below that threshold you are **not
required to file a CAT return at all** — this is not just a zero-tax outcome, it
is a no-filing outcome.

You are far below the threshold. Nothing to do, with one exception:

- [ ] **If GivenTake Goods LLC has an existing CAT account** from prior activity,
      cancel it. Businesses that dropped below the raised threshold were expected
      to file a final return and cancel; an open account with no filings can
      generate delinquency notices for a tax you don't owe.

Revisit only if annual gross receipts approach $6M. Above it, the rate on the
excess is 0.26%.

---

## 3. Ohio municipal income tax — the one people forget

Ohio is unusual: **cities levy income tax on business net profits**, separately
from state and federal. This catches people who budgeted for federal and state
and then discover a third filing.

**This one is material for you.** The Articles put GivenTake Goods LLC in
**Parma, Cuyahoga County**, and Parma's municipal income tax rate is among the
higher ones in Ohio — sources indicate somewhere in the **2.5%–3%** range, and
they do not agree. That is a real cost on net profit, and it is not optional.

- [ ] **VERIFY:** confirm Parma's current rate and business net-profit filing
      requirements directly with the City of Parma tax department or whichever
      agency administers it (RITA, CCA, or the city itself). Do not rely on
      third-party rate tables — they conflict, which is exactly why this needs a
      primary source
- [ ] **TODO(you):** confirm Parma is where you actually operate from. Municipal
      tax follows where the work is performed, which for a home-based business is
      generally where you sit — not necessarily the statutory agent's address
- [ ] Consider **opting into the state-administered municipal net profit tax**
      through the Ohio Department of Taxation — it consolidates municipal filing
      through one system, which is worth it the moment you owe tax to more than
      one municipality
- [ ] If you ever work on-site at client locations in other Ohio cities, ask the
      CPA about municipal apportionment before it accrues

Note that Ohio has **no state-level entity tax on an LLC** — no franchise tax, no
minimum annual tax. Combined with no annual report, Ohio is a genuinely cheap
state to operate an LLC in. The municipal layer is where the cost actually is.

---

## 4. Federal

### Default treatment

A single-member LLC is a disregarded entity by default: profit flows to your
personal return on Schedule C, and you pay income tax plus **self-employment tax
(15.3%)** on net profit.

### Quarterly estimated payments

No employer is withholding for you. Federal estimated tax is due quarterly
(mid-April, mid-June, mid-September, mid-January), and Ohio state and municipal
estimates run on similar schedules. Underpayment penalties are automatic.

**Practical rule:** move 25–30% of every payment received into a separate tax
account the day it lands. This is the single habit that prevents the classic
first-year failure — spending gross revenue and discovering the tax bill in April.

### S-corp election — evaluate, don't rush

Once net profit is consistently above roughly **$60,000–$80,000**, an S-corp
election can reduce self-employment tax: you pay yourself a reasonable W-2 salary
(subject to payroll taxes) and take the remainder as a distribution (not subject
to SE tax).

The tradeoffs are real and are why this is a "when", not a "now":

- You must run actual payroll, with filings and a payroll service (~$500–$1,500/yr)
- The salary must be **reasonable** for the work — the IRS challenges artificially
  low salaries, and "reasonable" for a senior developer is not a small number
- Additional tax return (Form 1120-S) and accounting cost
- Below the threshold, the added cost exceeds the SE tax saved

**VERIFY (CPA):** the crossover point depends on your actual numbers and on what
salary is defensible. Do not elect based on a rule of thumb from the internet.

### Contractors

If you subcontract any work:

- [ ] Collect a **W-9 before paying anyone** — not at year end, when people stop
      answering email
- [ ] File **1099-NEC** for any contractor paid $600+ in a calendar year
- [ ] Make sure the contractor relationship is genuinely a contractor
      relationship (worker classification), and that your subcontract assigns IP
      to you — otherwise you cannot assign it onward to the client, which quietly
      breaks the IP clause in your MSA

### Deductions worth tracking from day one

Software subscriptions and AI tool costs (a real line item for this business),
hardware, home office, professional insurance premiums, legal and accounting
fees, business use of vehicle, professional development. Track contemporaneously;
reconstructing a year of AI tool receipts is miserable.

---

## Summary of what actually needs doing

| Priority   | Action                                             | Blocks                 |
| ---------- | -------------------------------------------------- | ---------------------- |
| **High**   | CPA consult on Ohio sales tax for your service mix | First invoice          |
| **High**   | Vendor's license if any service is taxable         | Collecting any tax     |
| **High**   | Separated line items in invoicing                  | First invoice          |
| **Medium** | Confirm city and municipal net profit obligation   | First filing           |
| **Medium** | Set up the 25–30% tax reserve habit                | First payment received |
| **Low**    | Cancel any stale CAT account                       | Delinquency notices    |
| **Later**  | S-corp evaluation                                  | ~$60–80K net profit    |
