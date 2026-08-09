# GivenTake Growth OS Foundation Design

Date: 2026-08-09
Status: Approved product direction; Release 1 implementation boundary

## Purpose

GivenTake Growth OS is a white-label-ready growth intelligence platform for local service businesses. It combines website leads, advertising performance, confirmed sales outcomes, geographic opportunity signals, and eventually coordinated marketing execution in one client-facing system.

The product's core promise is simple:

> Show which marketing activity produces qualified leads and confirmed revenue, then prepare the next best action for a human to approve.

GivenTake Devs will be the first internal tenant. A local service business, such as a public adjuster company, will be the first external pilot. The public website remains a separate marketing property; Growth OS runs as an authenticated application under a GivenTake-controlled domain such as `app.giventakedevs.com`.

## Product Decisions

The approved direction is:

- Connector-first, rather than rebuilding every advertising or analytics network.
- Multi-tenant and white-label-ready from the first release.
- Per-client logo, colors, company name, and report branding from the first release.
- Custom client domains and fully hidden GivenTake branding after the core product is proven.
- Lead attribution and return on investment as the primary dashboard promise.
- Manually confirmed lead status and revenue in Release 1; CRM synchronization comes later.
- All major advertising, search, social, call, email, mail, and field channels are part of the roadmap.
- AI analyzes and drafts; a human approves all publishing, outreach, targeting changes, and spending.
- Geo intelligence operates on approved service areas and aggregated audiences, not covert tracking of individual phones, IP addresses, or households.
- Anonymous website activity never becomes permission to identify or directly contact a person.

The working product name is **GivenTake Growth OS**. Client-facing deployments may use the client's brand name instead.

## Scope Decomposition

The complete vision contains independent systems that should not share one implementation plan. Each release receives its own design refinement and implementation plan before code is written.

### Release 1: Foundation And ROI Dashboard

This document defines Release 1 in implementation-ready detail:

- Authenticated multi-tenant application.
- GivenTake platform administrator and client owner roles.
- Per-client brand settings.
- Website lead ingestion using the existing consent-safe GivenTake event contract as the starting model.
- Lead and confirmed-revenue ledger.
- Deterministic attribution with evidence and confidence.
- Google Analytics 4, Google Ads, and Meta Ads connector interfaces and initial implementations.
- Daily normalized campaign metrics.
- Owner overview, lead pipeline, channel performance, and connection-health views.
- Manual lead qualification, won/lost status, and revenue entry.
- Privacy controls, tenant isolation, retention, audit history, and deletion workflows.

Release 1 does not publish campaigns, send outreach, purchase media, identify anonymous visitors, or make autonomous business decisions.

### Release 2: Full Intelligence Network

- TikTok, LinkedIn, Microsoft Ads, Search Console, call tracking, and additional analytics connectors.
- Detectable SEO and AI referral reporting.
- AI analysis grounded in normalized metrics and confirmed outcomes.
- Official weather and event feeds.
- Approved service areas, broad geographic opportunity scoring, and campaign-package drafts.

### Release 3: Omnichannel Activation Hub

- Channel-eligibility ledger for phone, SMS, email, named mail, area mail, digital advertising, and field canvassing.
- Human-approved campaign packages spanning multiple channels.
- Email and SMS integrations, phone work queues, USPS direct-mail preparation, and door-to-door territory workflows.
- Do-not-contact and do-not-knock suppression.
- Jurisdiction-specific rule packs, including public-adjuster solicitation constraints where applicable.
- Outcome tracking shared with the attribution engine.

### Release 4: Advanced White Label And Controlled Automation

- Custom client domains.
- Branded email delivery and exported reports.
- Agency administration and billing.
- Optional automatic execution inside explicitly approved channel, budget, time, geography, and compliance limits.

## Release 1 Architecture

Release 1 is a separate authenticated application that follows the studio's existing React, TanStack Start, and TypeScript conventions. It uses a managed Postgres database with row-level tenant isolation. Authentication, database access, connector secrets, and scheduled synchronization remain server-side.

