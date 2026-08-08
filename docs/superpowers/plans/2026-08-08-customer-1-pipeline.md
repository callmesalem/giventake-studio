# Customer #1 Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the V1 Customer #1 pipeline: lead-source capture, consent-safe conversion events, qualification brief support, and outreach/reporting templates.

**Architecture:** Keep the public website as the intake entry point. Extend the existing TanStack Start server intake flow rather than replacing it; add small helpers for attribution and event tracking so the contact form stays readable.

**Tech Stack:** React 19, TanStack Start server functions, TypeScript, Zod, Vite, existing static Node `.mjs` invariant tests, consent system in `src/lib/tracking.ts`.

## Global Constraints

- No autonomous outreach sending.
- No autonomous client replies.
- No paid ad campaigns.
- No full CRM migration.
- No full agent runtime.
- No bulk cold email.
- No automatic pricing, acceptance, or rejection decisions.
- Tracking must stay consent-gated.
- No personal data in analytics events.
- The existing sensitive-data warning must remain visible near the contact form.
- The form must still work when analytics consent is denied.
- The server-side intake path must keep the current email and mailto fallback behavior.

---

## File Structure

- Modify `src/lib/intake-schema.ts`: add lead-source options, attribution field validation, and extend `ContactInput`.
- Create `src/lib/lead-attribution.ts`: read and normalize URL/referrer attribution on the client.
- Modify `src/lib/intake.ts`: include source and attribution in the internal email body without logging personal data.
- Modify `src/components/sections/contact.tsx`: add the source UI, hidden attribution fields, and track submit outcomes.
- Modify `src/lib/tracking.ts`: add a consent-safe lead-event helper that drops personal fields and only emits after matching consent.
- Create `src/lib/qualification-brief.ts`: deterministic helper for an internal two-minute lead brief.
- Create `docs/templates/warm-outreach-list.csv`: 80-contact warm list template header plus sample empty rows.
- Create `docs/templates/referral-partner-list.csv`: 20-partner referral list template header plus sample empty rows.
- Create `docs/templates/customer-1-weekly-report.md`: weekly Customer #1 reporting template.
- Create or extend `tests/customer-1-pipeline.test.mjs`: static invariant checks for the pipeline requirements.

---

### Task 1: Lead Source Schema And Attribution Helper

**Files:**
- Modify: `src/lib/intake-schema.ts`
- Create: `src/lib/lead-attribution.ts`
- Create: `tests/customer-1-pipeline.test.mjs`

**Interfaces:**
- Produces: `CONTACT_SOURCE_OPTIONS: readonly [{ value: string; label: string }, ...]`
- Produces: `ATTRIBUTION_KEYS: readonly ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "referrer"]`
- Produces: `readLeadAttribution(): LeadAttribution`
- Produces: `ContactInput` fields `source`, `source_detail`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `referrer`

- [ ] **Step 1: Write the failing invariant test**

Create `tests/customer-1-pipeline.test.mjs`:

```js
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const intakeSchema = read("src/lib/intake-schema.ts");
const contactForm = read("src/components/sections/contact.tsx");
const tracking = read("src/lib/tracking.ts");

assert(
  intakeSchema.includes("CONTACT_SOURCE_OPTIONS"),
  "contact schema must export CONTACT_SOURCE_OPTIONS",
);
assert(intakeSchema.includes("source:"), "contact schema must validate source");
assert(intakeSchema.includes("source_detail"), "contact schema must validate source_detail");
for (const key of [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "referrer",
]) {
  assert(intakeSchema.includes(key), `contact schema must validate ${key}`);
}

assert(
  existsSync(join(root, "src/lib/lead-attribution.ts")),
  "lead attribution helper must exist",
);
const attribution = read("src/lib/lead-attribution.ts");
assert(attribution.includes("ATTRIBUTION_KEYS"), "attribution helper must list keys");
assert(attribution.includes("readLeadAttribution"), "attribution helper must export reader");
assert(attribution.includes("URLSearchParams"), "attribution helper must read UTM query params");
assert(attribution.includes("document.referrer"), "attribution helper must capture referrer");

assert(
  contactForm.includes('name="source"'),
  "contact form must include a visible source field",
);
assert(
  contactForm.includes('name="source_detail"'),
  "contact form must include source detail field",
);
assert(
  contactForm.includes("How did you hear about us?"),
  "contact form must ask how the lead heard about GivenTake",
);

assert(
  tracking.includes("trackLeadEvent"),
  "tracking must expose trackLeadEvent",
);

console.log("Customer #1 pipeline invariants passed.");
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests\customer-1-pipeline.test.mjs`

