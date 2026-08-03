# Operator onboarding

Bringing a new autonomous operator online — or eventually a human.

---

## Reading order

Do not skip ahead. Each step assumes the previous one.

| # | Read | Why |
|---|---|---|
| 1 | [`../00-agent-operating-charter.md`](../00-agent-operating-charter.md) | Overrides everything else. Non-negotiable. |
| 2 | [`../01-tooling-stack.md`](../01-tooling-stack.md) | What exists and what can be driven |
| 3 | [`../../business/09-client-process.md`](../../business/09-client-process.md) | The delivery process the ops layer wraps |
| 4 | [`../../business/04-ai-delivery-policy.md`](../../business/04-ai-delivery-policy.md) | Data handling, the register, review standards |
| 5 | [`../../contracts/msa-template.md`](../../contracts/msa-template.md) | The commitments actually made to clients |
| 6 | The specific SOP folder for this operator's function | The job |

Then, before doing anything: read the **live site**. `/process` and `/how-we-use-ai`
are public promises. An operator that contradicts them creates a false statement, not
just an awkward email.

---

## Bringing an operator online

**1. Define the function narrowly.** One SOP, or one coherent group. "Handles billing"
is a scope. "Helps out with client stuff" is not, and an operator with a vague remit
will improvise into the prohibitions.

**2. Register it** — [`../../contracts/ai-tool-register.md`](../../contracts/ai-tool-register.md).
Model, tier, training status, retention, verified date. **No registration, no
production access** (charter §7).

**3. Confirm the SOP is complete.** Every section in charter §2 present. If the SOP
contains the phrase "use judgment," it isn't finished — that's either a human step or
an escalation.

**4. Verify the escalation path works.** Trigger a test escalation and confirm a human
receives it. An operator that can't escalate is an operator that will improvise.

**5. Confirm the kill switch reaches it** (charter §10). Test it. Fails closed.

**6. Shadow run.** Operator produces output, human approves every instance, for a
defined period and sample size. Nothing client-facing goes out unreviewed.

**7. Go live with a rollback defined** before it runs unsupervised.

**8. Record it** — what went live, when, what evidence, who approved.

---

## Day-one permissions

A new operator gets, by default:

- **Read** on the docs and the SOP it owns
- **Read** on the records its SOP names
- **Write** only to `agent_log`
- **No** outbound client-facing capability
- **No** credential access, ever

Everything beyond that is granted per-SOP, explicitly, after the shadow run.

---

## What a good operator does when uncertain

**It stops.**

The correct behaviour in every ambiguous situation is: halt, write the reason to
`agent_log`, notify a human, wait. Not "make a reasonable assumption and flag it
later." Not "do the safest-looking thing."

An operator that stops too often is an annoyance and a sign the SOP needs sharpening.
An operator that guesses too often will eventually guess about money, scope, or a
client relationship — and that one isn't recoverable with an apology.

**Optimise for the annoying failure.**

---

## Recognising a stale SOP

Rewrite the SOP, don't work around it, when:

- The same escalation fires repeatedly for a situation that has an obvious answer —
  the answer belongs in the decision rules
- An operator has been improvising a step that isn't written down
- The SOP references a tool, price, or contract clause that has since changed
- A client complained about something the SOP told the operator to do

Charter §11: after any escalation that shouldn't have been needed, **the SOP was
wrong**. Fix the document, not the instance.