The architecture has six bounded components.

### 1. Tenant And Identity Service

Responsibilities:

- Authenticate users.
- Associate users with one or more tenants.
- Enforce `platform_admin` and `client_owner` roles.
- Resolve the active tenant before any data query.
- Store the client's brand configuration independently from analytics data.

Every tenant-owned record contains `tenant_id`. Database row-level policies deny cross-tenant reads and writes even when an application query is incorrect. Platform-administrator access is explicit, audited, and unavailable through ordinary client routes.

### 2. Website And Lead Intake

The public website sends a small, versioned event contract to Growth OS. Release 1 accepts:

- Lead submission outcome.
- Declared source and optional source detail.
- UTM parameters and referring domain.
- Landing page and offer identifier.
- Non-sensitive budget and timeline ranges.
- Consent category state relevant to the event.
- Stable idempotency key.

Names, email addresses, phone numbers, and lead notes belong in the encrypted lead ledger, not analytics event properties. The intake endpoint validates the tenant, schema version, payload size, allowed fields, and idempotency key before accepting an event.

The site continues to work when analytics or marketing consent is denied. Declared source, necessary form delivery, and server-side lead creation remain available; advertising and analytics provider events remain disabled.

### 3. Connector Layer

Each external provider implements the same connector interface:

- Authorize and revoke a connection.
- Validate required scopes.
- Refresh credentials.
- Import a bounded time window.
- Normalize provider records.
- Checkpoint successful progress.
- Report connection health and recoverable errors.

Release 1 implements Google Analytics 4, Google Ads, and Meta Ads. Provider-specific payloads do not leak into dashboard code. A connector translates them into normalized accounts, campaigns, daily metrics, and conversion references.

OAuth tokens are encrypted with a server-only key, never returned to browsers, and requested with the minimum usable scopes. Revoking a connector stops future synchronization without deleting historical normalized metrics.

### 4. Lead, Revenue, And Attribution Core

The lead ledger is the source of truth for business outcomes. A client owner can mark a lead as:

- New.
- Qualified.
- Booked.
- Won.
- Lost.

A won lead may receive confirmed revenue, currency, confirmation date, and a short internal note. Revenue is never inferred by AI or counted from an advertising platform as confirmed business revenue.

Attribution is deterministic in Release 1. Evidence is considered in this order:

1. Declared lead source.
2. Valid advertising click identifier or provider conversion reference.
3. UTM campaign data.
4. Referring domain.
5. Direct or unknown.

The system stores first-touch and last-touch attribution separately, keeps the evidence used, and assigns `high`, `medium`, or `low` confidence. Conflicting or missing evidence remains visible as ambiguous or unattributed instead of being guessed away.

Core calculations are:

- Qualified-lead rate = qualified leads / total leads.
- Close rate = won leads / qualified leads.
- Cost per qualified lead = advertising spend / qualified leads attributed to paid media.
- Return on ad spend = confirmed paid-media revenue / advertising spend.
- Marketing ROI = (confirmed attributed revenue - marketing spend) / marketing spend.

Division by zero returns an unavailable state, never infinity or a misleading zero.

### 5. Client Dashboard

The approved dashboard prioritizes decisions over decorative analytics. The primary navigation is:

- Overview.
- Leads.
- Channels.
- Reports.
- Connections.
- Brand and settings.

The overview shows:

- Confirmed revenue.
- Marketing spend.
- Return on ad spend.
- Qualified leads and won customers.
- Revenue influenced by channel.
- Lead pipeline counts.
- Connection health and data freshness.
- Clear unattributed and ambiguous totals.

Every metric has a date range, currency, timezone, freshness timestamp, and drill-down path. Missing or stale provider data is labeled; it is not rendered as a real zero.

### 6. Audit, Privacy, And Retention Service

The service records:

- Authentication and role changes.
- Connector authorization, token refresh failure, and revocation.
- Lead status and revenue changes.
- Attribution recomputation.
- Export and deletion requests.
- Brand and retention-setting changes.
- Platform-administrator access to a client tenant.

