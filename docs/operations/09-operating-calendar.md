# 09 — Operating calendar and metrics

Every recurring obligation in one place. These were previously spread across five
documents, which is how a claims-made insurance policy lapses.

---

## Weekly

| Day | What | Who | Source |
|---|---|---|---|
| Mon | Pipeline report | Agent | [02](./02-sales-pipeline/) SOP 02.6 |
| Mon | Warm outreach — 10 drafted, **human sends** | Agent → Human | [07](./07-marketing-ops/) SOP 07.1 |
| Mon | Health scores refreshed | Agent | [05](./05-retention/) |
| — | Client demos, per project | **Human** | `business/09` stage 6 |
| Fri | Marketing report | Agent | [07](./07-marketing-ops/) SOP 07.5 |
| Fri | AR check — overdue, ladder positions | Agent | [06](./06-billing-collections/) |

## Monthly

| When | What | Who |
|---|---|---|
| Day 1 | Monthly close — AR aging, tax reserve, revenue split | Agent → Human |
| Day 1 | Metrics review (below) | **Human** |
| — | Two content pieces published | Agent drafts → Human edits |
| — | Google Business Profile post | Agent drafts → Human approves |
| — | Support log review — defect clusters, retainer signals | Human |

## Quarterly

| What | Why |
|---|---|
| **Re-verify the AI tool register** | Vendor terms change and tiers get migrated without notice. This substantiates a public claim on the contact form |
| **Estimated tax payments** — federal, Ohio, municipal | Underpayment penalties are automatic |
| **Access review** — [08](./08-security-incident/) SOP 08.2 | Access accumulates silently |
| Charter review — charter §11 | Sample the audit log; check §3 and §4 against what operators actually did |
| Security questionnaire pack refresh | Stale answers are worse than none |

## Annually

| What | Why |
|---|---|
| **Insurance renewal — never let it lapse** | Tech E&O is claims-made. A gap can permanently orphan every project delivered during the covered period |
| Subprocessor list vs. privacy policy §5 | The published policy is the binding statement |
| Statutory agent designation current with Ohio SOS | **The one way an Ohio LLC actually dies** — failure to maintain an agent, 30 days to cure, then articles cancelled |
| Ohio annual report | **None required.** Listed so you recognise the upsell |
| Rate review | `business/05` §5 — raise on schedule, not when you feel ready |

## Per project

Stage gates from `business/09`: signed SOW + deposit before code · **baseline measured
at kickoff** · weekly demo · review checklist before shipping · written acceptance ·
handoff package · support window dates · retro at day 14.

---

## The metrics that decide where time goes

Reviewed monthly. With no ad budget, time allocation is the only real decision you
make.

| Metric | How | Why it matters |
|---|---|---|
| **Effective hourly rate** | Project fee ÷ all hours, including sales and scoping | The number that reveals whether small projects are worth taking. Track from the first project or you'll never know |
| Utilization | Billable ÷ total hours | 50–60% is realistic once sales and admin are counted. Solo operators consistently overestimate |
| Pipeline coverage | Signed + likely work, next 60 days | The month you stop selling is the month two months out with no revenue |
| Scope creep | Hours beyond the SOW | Consistently high means your scoping is wrong, not your clients |
| Lead source | Per enquiry | The only way to know which unpaid activity actually works |
| Support load | Tickets and hours per project | Whether the support window is priced right |
| Cash runway | Months of personal expenses covered | Determines whether you can decline a bad client — the most valuable ability a solo business has |

**The failure mode:** taking every project, staying busy, and finding after a year that
the effective hourly rate never justified the work. Busy is not viable. Track the rate.

---

## Before client #1 — the blocking items

Consolidated from `business/06-launch-checklist.md`. These block, rather than
recur:

- [ ] LLC formed; EIN; bank account
- [ ] Business address (not the statutory agent's home) → `BUSINESS_ADDRESS` in
      `src/lib/seo.ts`
- [ ] Domain live; `hello@`, `privacy@`, `legal@` all deliver
- [ ] **Tech E&O + cyber bound** — before the first engagement, not after
- [ ] Attorney review of MSA and SOW
- [ ] CPA on Ohio sales tax; vendor's licence if required
- [ ] **AI tool register complete** — substantiates a claim already on the site
- [ ] Kill switch implemented and tested
- [ ] Incident runbook read once, in advance