Expected: `FAIL` with `contact schema must export CONTACT_SOURCE_OPTIONS`.

- [ ] **Step 3: Add schema fields**

In `src/lib/intake-schema.ts`, add the source tuple above `contactSchema`:

```ts
export const CONTACT_SOURCE_OPTIONS = [
  { value: "warm_network", label: "Someone I know / warm referral" },
  { value: "referral_partner", label: "Referral partner" },
  { value: "google_search", label: "Google or search" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "direct", label: "Typed the website directly" },
  { value: "article_or_content", label: "Article or content" },
  { value: "other", label: "Other" },
] as const;

const contactSourceValues = CONTACT_SOURCE_OPTIONS.map((option) => option.value) as [
  (typeof CONTACT_SOURCE_OPTIONS)[number]["value"],
  ...(typeof CONTACT_SOURCE_OPTIONS)[number]["value"][],
];

const optionalAttribution = z.string().trim().max(200).optional();
```

Extend `contactSchema` with:

```ts
source: z.enum(contactSourceValues, { required_error: "Select how you heard about us" }),
source_detail: z.string().trim().max(160).optional(),
utm_source: optionalAttribution,
utm_medium: optionalAttribution,
utm_campaign: optionalAttribution,
utm_content: optionalAttribution,
utm_term: optionalAttribution,
referrer: optionalAttribution,
```

- [ ] **Step 4: Add attribution helper**

Create `src/lib/lead-attribution.ts`:

```ts
export const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "referrer",
] as const;

export type AttributionKey = (typeof ATTRIBUTION_KEYS)[number];
export type LeadAttribution = Partial<Record<AttributionKey, string>>;

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 200) : undefined;
}

export function readLeadAttribution(): LeadAttribution {
  if (typeof window === "undefined") return {};

  const params = new URLSearchParams(window.location.search);
  const attribution: LeadAttribution = {};

  for (const key of ATTRIBUTION_KEYS) {
    if (key === "referrer") continue;
    const value = clean(params.get(key));
    if (value) attribution[key] = value;
  }

  const referrer = clean(document.referrer);
  if (referrer) attribution.referrer = referrer;

  return attribution;
}
```

- [ ] **Step 5: Run the test to confirm the new schema/helper checks pass past this point**

Run: `node tests\customer-1-pipeline.test.mjs`

Expected: `FAIL` with `contact form must include a visible source field`.

- [ ] **Step 6: Commit this task**

```bash
git add src/lib/intake-schema.ts src/lib/lead-attribution.ts tests/customer-1-pipeline.test.mjs
git commit -m "Add lead source schema and attribution helper"
```

---

### Task 2: Contact Form Source Capture

**Files:**
- Modify: `src/components/sections/contact.tsx`
- Modify: `src/lib/intake.ts`
- Test: `tests/customer-1-pipeline.test.mjs`

**Interfaces:**
- Consumes: `CONTACT_SOURCE_OPTIONS` from `src/lib/intake-schema.ts`
- Consumes: `readLeadAttribution()` from `src/lib/lead-attribution.ts`
- Produces: source and attribution included in `submitContact({ data: payload })`

- [ ] **Step 1: Extend the failing test for hidden attribution fields**

Add these assertions after the `source_detail` contact form assertion:

```js
for (const key of [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "referrer",
]) {
  assert(contactForm.includes(`name="${key}"`), `contact form must submit ${key}`);
}
assert(contactForm.includes("readLeadAttribution"), "contact form must read attribution");
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests\customer-1-pipeline.test.mjs`

