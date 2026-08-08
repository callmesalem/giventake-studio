# Customer #1 Pipeline Design

Date: 2026-08-08

## Purpose

GivenTake Devs needs the shortest reliable path to its first real customer. The next build should support warm-network and referral outreach first, with only enough automation to capture leads, prepare follow-up, and measure what is working.

This is not the full future agent ecosystem. V1 is a human-reviewed sales and marketing pipeline that makes outreach easier without letting automation spend trust.

## Decision

Use the **Warm Outreach + Assisted Intake** path.

The business will prioritize:

1. Warm-network referral requests.
2. Referral partner conversations.
3. Website intake that captures lead source and project details.
4. Internal AI-assisted qualification briefs.
5. Human-approved replies and follow-ups.

Inbound SEO/content and paid ads are secondary for this phase. They can compound later, but Customer #1 is more likely to come from direct relationships than anonymous traffic.

## Scope

V1 includes:

- Lead-source capture on the website contact form.
- Basic attribution fields that still work when analytics consent is denied.
- Conversion/event tracking after a successful contact submission.
- A warm outreach list template.
- A referral partner list template.
- A lead qualification brief format.
- A weekly Customer #1 report format.
- Tests that protect the form, warnings, consent-gated tracking, and conversion-event behavior.

V1 does not include:

- Autonomous outreach sending.
- Autonomous client replies.
- Paid ad campaigns.
- A full CRM migration.
- A full agent runtime.
- Bulk cold email.
- Automatic pricing, acceptance, or rejection decisions.

## Architecture

The website remains the public entry point. A lead can arrive from a referral, warm message, partner introduction, direct visit, or content link.

The contact form collects the project details already present today plus a visible "How did you hear about us?" field. The site should also capture simple UTM/referrer values when present. Declared lead source is more important than browser attribution because consent settings and privacy tools can block analytics.

The server-side intake path continues to email the brief. When n8n and Attio are ready, the same submission shape can feed:

- n8n webhook
- Attio Person
- Attio Company
- Attio Deal
- Founder notification
- AI-assisted internal brief

Until those systems are ready, the fallback is email plus a simple lead tracker document or spreadsheet.

## Components

### Website Intake

The contact form should add:

- `source`: required visible select field.
- `source_detail`: optional text field for names, partner, or context.
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`: optional hidden fields populated from the URL.
- `referrer`: optional hidden field when available.
- A successful-submit tracking event.

The sensitive-data warning must remain visible near the form. Submissions mentioning regulated, financial, health, credential, or other sensitive data should be treated conservatively.

### Tracking

Tracking must stay consent-gated.

Analytics or advertising scripts may load only after the visitor grants the relevant consent category. A successful lead event may be emitted only to providers that are already allowed by consent. The form still works when tracking is denied.

Suggested events:

- `lead_form_submit_success`
- `lead_form_mailto_fallback`
- `lead_form_submit_error`

Event properties should avoid personal data. Use non-sensitive fields such as budget range, timeline, source, and offer/page path.

### Outreach Lists

Create two lightweight templates:

- Warm network list: 80 to 100 named people.
- Referral partner list: 20 target partners.

Each row should track:

- Name
- Company
- Relationship/context
- Channel
- Segment
- Last contacted date
- Follow-up date
- Status
- Lead source or referral outcome
- Notes

Agents may draft outreach. Humans send every warm-network, referral partner, and cold outreach message.

### Qualification Brief

For every new lead, prepare an internal brief with:

- Plain-language summary.
- Likely offer match.
- Budget and timeline.
- Lead source.
- Missing information.
- Suggested discovery questions.
- Sensitive/regulated-data flags.
- Red flags.
- Recommended next human action.

The brief is internal only. It is never sent to the prospect automatically.

### Weekly Report

The weekly report should answer:

- How many warm messages were sent?
- How many referral partner messages were sent?
- How many replies came back?
- How many conversations were booked?
- How many leads arrived by source?
- How many proposals were created?
- What follow-ups are due?
- Which channel produced conversations for the time spent?

## Data Flow

1. Prospect hears about GivenTake through a warm message, referral, partner, content, search, or direct visit.
2. Prospect submits the contact form.
3. Form validates project details, consent acknowledgement, and lead source.
4. Server-side intake sends the brief to the business inbox, or falls back to mailto if provider configuration is missing.
5. The site emits a consent-respecting conversion event after successful submission or fallback.
6. Human reviews the lead.
7. Assisted qualification brief is created.
8. Human sends a reply.
9. Follow-up reminder is scheduled if there is no reply.
10. Weekly report summarizes activity and outcomes.

## Error Handling

- If server-side intake is unconfigured, use the existing mailto fallback.
- If server-side intake fails, show the existing direct-email fallback.
- If tracking consent is denied, do not load analytics/marketing scripts and do not send provider events.
- If source is missing, ask the visitor to select one.
- If the submission mentions sensitive or regulated data, flag it for human review before any substantive reply.
- If the AI brief cannot classify the lead, mark it as "uncertain" and escalate to the human.

## Privacy And Compliance Guardrails

- No personal data in analytics events.
- No hidden sale of personal data.
- No autonomous outreach.
- No invented testimonials, results, urgency, or scarcity.
- No automatic price, legal, tax, securities, compliance, or regulatory advice.
- Human approval is required before sending any prospect communication.
- Any future provider added to intake, CRM, or automation must be reflected in the privacy policy and subprocessor list before production use.

## Testing

Add focused tests for:

- Contact form includes a required lead-source field.
- Hidden attribution fields exist or are populated through a helper.
- Sensitive-data warning remains present.
- Successful form submission calls the conversion-event helper.
- Conversion-event helper avoids personal data fields.
- Tracking scripts remain consent-gated.
- No event is sent to analytics or advertising providers before consent.
- Qualification brief template contains source, offer match, budget, timeline, missing questions, and regulated-data flags.

## Success Criteria

This phase succeeds when:

- Every new form lead includes a source.
- Successful submissions trigger a consent-respecting conversion event.
- There is a working template for 80 to 100 warm contacts.
- There is a working template for 20 referral partners.
- A human can review a two-minute qualification brief before replying.
- Weekly reporting can show conversations started by source.
- No warm/referral message is sent automatically.

## Open Business Dependencies

- Attio account and initial pipeline setup.
- n8n hosting and secure webhook endpoint.
- Verified intake email sender if using Resend or another mail provider.
- Business address for legally required outbound email footers.
- Final review of public privacy, cookies, and subprocessor language after any new provider is configured.

These dependencies do not block the website-side V1. They block deeper automation and production outbound workflows.
