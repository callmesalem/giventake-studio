# Subprocessor and service provider list

**Required by the published privacy policy**, which names service providers in
§5 and commits to reviewing them annually. Keep this list and the policy in sync
— if they diverge, the policy is the one a regulator reads.

**Last reviewed:** `[DATE]`
**Next review due:** `[DATE]` (annual, per privacy policy §5)

---

## Currently disclosed in the privacy policy

These are named in `src/routes/privacy.tsx`. Any change here requires a matching
change there.

| Provider             | Purpose                       | Data                                | Location    | Transfer basis | Consent-gated?          |
| -------------------- | ----------------------------- | ----------------------------------- | ----------- | -------------- | ----------------------- |
| Cloudflare           | Hosting, CDN, DDoS protection | IP, request metadata                | US / global | SCCs, DPF      | No — strictly necessary |
| Google Analytics 4   | Aggregate site analytics      | IP (anonymised), page views, device | US          | SCCs, DPF      | **Yes** — analytics     |
| Meta Pixel           | Ad measurement                | Event data, identifiers             | US          | SCCs, DPF      | **Yes** — marketing     |
| TikTok Pixel         | Ad measurement                | Event data, identifiers             | US          | SCCs           | **Yes** — marketing     |
| LinkedIn Insight Tag | Ad measurement                | Event data, identifiers             | US          | SCCs, DPF      | **Yes** — marketing     |

All four analytics/marketing providers load **only after consent** and are
suppressed entirely when Global Privacy Control is detected — implemented in
`src/lib/tracking.ts` and `src/lib/consent.tsx`, with Google Consent Mode v2
defaults set to `denied`.

**Note:** the four pixels are configured via environment variables
(`VITE_GA_MEASUREMENT_ID`, `VITE_META_PIXEL_ID`, `VITE_TIKTOK_PIXEL_ID`,
`VITE_LINKEDIN_PARTNER_ID`) and are silently skipped when unset. **If you are not
actually running ads on a platform, don't set its ID** — and consider removing it
from the privacy policy rather than disclosing a processor you don't use. An
over-inclusive disclosure is not harmful, but an accurate one is easier to defend
and shorter to maintain.

---

## To add when implemented

| Provider                                         | Purpose                             | Trigger                         | Status                  |
| ------------------------------------------------ | ----------------------------------- | ------------------------------- | ----------------------- |
| `[Form backend — Resend / Formspree / Supabase]` | Contact and DSAR form submissions   | Replacing the `mailto:` handoff | **Not yet implemented** |
| `[Email provider]`                               | Business email for `@giventake.dev` | Domain setup                    | `[status]`              |
| `[Invoicing / payments]`                         | Client invoicing                    | First invoice                   | `[status]`              |
| `[Bookkeeping]`                                  | Accounting records                  | Books setup                     | `[status]`              |

> **Important:** the contact and DSAR forms currently use a `mailto:` handoff, so
> no third party processes submissions today — which is why none is listed. The
> moment a form backend is added, it becomes a processor and **must** be added
> here _and_ to the privacy policy before it goes live.

---

## AI tools

AI tools used in client delivery are tracked separately in
[`ai-tool-register.md`](./ai-tool-register.md), because the questions asked of
them are different (training, retention, output rights).

**They are still processors** where they handle client personal data. Where that
is the case, the tool must appear on both lists and have a DPA in place.

---

## Annual review checklist

- [ ] Confirm each provider is still in use — remove any that aren't
- [ ] Check for changed terms, sub-processors, or data locations
- [ ] Confirm transfer mechanisms are still valid
- [ ] Confirm DPAs are current
- [ ] **Reconcile against `src/routes/privacy.tsx` §5** — the published policy is
      the binding statement
- [ ] Update the review dates at the top of this file