Expected: `FAIL` with `contact form must include a visible source field`.

- [ ] **Step 3: Import source options and attribution**

Change imports in `src/components/sections/contact.tsx`:

```ts
import { contactSchema, CONTACT_SOURCE_OPTIONS } from "@/lib/intake-schema";
import { readLeadAttribution, type LeadAttribution } from "@/lib/lead-attribution";
```

Add state inside `ContactCTA`:

```ts
const [attribution] = useState<LeadAttribution>(() => readLeadAttribution());
```

- [ ] **Step 4: Include source and attribution in the mailto fallback**

In `handOffToMailClient`, add these lines after timeline:

```ts
`Source: ${d.source}`,
d.source_detail ? `Source detail: ${d.source_detail}` : null,
d.utm_source ? `UTM source: ${d.utm_source}` : null,
d.utm_medium ? `UTM medium: ${d.utm_medium}` : null,
d.utm_campaign ? `UTM campaign: ${d.utm_campaign}` : null,
d.utm_content ? `UTM content: ${d.utm_content}` : null,
d.utm_term ? `UTM term: ${d.utm_term}` : null,
d.referrer ? `Referrer: ${d.referrer}` : null,
```

- [ ] **Step 5: Add the source UI**

Place this block between project description and the budget/timeline grid:

```tsx
<div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
  <Field label="How did you hear about us?">
    <Select name="source" required>
      <SelectTrigger
        aria-label="How did you hear about us?"
        className="h-11 rounded-xl border-hairline bg-paper focus:ring-0"
      >
        <SelectValue placeholder="Select" />
      </SelectTrigger>
      <SelectContent>
        {CONTACT_SOURCE_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </Field>
  <Field label="Source detail">
    <Input
      name="source_detail"
      maxLength={160}
      placeholder="Name, partner, or short context"
      className="h-11 rounded-xl border-hairline bg-paper focus-visible:border-violet focus-visible:ring-0"
    />
  </Field>
</div>
```

- [ ] **Step 6: Add hidden attribution fields**

Place this block before the submit button:

```tsx
{(["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "referrer"] as const).map(
  (key) => (
    <input key={key} type="hidden" name={key} value={attribution[key] ?? ""} />
  ),
)}
```

- [ ] **Step 7: Include source and attribution in server email**

In `src/lib/intake.ts`, add these lines to the contact email body after timeline:

```ts
`Source: ${data.source}`,
data.source_detail ? `Source detail: ${data.source_detail}` : null,
data.utm_source ? `UTM source: ${data.utm_source}` : null,
data.utm_medium ? `UTM medium: ${data.utm_medium}` : null,
data.utm_campaign ? `UTM campaign: ${data.utm_campaign}` : null,
data.utm_content ? `UTM content: ${data.utm_content}` : null,
data.utm_term ? `UTM term: ${data.utm_term}` : null,
data.referrer ? `Referrer: ${data.referrer}` : null,
```

- [ ] **Step 8: Run the invariant test**

Run: `node tests\customer-1-pipeline.test.mjs`

Expected: `FAIL` with `tracking must expose trackLeadEvent`.

- [ ] **Step 9: Run TypeScript**

Run: `npx tsc --noEmit`

Expected: `PASS`.

- [ ] **Step 10: Commit this task**

```bash
git add src/components/sections/contact.tsx src/lib/intake.ts tests/customer-1-pipeline.test.mjs
git commit -m "Capture lead source on contact form"
```

---

### Task 3: Consent-Safe Lead Event Tracking

**Files:**
- Modify: `src/lib/tracking.ts`
- Modify: `src/components/sections/contact.tsx`
- Test: `tests/customer-1-pipeline.test.mjs`

**Interfaces:**
- Produces: `trackLeadEvent(name: LeadEventName, properties: LeadEventProperties): void`
- Consumes: `trackLeadEvent` from contact form submit outcomes
- Uses existing `window.gtag`, `window.fbq`, `window.ttq`, `window.lintrk`, `window.uetq`

- [ ] **Step 1: Extend the failing test for event safety**

