# 08 — Security and incident response

**This closes a live compliance gap.** The published privacy policy commits to
notifying affected parties and the relevant authority **within 72 hours** of a breach
(`src/routes/privacy.tsx` §10). Until now there was nothing behind that promise —
`../../business/04-ai-delivery-policy.md` §7 flagged it as a TODO.

A 72-hour clock is short, and it starts before you understand what happened. That's
precisely why the runbook has to exist beforehand.

---

## Incident runbook

**An incident is:** any unauthorised access, exposure, or loss of client data or
credentials — suspected or confirmed. **Suspected counts.** Investigate first, classify
after.

### Hour 0–1: contain

1. **Call the cyber insurer's breach hotline first.** They usually run the response,
   and calling them first is often a policy condition — doing it late can affect
   coverage. See `../../business/03-insurance-and-risk.md` §2.
2. **Hit the kill switch** (charter §10). Stop all agent outbound before anything else.
3. Revoke exposed credentials. Rotate keys. Isolate affected systems.
4. Start a written timeline. Every action, timestamped, from this moment.

### Hour 1–24: scope

5. What data, whose data, how much, when, how.
6. Is it still ongoing?
7. Preserve logs — including `agent_log`. Do not clean anything up.
8. Identify every affected client.

### Hour 24–72: notify

9. **Affected clients** — MSA §13.2 commits to notice without undue delay and within
   72 hours.
10. **The relevant authority**, if personal data is involved and the threshold is met.
11. **Data subjects**, where required.
12. Notification says: what happened, what data, what we've done, what they should do,
    who to contact. Facts only, no speculation.

### After

13. Root cause. Fix. Document.
14. Update this runbook with what it didn't cover.

**PROHIBITIONS** — Agents have no role in incident response beyond being stopped.
No automated notification, no automated client contact, no "helpful" summary. Every
communication in an incident is a human act with legal weight.

---

## SOP 08.1 — Credential handling

**The rules, and they don't bend:**

- Credentials **never** arrive or travel by plain email, chat, or SMS
- Accepted: a password manager share, or an encrypted one-time-link service
- Never in a repository, a document, a ticket, or an SOP
- **Never in agent context** (charter §7). Operators track *whether* an item was
  received, never its value
- Least privilege. Never request access broader than the SOW needs
- Removed or reduced at handoff, and **confirmed in writing**
  (`../../templates/handoff-checklist.md`)

**If a client sends a credential insecurely:** escalate, tell them to rotate it, record
it. Do not simply use it and move on — that normalises the behaviour and leaves a live
secret in a mail server.

---

## SOP 08.2 — Quarterly access review

List every system holding client data, every credential held, and every agent
operator's permissions. Remove anything not needed. Confirm removals from closed
projects actually happened.

**The point:** access accumulates silently. The credential you forgot you had is the
one that shows up in an incident.

---

## SOP 08.3 — When an agent operator does something wrong

Not a security breach in the classic sense, but the same discipline applies — and with
autonomous operators, this is the more likely scenario.

**Examples:** a reminder sent after payment · a message to the wrong recipient · a
message that stated something untrue · contact continuing after a client asked it to
stop · anything sent that touched a client's AI restriction.

**STEPS**
1. **Kill switch.** Stop everything, not just the offending operator.
2. Pull `agent_log` for the full sequence. Determine what was sent, to whom, when.
3. Classify: annoying, or harmful?
   - **Annoying** (a duplicate reminder) → correct it, apologise once, plainly.
   - **Harmful** (a false statement, a data exposure, a message to the wrong client) →
     human contacts the client directly, explains what happened, says what was done.
4. **Fix the SOP, not the instance.** Charter §11: if an operator did something wrong
   inside its rules, the rules were wrong.
5. Record the decision and the change.

**On telling the client:** an automated message that misstated something is a false
statement the business made. The fact that a machine composed it is an explanation, not
a defence. Tell them.

---

## SOP 08.4 — Client security questionnaire

Clients above a certain size will send one, and answering from scratch stalls a deal
for weeks. Assemble once, maintain quarterly
(`../../business/04-ai-delivery-policy.md` §8):

- AI tool register — [`../../contracts/ai-tool-register.md`](../../contracts/ai-tool-register.md)
- Subprocessor list — [`../../contracts/subprocessor-list.md`](../../contracts/subprocessor-list.md)
- Data handling and retention
- Access control and secrets management
- Backup and recovery
- Incident response summary — this document
- Certificate of insurance
- Subcontractor policy (currently: none)

**You do not need SOC 2.** You need to answer in two days instead of three weeks.
Revisit certification only if enterprise clients start requiring it — and if they do,
that's a good problem.

---

## What must exist before the first client

- [ ] Cyber insurer's breach hotline number, saved where you'd find it in a panic
- [ ] Password manager in place
- [ ] Kill switch implemented and **tested**
- [ ] `agent_log` capturing content, not just events
- [ ] This runbook read once, in advance, not for the first time during an incident
