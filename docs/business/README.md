# GivenTake Devs — business and compliance

Working documents for standing up the development studio as a real, compliant
business. Written for **Ohio**.

| Doc                                                                | What it covers                                                                     |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| [01-structure-and-formation.md](./01-structure-and-formation.md)   | New LLC vs. trade name, the decision and why, Ohio filings                         |
| [02-ohio-tax.md](./02-ohio-tax.md)                                 | Sales tax (the hard one), CAT, municipal net profit, federal                       |
| [03-insurance-and-risk.md](./03-insurance-and-risk.md)             | Tech E&O, cyber, the AI exclusion to ask about                                     |
| [04-ai-delivery-policy.md](./04-ai-delivery-policy.md)             | The operational policy behind an AI-built studio                                   |
| [05-pricing-and-positioning.md](./05-pricing-and-positioning.md)   | Pricing strategy, positioning, go-to-market                                        |
| [06-launch-checklist.md](./06-launch-checklist.md)                 | Sequenced checklist with blocking dependencies                                     |
| [07-legacy-entity-cleanup.md](./07-legacy-entity-cleanup.md)       | Cleaning up GivenTake Goods LLC — vendor's licence, tax accounts, construction tail |
| [08-marketing-and-client-acquisition.md](./08-marketing-and-client-acquisition.md) | Channel plan for a faceless generalist studio on no budget; why ads come later |
| [09-client-process.md](./09-client-process.md)                     | The 11-stage pipeline every client runs through, with gates and artifacts           |
| [10-discovery-questions.md](./10-discovery-questions.md)           | Discovery question bank — core set plus business-type and project-type modules      |

Contract templates live in [`../contracts/`](../contracts/).
Fill-in working documents live in [`../templates/`](../templates/).

## Read this first

**These documents are not legal, tax, or insurance advice.** They were prepared to
get you organised and to make your professional consultations short and cheap
instead of long and exploratory. Two consultations are assumed throughout and
are called out where they matter:

- an **Ohio business attorney** — contract templates, entity questions
- a **CPA with Ohio sales-tax experience** — the sales-tax treatment of your
  specific service mix, which is genuinely ambiguous and is the single easiest
  thing on this list to get expensively wrong

Anywhere a document says **VERIFY**, treat it as a question for one of those two,
not as a settled fact.

## Status

Everything here is a draft pending your review. Items needing input from you are
marked **TODO(you)**; items needing a professional are marked **VERIFY**.

**Entity confirmed** from the filed Articles of Organization: GIVENTAKE GOODS
LLC, Ohio SOS doc 202225804070, filed 9/15/2022, Parma / Cuyahoga County.

✅ **Structure decided: form a new Ohio LLC for the software business** ($99, no
trade-name filing needed). Do not run the studio through GivenTake Goods LLC.

The original plan — a trade name under the existing entity — was correct for a
clean, general-purpose LLC. It isn't the right answer for this one. GivenTake
Goods LLC performed **contractor work**, and Ohio's construction statute of
repose (ORC § 2305.131) keeps defect claims live for up to ten years after
substantial completion of each job. **That clock runs from when the work was
finished, not from when the business stopped trading** — so winding the
contracting down does not shorten it, and no technology E&O policy answers for
those claims.

That entity is no longer trading and no longer holds a vendor's licence, so the
legacy cleanup is short — see
[07-legacy-entity-cleanup.md](./07-legacy-entity-cleanup.md). Reasoning for the
structure decision is in
[01-structure-and-formation.md](./01-structure-and-formation.md).

**Consequence for the website:** `LEGAL_ENTITY` in `src/lib/seo.ts` currently
says "GivenTake Goods LLC" and is rendered on the Terms and Privacy pages. It
must be updated to the new entity name once formed — the site should not name an
entity that isn't the one contracting.