Add these assertions after the existing `trackLeadEvent` assertion:

```js
assert(
  tracking.includes("type LeadEventName") &&
    tracking.includes('"lead_form_submit_success"') &&
    tracking.includes('"lead_form_mailto_fallback"') &&
    tracking.includes('"lead_form_submit_error"'),
  "tracking must define lead event names",
);
assert(
  tracking.includes("sanitizeLeadEventProperties"),
  "tracking must sanitize lead event properties",
);
const propertiesBlock = tracking.match(/type LeadEventProperties = \{[\s\S]*?\};/)?.[0] ?? "";
for (const forbidden of ["name?:", "email?:", "company?:", "description?:", "source_detail?:"]) {
  assert(
    !propertiesBlock.includes(forbidden),
    `tracking event properties must not include personal field ${forbidden}`,
  );
}
assert(
  contactForm.includes("trackLeadEvent"),
  "contact form must call trackLeadEvent after submit outcomes",
);
assert(
  contactForm.includes("lead_form_submit_success"),
  "contact form must track successful submissions",
);
assert(
  contactForm.includes("lead_form_mailto_fallback"),
  "contact form must track mailto fallback",
);
assert(
  contactForm.includes("lead_form_submit_error"),
  "contact form must track submit errors",
);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests\customer-1-pipeline.test.mjs`

Expected: `FAIL` with `tracking must define lead event names`.

- [ ] **Step 3: Add lead event types and sanitizer**

In `src/lib/tracking.ts`, add near the top after `type Loaded`:

```ts
type LeadEventName =
  | "lead_form_submit_success"
  | "lead_form_mailto_fallback"
  | "lead_form_submit_error";

type LeadEventProperties = {
  budget?: string;
  timeline?: string;
  source?: string;
  path?: string;
};

let currentConsent: ConsentState = {
  necessary: true,
  analytics: false,
  marketing: false,
  preferences: false,
};

function sanitizeLeadEventProperties(properties: LeadEventProperties) {
  return {
    budget: properties.budget,
    timeline: properties.timeline,
    source: properties.source,
    path:
      properties.path ??
      (typeof window !== "undefined" ? window.location.pathname : undefined),
  };
}
```

- [ ] **Step 4: Store consent state inside apply**

At the top of `apply(state: ConsentState)`, add:

```ts
currentConsent = state;
```

- [ ] **Step 5: Export trackLeadEvent**

Add this near the bottom of `src/lib/tracking.ts`, before `initTracking`:

```ts
export function trackLeadEvent(name: LeadEventName, properties: LeadEventProperties) {
  if (typeof window === "undefined") return;

  const safeProperties = sanitizeLeadEventProperties(properties);

  if (currentConsent.analytics) {
    window.gtag?.("event", name, safeProperties);
  }

  if (currentConsent.marketing) {
    window.fbq?.("trackCustom", name, safeProperties);
    window.ttq?.track?.(name, safeProperties);
    window.lintrk?.("track", safeProperties);
    if (Array.isArray(window.uetq)) {
      window.uetq.push("event", name, safeProperties);
    } else {
      window.uetq?.push?.("event", name, safeProperties);
    }
  }
}
```

- [ ] **Step 6: Call tracking from contact outcomes**

In `src/components/sections/contact.tsx`, import:

```ts
import { trackLeadEvent } from "@/lib/tracking";
```

Create a local helper inside `ContactCTA`:

```ts
function leadEventProps(d: z.infer<typeof schema>) {
  return {
    budget: d.budget,
    timeline: d.timeline,
    source: d.source,
    path: typeof window !== "undefined" ? window.location.pathname : undefined,
  };
}
```

In the `sent` branch before `setOutcome("sent")`, add:

```ts
trackLeadEvent("lead_form_submit_success", leadEventProps(parsed.data));
```

In `handOffToMailClient`, before `setOutcome("mailto")`, add:

```ts
trackLeadEvent("lead_form_mailto_fallback", leadEventProps(d));
```

In the `result.status === "error"` branch, add:

```ts
trackLeadEvent("lead_form_submit_error", leadEventProps(parsed.data));
```

