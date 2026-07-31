# 07 — Legacy entity cleanup: GivenTake Goods LLC

**This is separate from the software business and has to happen regardless of it.**

GivenTake Goods LLC performed contractor work, held an Ohio vendor's licence, and
has been dormant since. A dormant business with an open tax account is not
inactive from the state's point of view — it is delinquent. Obligations kept
accruing while nothing was happening, and the notices have been going to a
residential address.

Do this sweep **before** applying for insurance or a new vendor's licence under
the new entity. Ohio Department of Taxation delinquency attached to a related
entity with the same member is exactly the kind of thing that surfaces during
underwriting and licensing.

---

## 1. Vendor's licence — start here ⚠️

**Highest-value item on this list, and the one most likely to have real money
attached.**

Ohio requires a sales tax return **for every filing period, even when sales are
zero**. A vendor's licence that stopped filing does not go quiet — it goes
delinquent, and the Department of Taxation can issue estimated assessments
against the account for the missing periods. Those assessments are legally
enforceable amounts based on the Department's estimate, not your actual (zero)
sales, and they can become liens if ignored.

Penalties run to **$50 or 10% of unpaid tax per period, whichever is greater**,
plus interest, plus a late-remittance penalty of up to 50% of overdue tax.
Multiply by the number of missed periods since the business went quiet.

### Actions

- [ ] **Find the licence.** Check the Ohio Business Gateway under the LLC's EIN,
      and the Cuyahoga County Fiscal Officer's vendor licence records
- [ ] **Pull the account status** — filed periods, missing periods, assessments,
      balance
- [ ] **File the missing zero returns.** In most cases this resolves estimated
      assessments, because the assessment was a placeholder for a return you
      hadn't filed. Penalties may survive; the assessment usually doesn't
- [ ] **Request penalty abatement** where returns were zero and no tax was ever
      actually due. First-time and reasonable-cause abatement are commonly
      granted — ask, don't assume you owe it
- [ ] **File a final return and cancel the licence** if the contracting and
      wholesaling business isn't resuming. A cancelled licence stops the clock;
      an open one keeps generating obligations forever
- [ ] **VERIFY (CPA):** worth an hour of professional time. Someone who handles
      Ohio sales tax will know the abatement route and can often deal with the
      Department directly

**Do not skip this because the business made no sales.** Zero sales is the reason
the returns were never filed, and it is also the reason the penalties are
abatable. But only if you engage with it.

---

## 2. Municipal net profit tax

Parma (or whichever municipality the business operated in) generally requires a
net profit return from a registered business, and many Ohio municipalities
require one **even in a zero-income year**.

- [ ] Determine who administers it — the city directly, RITA, or CCA
- [ ] Check for a registered account and unfiled years
- [ ] File any missing returns, request abatement on zero years
- [ ] Close the account if the business isn't resuming

---

## 3. Commercial Activity Tax account

If a CAT account was opened in 2022, it may still be open. The exclusion is now
$6M, so no tax is owed and no filing is required — but an **open account with no
filings** can still generate delinquency notices for a tax you don't owe.

- [ ] Check whether a CAT account exists
- [ ] If so, file a final return and cancel it

---

## 4. Federal and state income tax

- [ ] **TODO(you): were Schedule C (or partnership) returns filed** for the years
      the LLC actually traded? Contractor work means real income, and unfiled
      returns are a bigger problem than late-filed ones
- [ ] Ohio IT filings for those years
- [ ] **VERIFY (CPA)** if anything is missing. Voluntary disclosure is
      dramatically better than being found

---

## 5. Entity status

- [ ] **Confirm GivenTake Goods LLC is still active** with the Ohio SOS. Ohio
      requires no annual report, so dormancy alone doesn't kill it — but failure
      to maintain a statutory agent does: the SOS gives notice and cancels the
      articles if it isn't cured within 30 days
- [ ] If cancelled, **reinstate with Form 525-A ($25)**. You want this entity
      alive and properly maintained — see §7 below
- [ ] Confirm the statutory agent designation and address are current

---

## 6. Old contractor insurance — check before you assume

**This is worth real effort.** If the contracting work carried general liability
at the time:

- [ ] **Find the old policy.** Carrier, policy number, period, limits
- [ ] **Was it occurrence-based or claims-made?** This is the whole question:
      - **Occurrence-based** — the policy generally still responds to claims for
        work performed during its period, even years after it lapsed. That is
        genuinely good news and materially reduces the construction tail risk
      - **Claims-made** — it only responds while in force. If it lapsed with no
        tail purchased, the exposure is uninsured
- [ ] If there was **no GL at all**, the construction tail is uninsured. That
      doesn't change the plan, but you should know it
- [ ] **VERIFY (broker):** ask whether a standalone tail or a completed-operations
      extension can still be purchased for the prior work. Sometimes it can;
      sometimes the window has closed

---

## 7. Do not dissolve this entity casually

The instinct is to wind it up and be done. **Talk to an attorney first.**

- **Dissolution does not extinguish claims.** Ohio has a wind-up process, and
  claims can still be asserted — including against assets distributed to members.
  Dissolving does not make the ORC § 2305.131 construction tail disappear
- **A live, properly maintained entity is a better defendant than a dissolved
  one.** If a construction claim arrives in 2029, you want it to hit a real
  entity with its own history, not to give a claimant an argument that assets
  were stripped and the members should answer personally
- **Keeping it costs almost nothing.** No Ohio annual report, no franchise tax,
  no minimum tax. A statutory agent and a dormant bank account is the whole
  carrying cost
- If it genuinely never traded much and there is no meaningful tail, dissolution
  may be fine — but that is an attorney's call with the facts in front of them,
  not a default

**VERIFY (attorney):** whether to keep GivenTake Goods LLC alive, and if so,
what maintenance keeps the liability shield credible for an entity with no
operations.

---

## 8. Keep the two entities genuinely separate

Once the new LLC exists, the isolation only holds if you actually maintain it:

- [ ] Separate bank accounts — the existing account stays with the old entity
- [ ] Separate books
- [ ] Never pay one entity's expenses from the other's account. If funding is
      needed, document it as a loan or capital contribution
- [ ] Client-facing documents name the correct entity
- [ ] Don't let the old entity's EIN appear on anything for the software business

A claimant against the contracting entity who can show the two were run as one
pot of money has a real argument that they should be treated as one. That
argument is what the $99 was spent to prevent.

---

## Priority order

| # | Item | Why now |
|---|---|---|
| 1 | Vendor's licence status and missing returns | Accruing penalties; blocks a clean new licence application |
| 2 | Confirm entity is still active | Determines whether anything else is even fileable |
| 3 | Old GL policy — occurrence or claims-made | Determines whether the construction tail is insured |
| 4 | Municipal and CAT accounts | Delinquency notices |
| 5 | Income tax returns for trading years | Bigger problem the longer it sits |
| 6 | Attorney call on keep-vs-dissolve | Not urgent, but don't dissolve before it |
