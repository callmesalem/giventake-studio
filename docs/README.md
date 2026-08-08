# GivenTake Devs — documentation

Everything needed to run this business, other than the code. Four sections, each with
its own index.

| Section | What it is | Start here |
|---|---|---|
| [business/](./business/) | **Strategy and compliance** — entity, tax, insurance, pricing, positioning, marketing, the client process | [06-launch-checklist](./business/06-launch-checklist.md) |
| [operations/](./operations/) | **How it runs** — SOPs for agent operators across sales, onboarding, support, retention, billing, marketing, security | [00-agent-operating-charter](./operations/00-agent-operating-charter.md) |
| [contracts/](./contracts/) | **Legal** — MSA, SOW, AI use disclosure, AI tool register, subprocessor list | [README](./contracts/README.md) |
| [templates/](./templates/) | **Fill-in working documents** used during a live project | [README](./templates/README.md) |

---

## If you're picking this up cold

Read in this order. Each assumes the one before it.

1. **[business/06-launch-checklist](./business/06-launch-checklist.md)** — what blocks
   what, and what's already done
2. **[business/01-structure-and-formation](./business/01-structure-and-formation.md)** —
   the entity decision and why it changed
3. **[business/09-client-process](./business/09-client-process.md)** — the eleven
   stages every project runs through, published publicly at `/process`
4. **[operations/00-agent-operating-charter](./operations/00-agent-operating-charter.md)** —
   what autonomous operators may and may not do
5. **[contracts/README](./contracts/README.md)** — what's actually promised to clients

---

## The four things blocking launch

Everything else is written. These are external and yours:

1. **Form the LLC** — Ohio Form 610, general-purpose clause. Then the business address,
   which fills `BUSINESS_ADDRESS` and `LEGAL_ENTITY` in `src/lib/seo.ts` and unblocks
   the site
2. **Bind Tech E&O + cyber insurance** — before the first engagement. Claims-made
   coverage cannot be bought retroactively
3. **Complete the AI tool register** — it substantiates a claim already published on the
   contact form
4. **Attorney review of the MSA and SOW; CPA on Ohio sales tax** — the first blocks
   signing, the second blocks invoicing

Detail and sequencing: [business/06-launch-checklist](./business/06-launch-checklist.md).

---

## Rules that apply across every document here

These aren't style preferences. Each exists because getting it wrong has a specific,
known cost.

**Truthfulness.** No outcome metrics without a delivered project and written permission
to publish. No invented client anecdotes. No headcount claims — studio voice, never
"our team of developers." Illustrative material is labelled illustrative. This applies
to the website, to proposals, to articles, and to anything an agent operator writes.

*Why:* the site originally carried three fabricated case studies with specific metrics,
under the line "these are not mockups." That's a false statement of material fact made
for commercial gain — FTC Act §5 territory, and worse, the kind of thing a client sues
over when they hired you because of a number that wasn't real.

**Published claims are commitments.** `/process`, `/how-we-use-ai`, the MSA, and the
privacy policy are all live promises. Before changing how the business works, check
whether a change makes one of them false — and change the claim first, deliberately, if
so. Operations charter §8 has the procedure.

**New tools touching client data are subprocessors.** A row in
[contracts/subprocessor-list.md](./contracts/subprocessor-list.md) and a line in the
privacy policy, *before* it goes live.

**Not legal, tax, or insurance advice.** These documents exist to make professional
consultations short and specific instead of long and exploratory. **VERIFY** marks
something for an attorney or CPA. **TODO(you)** marks something needing your input.

---

## Conventions

- `docs/` is in `.prettierignore` — prose and wide tables, formatted by hand
- Cross-references are relative links, checked when docs change
- Numbered files are ordered by when you need them, not by importance