In the `catch` block before `handOffToMailClient(parsed.data)`, add:

```ts
trackLeadEvent("lead_form_submit_error", leadEventProps(parsed.data));
```

- [ ] **Step 7: Run the invariant test**

Run: `node tests\customer-1-pipeline.test.mjs`

Expected: `PASS` with `Customer #1 pipeline invariants passed.`

- [ ] **Step 8: Run TypeScript**

Run: `npx tsc --noEmit`

Expected: `PASS`.

- [ ] **Step 9: Commit this task**

```bash
git add src/lib/tracking.ts src/components/sections/contact.tsx tests/customer-1-pipeline.test.mjs
git commit -m "Track lead conversions with consent"
```

---

### Task 4: Qualification Brief Helper

**Files:**
- Create: `src/lib/qualification-brief.ts`
- Modify: `tests/customer-1-pipeline.test.mjs`

**Interfaces:**
- Produces: `createQualificationBrief(input: ContactInput): QualificationBrief`
- Produces: `QualificationBrief` fields `summary`, `offerMatch`, `budget`, `timeline`, `source`, `missingInformation`, `flags`, `recommendedNextAction`

- [ ] **Step 1: Extend the invariant test**

Add this block before the final `console.log`:

```js
assert(
  existsSync(join(root, "src/lib/qualification-brief.ts")),
  "qualification brief helper must exist",
);
const qualificationBrief = read("src/lib/qualification-brief.ts");
for (const token of [
  "createQualificationBrief",
  "offerMatch",
  "budget",
  "timeline",
  "source",
  "missingInformation",
  "regulated",
  "recommendedNextAction",
]) {
  assert(qualificationBrief.includes(token), `qualification brief must include ${token}`);
}
assert(
  qualificationBrief.includes("ContactInput"),
  "qualification brief must consume ContactInput",
);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests\customer-1-pipeline.test.mjs`

Expected: `FAIL` with `qualification brief helper must exist`.

- [ ] **Step 3: Add deterministic brief helper**

Create `src/lib/qualification-brief.ts`:

```ts
import type { ContactInput } from "@/lib/intake-schema";
import { offers } from "@/lib/offers";

export type QualificationFlag =
  | "regulated"
  | "below_minimum"
  | "urgent"
  | "uncertain_offer";

export type QualificationBrief = {
  summary: string;
  offerMatch: string;
  budget: string;
  timeline: string;
  source: string;
  missingInformation: string[];
  flags: QualificationFlag[];
  recommendedNextAction: string;
};

const regulatedPattern =
  /\b(health|medical|hipaa|financial|investment|securities|bank|credential|password|government|ssn|social security|tax|legal)\b/i;

function matchOffer(description: string) {
  const normalized = description.toLowerCase();
  const offer = offers.find((candidate) => {
    const haystack = `${candidate.title} ${candidate.tagline} ${candidate.problem.join(" ")} ${candidate.outcome}`.toLowerCase();
    return haystack
      .split(/\W+/)
      .filter((word) => word.length > 5)
      .some((word) => normalized.includes(word));
  });

  return offer?.title ?? "Uncertain";
}

export function createQualificationBrief(input: ContactInput): QualificationBrief {
  const flags: QualificationFlag[] = [];
  const missingInformation: string[] = [];
  const offerMatch = matchOffer(input.description);

  if (offerMatch === "Uncertain") flags.push("uncertain_offer");
  if (input.budget === "500-2.5k" || input.budget === "discovery") flags.push("below_minimum");
  if (input.timeline === "asap") flags.push("urgent");
  if (regulatedPattern.test(input.description)) flags.push("regulated");
  if (!input.company) missingInformation.push("Company");
  if (!input.source_detail && (input.source === "warm_network" || input.source === "referral_partner")) {
    missingInformation.push("Referral name or source detail");
  }

  const recommendedNextAction = flags.includes("regulated")
    ? "Human review before any substantive reply"
    : "Human to send a short acknowledgement and schedule discovery";

  return {
    summary: input.description.slice(0, 240),
    offerMatch,
    budget: input.budget,
    timeline: input.timeline,
    source: input.source,
    missingInformation,
    flags,
    recommendedNextAction,
  };
}
```