Audit records identify the actor, tenant, action, target, timestamp, and request identifier. They do not copy lead notes or raw OAuth credentials.

Default retention is:

- Provider troubleshooting payloads: seven days, encrypted, then deleted.
- Normalized aggregate campaign metrics: twenty-five months.
- Pseudonymous website event detail: thirteen months.
- Lead contact and outcome records: twenty-four months after last activity unless the client selects a shorter period or has a documented legal need for longer retention.
- Security audit events: twenty-five months.

Raw IP addresses, precise location trails, device fingerprints, and advertising-ID location histories are not stored. Coarse city, postal area, county, or service-area buckets may be retained only when permitted and useful. Geographic performance cells are hidden until they contain at least 100 households or users; a provider's higher threshold takes precedence.

## Release 1 Data Model

The minimum entities are:

- `tenants`: client account and lifecycle state.
- `memberships`: user, tenant, and role.
- `brands`: logo reference, colors, display name, report identity.
- `sites`: verified client websites and event-ingestion credentials.
- `connections`: provider, external account reference, scopes, encrypted credential reference, and health.
- `sync_runs`: connector, time window, checkpoint, counts, status, and sanitized error.
- `campaigns`: normalized provider campaign identity and status.
- `campaign_metrics_daily`: impressions, clicks, spend, provider conversions, and date.
- `leads`: encrypted contact fields, lifecycle status, declared source, and timestamps.
- `attribution_touches`: source evidence, campaign references, touch type, and confidence.
- `revenue_outcomes`: confirmed amount, currency, date, actor, and lead.
- `consent_receipts`: policy version, categories, source, and timestamp for every accepted lead or provider event.
- `audit_events`: immutable security and business-change history.

External identifiers are unique within provider and tenant. Incoming events and webhooks use idempotency keys so retries cannot duplicate leads, conversions, or revenue.

## Release 1 Data Flow

### Website Lead Flow

1. A visitor reaches a verified tenant website.
2. The site records declared source and available attribution evidence.
3. Consent controls determine which analytics and advertising events may run.
4. A valid form submission creates or updates one lead through the server-side intake endpoint.
5. The event is deduplicated and the lead is linked to attribution evidence.
6. The client owner reviews the lead and updates its business status.
7. Confirmed revenue updates the dashboard and attribution calculations.

### Provider Synchronization Flow

1. A client owner authorizes an external account through OAuth.
2. The connector verifies scopes and performs a bounded initial import.
3. A scheduled job imports incremental windows into a temporary staging transaction.
4. The connector normalizes currency, timezone, campaign identity, and metric names.
5. The transaction publishes only after its window passes validation.
6. The dashboard exposes the last successful synchronization and any stale-data warning.

### Attribution Flow

1. The attribution service gathers declared source, click IDs, UTMs, referrer, and normalized campaigns.
2. It applies the deterministic precedence rules.
3. It stores first touch, last touch, evidence, and confidence.
4. Revenue calculations use only confirmed revenue and complete spend windows.
5. Recalculation is idempotent and creates an audit event when the visible result changes.

## Future Event, Geo, And Activation Boundaries

Later releases must preserve these rules:

- Official weather, alert, and public-event feeds may trigger opportunities for approved service areas.
- Advertising targets use provider-supported cities, postal areas, counties, radii, and aggregated audiences.
- Cross-device optimization occurs inside approved advertising platforms using consented first-party signals and platform controls.
- Growth OS does not expose a live map of an individual device or allow searching for a person by IP address.
- Anonymous visitors are not enriched into names, phone numbers, email addresses, or street addresses for outreach.
- Direct communication requires a lawful source and channel-specific eligibility.
- Area-based USPS carrier routes and canvassing territories do not require identifying website visitors.
- Sensitive locations and sensitive personal categories are excluded from audience building.
- AI may draft copy, audiences, budgets, mailpieces, scripts, and field plans; a human approves every external effect.

