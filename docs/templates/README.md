# Templates

Fill-in working documents for the client process. One folder per client; the
completed set is the project record.

| Template | Used at | Purpose |
|---|---|---|
| [discovery-notes.md](./discovery-notes.md) | Stage 2 | Capture the problem and the **baseline numbers** |
| [weekly-update.md](./weekly-update.md) | Stage 6 | Weekly client update alongside a working demo |
| [delivery-review-checklist.md](./delivery-review-checklist.md) | Stage 7 | The review gate — **nothing ships without it** |
| [handoff-checklist.md](./handoff-checklist.md) | Stage 9 | Handover package and access removal |

Process: [`../business/09-client-process.md`](../business/09-client-process.md)
Questions: [`../business/10-discovery-questions.md`](../business/10-discovery-questions.md)
Contracts: [`../contracts/`](../contracts/)

## Per-client folder

```
clients/<client-name>/
├── 01-qualification.md
├── 02-discovery-notes.md          ← baseline numbers live here
├── 03-proposal.md
├── 04-msa.pdf + 04-sow.pdf        ← signed
├── 05-kickoff.md                  ← baseline confirmed by client
├── 06-weekly/week-01.md …
├── 07-delivery-review.md          ← also committed to the project repo
├── 08-acceptance.md               ← client's written acceptance
├── 09-handoff.md
├── 10-support-log.md
└── 11-retro.md                    ← re-measured results → case study
```

## The two that carry the most weight

**Baseline numbers in `02` and `05`.** Ten minutes at kickoff is the difference
between a case study that says "cut invoicing from 5 days to same day" and one
that says "the client was pleased." Only one of those wins work — and it's the
only route back to a real case-studies section on the site.

**The review checklist in `07`.** The site publicly commits to manual human
review before anything ships. A completed checklist in the repo is what turns
that from an assertion into something you can evidence.
