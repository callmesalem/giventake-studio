# AI tool register

**Internal record. Substantiates public claims — keep it accurate and current.**

This register is what makes these claims defensible rather than aspirational:

- Contact form consent copy: _"My data is not sold, not used to train AI models."_
- Privacy policy §9: _"we use business or enterprise tiers configured so that
  inputs are not retained for training"_
- MSA §3.3: _"Developer will use tools configured so that Client material is not
  retained for model training, and will maintain a register of such tools
  available to Client on request"_
- AI Use Disclosure: _"Ask for it any time"_

**Rule: no client material goes into a tool that is not on this register with a
verified no-training status.**

---

## Status: ⚠️ INCOMPLETE — blocks launch

**TODO(you):** fill this in before the site goes live. Every row needs a real
verification date and a real link to the vendor's terms. Until it's complete, the
public claim above is unsubstantiated — which is the same category of problem as
the case studies, just less visible.

---

## Register

| Tool                 | Vendor     | Plan/tier | Trains on input? | Retention  | ZDR available? | ZDR enabled? | Commercial use of output | DPA signed? | Verified       |
| -------------------- | ---------- | --------- | ---------------- | ---------- | -------------- | ------------ | ------------------------ | ----------- | -------------- |
| `[e.g. Claude Code]` | `[vendor]` | `[tier]`  | `[No]`           | `[period]` | `[Y/N]`        | `[Y/N]`      | `[Yes]`                  | `[Y/N/NA]`  | `[YYYY-MM-DD]` |
|                      |            |           |                  |            |                |              |                          |             |                |
|                      |            |           |                  |            |                |              |                          |             |                |

**ZDR** = zero data retention.

### What to check for each tool

1. **Which tier are you actually on?** Consumer and business tiers usually have
   different data terms, and the consumer default is usually the wrong one. This
   is the single most common thing people get wrong — they read the enterprise
   terms and are on the personal plan.
2. **Does it train on inputs by default?** Many tools train unless you opt out,
   and the opt-out is often not in the obvious place.
3. **Is there a setting you need to actually turn on?** Finding the setting isn't
   the same as enabling it. Verify in the account, not the docs.
4. **What is the retention period** even without training?
5. **Are there commercial-use restrictions** on output?
6. **Is a DPA available**, and do you need one? (Yes, if client personal data
   flows through it.)
7. **Link the terms page** you relied on, with the date — vendor terms change.

---

## Suppression of public-code matches

Where the tool offers a setting to suppress suggestions matching public code,
record it here.

| Tool | Setting available? | Enabled? | Verified |
| ---- | ------------------ | -------- | -------- |
|      |                    |          |          |

---

## Tools explicitly NOT approved

Record tools evaluated and rejected, so the decision isn't relitigated or
forgotten at 11pm on a deadline.

| Tool                                  | Reason not approved                           | Date     |
| ------------------------------------- | --------------------------------------------- | -------- |
| `[e.g. free-tier consumer assistant]` | `[trains on inputs, no opt-out on this tier]` | `[date]` |

---

## Client-specific restrictions

Some clients prohibit third-party AI processing entirely or for certain data.
Track per MSA §3.4.

| Client | Restriction | Source | Date |
| ------ | ----------- | ------ | ---- |
|        |             |        |      |

---

## Maintenance

- [ ] **Re-verify quarterly.** Vendor terms change, and plans get downgraded or
      migrated without notice
- [ ] Re-verify immediately on any plan or tier change
- [ ] Update before sending to a client in response to a request
- [ ] Add any new tool **before** first use on client material, not after

**Last full review:** `[DATE]`
**Next review due:** `[DATE]`