The future channel-eligibility ledger will keep separate states for email, manual phone, automated phone, SMS, named mail, area mail, digital advertising, and door-to-door contact. One channel's permission never implies permission for another.

## Privacy, Legal, And Security Guardrails

Growth OS is a compliance-supporting system, not a guarantee that a client's marketing is lawful. The client remains responsible for its offer, licensing, contact permissions, service areas, and jurisdiction-specific rules. GivenTake remains responsible for accurately implementing platform controls, honoring documented choices, securing data, and avoiding deceptive product claims.

Required safeguards include:

- Consent-gated analytics and marketing events.
- Global Privacy Control handling where applicable.
- Notice-at-collection, access, correction, deletion, and opt-out workflows.
- No sale of personal data or undisclosed cross-client data use.
- No pooled client audiences unless every affected client and person has an independently valid basis and the feature receives separate legal approval.
- No sensitive-location audiences, covert fingerprinting, precise phone tracking, or scraped personal profiles.
- No advertising events containing lead names, free-text notes, claim details, health information, financial information, credentials, or other sensitive data.
- Tenant row-level isolation and explicit role checks.
- Encryption in transit and at rest, with connector secrets encrypted separately.
- Rate limits, signed website ingestion, request-size limits, schema validation, and replay protection.
- Export and deletion procedures that include derived personal records and provider deletion calls where supported.
- Human approval before publishing, outreach, targeting changes, or spending.

Before public-adjuster activation features go live, counsel must review each supported jurisdiction's licensing, disaster solicitation, communication, disclosure, cancellation, and recordkeeping rules. The product presents configured rules and approval status without claiming to provide legal advice.

## Error Handling And Reliability

### Provider Failure

- A revoked or expired connection becomes `action_required`.
- Recoverable rate limits and network failures retry with bounded exponential backoff.
- The last successful dataset remains visible with a stale-data banner.
- Failed imports never replace prior metrics with zeroes.
- Partial windows remain staged and are not used for ROI calculations.

### Duplicate Or Late Data

- Idempotency keys prevent duplicate events and webhooks.
- Provider records use stable external keys and upserts.
- Late provider adjustments recompute only the affected date windows.
- Recomputed metrics preserve an audit trail.

### Attribution Uncertainty

- Missing evidence becomes `unattributed`.
- Conflicting evidence remains visible with reduced confidence.
- Manual correction requires a reason and audit event.
- AI cannot overwrite attribution evidence or confirmed revenue.

### Consent Or Privacy Failure

- Missing marketing consent prevents marketing-provider events.
- Missing analytics consent prevents analytics-provider events.
- Necessary form delivery remains available.
- A deletion request places affected records in a restricted state immediately, then performs the deletion workflow.
- A failed downstream deletion remains visible to administrators until resolved.

### Tenant Or Authorization Failure

- Access is denied by default when tenant context, membership, or role is missing.
- Cross-tenant identifiers return no data and generate a security event.
- Platform-administrator impersonation is prohibited; support access uses an explicit audited support session.

### AI Failure In Later Releases

- No recommendation is preferable to an ungrounded recommendation.
- Recommendations cite the metrics and time windows used.
- Invalid structured output is rejected.
- AI has no direct credential capable of sending, publishing, or spending.

## Testing Strategy

### Unit Tests

- Connector normalization for currency, timezone, campaign identity, and metrics.
- Attribution precedence, ambiguity, confidence, and recalculation.
- ROAS, ROI, rates, and zero-denominator behavior.
- Event sanitization and consent-category routing.
- Retention and deletion eligibility.
- Role and permission decisions.

### Connector Contract Tests

- Recorded, de-identified provider fixtures for successful, empty, paginated, adjusted, and rate-limited responses.
- Token refresh and revocation behavior.
- Checkpoint restart after an interrupted synchronization.
- Stable output contract across provider-specific changes.

### Integration Tests