- [ ] **Step 4: Run the invariant test**

Run: `node tests\customer-1-pipeline.test.mjs`

Expected: `PASS`.

- [ ] **Step 5: Run TypeScript**

Run: `npx tsc --noEmit`

Expected: `PASS`.

- [ ] **Step 6: Commit this task**

```bash
git add src/lib/qualification-brief.ts tests/customer-1-pipeline.test.mjs
git commit -m "Add lead qualification brief helper"
```

---

### Task 5: Outreach And Weekly Report Templates

**Files:**
- Create: `docs/templates/warm-outreach-list.csv`
- Create: `docs/templates/referral-partner-list.csv`
- Create: `docs/templates/customer-1-weekly-report.md`
- Modify: `tests/customer-1-pipeline.test.mjs`

**Interfaces:**
- Produces: CSV headers used by the manual lead tracker.
- Produces: weekly report headings for conversations, replies, proposals, sources, follow-ups, and time spent.

- [ ] **Step 1: Extend the invariant test**

Add this block before the final `console.log`:

```js
for (const path of [
  "docs/templates/warm-outreach-list.csv",
  "docs/templates/referral-partner-list.csv",
  "docs/templates/customer-1-weekly-report.md",
]) {
  assert(existsSync(join(root, path)), `${path} must exist`);
}

const warmList = read("docs/templates/warm-outreach-list.csv");
const partnerList = read("docs/templates/referral-partner-list.csv");
const report = read("docs/templates/customer-1-weekly-report.md");

for (const header of [
  "name",
  "company",
  "relationship_context",
  "channel",
  "segment",
  "last_contacted",
  "follow_up_date",
  "status",
  "referral_outcome",
  "notes",
]) {
  assert(warmList.startsWith("name,"), "warm list must start with CSV headers");
  assert(warmList.includes(header), `warm list must include ${header}`);
}

for (const header of [
  "name",
  "company",
  "partner_type",
  "channel",
  "last_contacted",
  "follow_up_date",
  "status",
  "referrals_received",
  "outcome_reported_back",
  "notes",
]) {
  assert(partnerList.startsWith("name,"), "partner list must start with CSV headers");
  assert(partnerList.includes(header), `partner list must include ${header}`);
}

for (const heading of [
  "Warm Outreach",
  "Referral Partners",
  "Lead Sources",
  "Conversations Booked",
  "Proposals",
  "Follow-Ups Due",
  "Time Spent",
  "Next Week",
]) {
  assert(report.includes(heading), `weekly report must include ${heading}`);
}
assert(
  report.includes("Humans sent every prospect-facing message"),
  "weekly report must include human-send guardrail",
);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests\customer-1-pipeline.test.mjs`

Expected: `FAIL` with `docs/templates/warm-outreach-list.csv must exist`.

- [ ] **Step 3: Create warm outreach list template**

Create `docs/templates/warm-outreach-list.csv`:

```csv
name,company,relationship_context,channel,segment,last_contacted,follow_up_date,status,referral_outcome,notes
,,,,,,,,,
,,,,,,,,,
,,,,,,,,,
,,,,,,,,,
,,,,,,,,,
,,,,,,,,,
,,,,,,,,,
,,,,,,,,,
,,,,,,,,,
,,,,,,,,,
```

- [ ] **Step 4: Create referral partner list template**

Create `docs/templates/referral-partner-list.csv`:

```csv
name,company,partner_type,channel,last_contacted,follow_up_date,status,referrals_received,outcome_reported_back,notes
,,,,,,,,,
,,,,,,,,,
,,,,,,,,,
,,,,,,,,,
,,,,,,,,,
,,,,,,,,,
,,,,,,,,,
,,,,,,,,,
,,,,,,,,,
,,,,,,,,,
```

- [ ] **Step 5: Create weekly report template**

Create `docs/templates/customer-1-weekly-report.md`:

