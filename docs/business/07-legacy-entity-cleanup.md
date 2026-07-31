# 07 — Legacy entity: GivenTake Goods LLC

**Status:** no longer trading. No contractor work, no vendor's licence held.

That makes this list much shorter than it would otherwise be. What remains is a
handful of confirmations and one item that isn't going away for another decade.

---

## The one thing that doesn't close

**The construction liability tail runs to roughly 2032–2035.**

Ohio's statute of repose (**ORC § 2305.131**) allows claims arising from a
defective or unsafe condition of an improvement to real property for **ten years
after substantial completion**, and it reaches **both tort and contract** claims.
If a defect is discovered in years eight through ten, the claimant gets a further
two years from discovery.

**The clock runs from when each job was completed, not from when the business
stopped.** Winding down the contracting work does not shorten it. This is the
entire reason the software studio goes in a separate entity — see
[01-structure-and-formation.md](./01-structure-and-formation.md).

Nothing to *do* here beyond §3 below. Just don't let this entity end up holding
the software business's assets.

---

## 1. Confirm how the vendor's licence ended

**Cancelled properly, or just abandoned?** These look the same from the outside
and are very different underneath.

- **Cancelled** — final return filed, licence formally closed. Nothing further.
- **Abandoned or revoked for inactivity** — the account may still show unfiled
  periods, and Ohio can issue *estimated* assessments for them: enforceable
  amounts based on the Department's estimate rather than your actual (zero)
  sales. Penalties run to $50 or 10% of unpaid tax per period, plus interest.

### Actions

- [ ] Look up the account on the **Ohio Business Gateway** under the LLC's EIN,
      and check **Cuyahoga County Fiscal Officer** vendor licence records
- [ ] Confirm the status: cancelled, revoked, or open
- [ ] **If periods are unfiled:** file the missing zero returns. This usually
      clears estimated assessments, because the assessment was a placeholder for
      a return you hadn't filed
- [ ] **Request penalty abatement** for periods with no actual tax due.
      First-time and reasonable-cause abatement are commonly granted for exactly
      this situation — ask rather than assume you owe it
- [ ] File a final return and formally cancel if it's still open

This is maybe an hour, and worth a CPA's time if anything looks open.

## 2. Confirm the other tax accounts are closed

- [ ] **Municipal net profit tax** (Parma / RITA / CCA). Many Ohio municipalities
      require a return even in a zero-income year. Check for a registered account
      and unfiled years; close it if the business isn't resuming
- [ ] **CAT account**, if one was opened in 2022. The exclusion is now $6M so no
      tax is owed and no filing is required — but an open account with no filings
      can still generate delinquency notices for a tax you don't owe. File a
      final return and cancel
- [ ] **Income tax returns for the years the LLC actually traded.** Contractor
      work means real income; unfiled returns are a bigger problem than
      late-filed ones. **VERIFY (CPA)** if anything is missing — voluntary
      disclosure beats being found

## 3. Old contractor GL insurance — worth real effort

This is the item that could materially shrink the tail, so don't skip it.

- [ ] **Find the old policy** — carrier, number, period, limits
- [ ] **Occurrence-based or claims-made?** This is the whole question:
      - **Occurrence-based** — generally still responds to claims arising from
        work performed during its period, even though it lapsed years ago. That
        is genuinely good news
      - **Claims-made** — responds only while in force. Lapsed with no tail
        purchased means the exposure is uninsured
- [ ] If there was **no GL at all**, the tail is uninsured. Doesn't change the
      plan, but you should know
- [ ] **VERIFY (broker):** ask whether a standalone tail or completed-operations
      extension can still be bought for the prior work

## 4. Entity status

- [ ] **Confirm GivenTake Goods LLC is still active** with the Ohio SOS. Dormancy
      alone doesn't kill an Ohio LLC — there's no annual report to miss — but
      failure to maintain a statutory agent does: the SOS gives notice and
      cancels the articles if it isn't cured within 30 days
- [ ] If cancelled, **reinstate with Form 525-A ($25)**. You want this entity
      alive — see §5
- [ ] Keep the statutory agent designation and address current

---

## 5. Do not dissolve it

The instinct with a wound-down business is to dissolve and be done. **Don't, and
talk to an attorney before you do.**

- **Dissolution does not extinguish the construction tail.** Ohio has a wind-up
  process and claims can still be asserted, including against assets distributed
  to members. Dissolving does not make ORC § 2305.131 go away
- **A live, properly maintained entity is a better defendant than a dissolved
  one.** If a claim arrives in 2029, you want it to hit a real entity — not to
  hand a claimant the argument that assets were stripped and the member should
  answer personally
- **Keeping it costs almost nothing.** Ohio has no annual report, no franchise
  tax, no minimum tax. A statutory agent is the whole carrying cost

**VERIFY (attorney):** whether to keep it alive and what minimal maintenance
keeps the liability shield credible for an entity with no operations.

---

## 6. Keep the two entities separate

Once the new LLC exists, the isolation only holds if you maintain it:

- [ ] Separate bank accounts — the existing account stays with the old entity
- [ ] Separate books
- [ ] Never pay one entity's expenses from the other's account. If funding is
      needed, document it as a loan or capital contribution
- [ ] Client-facing documents name the correct entity
- [ ] The old entity's EIN never appears on anything for the software business

A claimant who can show the two were run as one pot of money has a real argument
they should be treated as one — which would undo the whole point of the new
entity.

---

## Priority

| #   | Item                                       | Why                                                              |
| --- | ------------------------------------------ | ---------------------------------------------------------------- |
| 1   | Vendor's licence — cancelled or abandoned? | Only item with money potentially attached                        |
| 2   | Old GL policy — occurrence or claims-made? | Determines whether the tail is insured                           |
| 3   | Entity still active with the SOS           | Determines whether anything is fileable                          |
| 4   | Municipal / CAT / income tax accounts      | Delinquency notices for taxes you don't owe                      |
| 5   | Attorney call on keep-vs-dissolve          | Not urgent — but don't dissolve before having it                 |