- Signed website event ingestion and replay rejection.
- Webhook and scheduled-sync idempotency.
- Transactional publication of complete metric windows.
- Lead status and confirmed-revenue updates.
- Tenant row-level isolation for every tenant-owned table.
- Data export, deletion, and retention cleanup.

### End-To-End Tests

- Create a tenant, apply branding, invite a client owner, and verify access.
- Connect a provider test account and display synchronization health.
- Receive a lead, inspect attribution, mark it qualified and won, and record revenue.
- Verify dashboard totals and drill-downs for a selected date range.
- Revoke a provider and verify stale-data behavior without historical loss.
- Verify a client owner cannot access another tenant by URL, identifier, search, export, or API request.

### Compliance And Security Regression Tests

- No analytics or marketing provider call before matching consent.
- Global Privacy Control disables covered sharing behavior.
- No personal or sensitive fields in analytics events.
- Raw IP addresses and precise location are absent from persisted schemas.
- OAuth credentials never appear in browser bundles, logs, exports, or error messages.
- Audit events exist for role, connector, revenue, attribution, export, and deletion changes.

## Release 1 Success Criteria

Release 1 is successful when:

- GivenTake Devs and one pilot client operate as isolated tenants.
- Each tenant can apply its own logo, colors, and display name.
- The existing GivenTake site can create leads without weakening its consent controls.
- Google Analytics 4, Google Ads, and Meta Ads data normalize into one dashboard model.
- A client owner can mark leads qualified, booked, won, or lost and record confirmed revenue.
- The overview accurately reports spend, qualified leads, won customers, confirmed revenue, and ROAS for complete time windows.
- Attribution always shows its source evidence, confidence, and unattributed totals.
- Connection failures display freshness and recovery guidance without showing false zeroes.
- Automated tests demonstrate tenant isolation and consent-gated event behavior.
- No raw IP, device fingerprint, precise-location history, autonomous outreach, campaign publishing, or automatic spending exists in Release 1.

## Operational Dependencies

Release 1 implementation requires:

- A dedicated Growth OS application deployment and `app.giventakedevs.com` DNS entry.
- A managed Postgres project with row-level security and tested backups.
- An authentication configuration for GivenTake administrators and invited client owners.
- Google and Meta developer applications with approved OAuth redirect URLs and minimum scopes.
- A server-side encryption key and documented rotation procedure for connector credentials.
- Test or sandbox advertising accounts with de-identified fixtures when live test data is unavailable.
- Updated privacy notice, subprocessor list, data-processing terms, and client agreement before external pilot data is connected.

These are implementation inputs, not reasons to expand Release 1 scope.

## Current Authoritative References

- FTC sensitive location enforcement: <https://www.ftc.gov/legal-library/browse/cases-proceedings/ftc-v-kochava-inc>
- FTC X-Mode/Outlogic location-data order: <https://www.ftc.gov/news-events/news/press-releases/2024/01/ftc-order-prohibits-data-broker-x-mode-social-outlogic-selling-sensitive-location-data>
- California CCPA overview: <https://oag.ca.gov/privacy/ccpa>
- Google Ads location targeting: <https://support.google.com/google-ads/answer/10835274>
- Google customer-data policies: <https://support.google.com/google-ads/answer/7475709>
- Meta Conversions API: <https://www.facebook.com/business/help/AboutConversionsAPI>
- TikTok Events API: <https://ads.tiktok.com/help/article/events-api>
- LinkedIn Conversions API: <https://www.linkedin.com/help/lms/answer/a1655394>
- National Weather Service API: <https://www.weather.gov/documentation/services-web-api>
- FTC telemarketing guidance: <https://www.ftc.gov/business-guidance/resources/complying-telemarketing-sales-rule>
- FTC CAN-SPAM guide: <https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business>
- USPS Every Door Direct Mail: <https://www.usps.com/business/every-door-direct-mail.htm>
- FTC Cooling-Off Rule: <https://www.ftc.gov/legal-library/browse/rules/cooling-period-sales-made-home-or-other-locations>

These references must be rechecked before implementing a later regulated activation release because laws, platform policies, and APIs change.