```md
# Customer #1 Weekly Report

Week of:

## Warm Outreach

- Messages drafted:
- Messages sent by human:
- Replies:
- Follow-ups scheduled:

## Referral Partners

- Partners contacted by human:
- Replies:
- Referral conversations:
- Outcomes reported back:

## Lead Sources

| Source | Leads | Conversations | Notes |
|---|---:|---:|---|
| Warm network | 0 | 0 | |
| Referral partner | 0 | 0 | |
| Search | 0 | 0 | |
| LinkedIn | 0 | 0 | |
| Direct | 0 | 0 | |
| Other | 0 | 0 | |

## Conversations Booked

- Count:
- Names:
- Source:

## Proposals

- Sent:
- Accepted:
- Lost:
- Waiting:

## Follow-Ups Due

| Person | Source | Due date | Human next action |
|---|---|---|---|
| | | | |

## Time Spent

| Channel | Hours | Conversations | Keep / change |
|---|---:|---:|---|
| Warm outreach | 0 | 0 | |
| Referral partners | 0 | 0 | |
| Content/search | 0 | 0 | |

## Guardrail Check

- Humans sent every prospect-facing message:
- No invented urgency, scarcity, testimonials, or results:
- No automatic pricing, acceptance, or rejection:

## Next Week

- Top priority:
- People to contact:
- Partner follow-ups:
- Site or intake improvements:
```

- [ ] **Step 6: Run the invariant test**

Run: `node tests\customer-1-pipeline.test.mjs`

Expected: `PASS`.

- [ ] **Step 7: Commit this task**

```bash
git add docs/templates/warm-outreach-list.csv docs/templates/referral-partner-list.csv docs/templates/customer-1-weekly-report.md tests/customer-1-pipeline.test.mjs
git commit -m "Add Customer 1 outreach templates"
```

---

### Task 6: Final Verification And Launch Notes

**Files:**
- Modify: `docs/business/06-launch-checklist.md`
- Modify: `docs/operations/02-sales-pipeline/README.md`
- Test: existing test suite and build commands

**Interfaces:**
- Consumes: all previous task outputs.
- Produces: docs that point operators to the Customer #1 pipeline assets.

- [ ] **Step 1: Add doc references**

In `docs/business/06-launch-checklist.md`, under `Phase 4 - Go to market`, add two checklist items:

```md
- [ ] Use `docs/templates/warm-outreach-list.csv` to build the first 80 to 100 warm-network names.
- [ ] Use `docs/templates/customer-1-weekly-report.md` every Monday until Customer #1 is won.
```

In `docs/operations/02-sales-pipeline/README.md`, under `SOP 02.1 - Lead intake`, add:

```md
Lead source from the website form is required for every new enquiry. If a lead arrives
by email without a source, ask "How did you hear about GivenTake?" during the first
human reply and backfill the tracker.
```

- [ ] **Step 2: Run all invariant tests**

Run:

```bash
node tests\customer-1-pipeline.test.mjs
node tests\compliance-tracking.test.mjs
node tests\launch-identity.test.mjs
```

Expected: all three commands exit `0`.

- [ ] **Step 3: Run lint**

Run: `npm run lint`

Expected: exit `0`.

- [ ] **Step 4: Run TypeScript**

Run: `npx tsc --noEmit`

Expected: exit `0`.

- [ ] **Step 5: Run production build**

Run: `npm run build`

Expected: exit `0`. Known non-blocking warnings about Lovable font asset runtime resolution and Vite tsconfig paths may remain.

- [ ] **Step 6: Commit final docs**

```bash
git add docs/business/06-launch-checklist.md docs/operations/02-sales-pipeline/README.md
git commit -m "Document Customer 1 lead source workflow"
```

---

## Implementation Order

1. Task 1: Lead source schema and attribution helper.
2. Task 2: Contact form source capture.
3. Task 3: Consent-safe lead event tracking.
4. Task 4: Qualification brief helper.
5. Task 5: Outreach and weekly report templates.
6. Task 6: Final verification and launch notes.

Each task should be implemented with a red-green test cycle, reviewed, and committed before moving to the next task.
