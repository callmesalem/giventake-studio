# Production Rescue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the exported site source safe to deploy to `https://giventakedevs.com` by replacing old preview-domain, brand, and public email values and restoring lint/build health.

**Architecture:** Keep the current TanStack Start app structure. Centralize canonical production identity through `src/lib/seo.ts`, keep static crawler identity in `public/robots.txt`, and update public-facing strings where titles or legal/contact text are hard-coded.

**Tech Stack:** TanStack Start, React, TypeScript, Vite, Tailwind CSS, ESLint, Prettier, Node text invariant test.

## Global Constraints

- Use `https://giventakedevs.com` as the production base URL.
- Use `GivenTake Devs` for the public site name.
- Use `GivenTake Devs LLC` for the legal entity.
- Use `hello@giventakedevs.com`, `privacy@giventakedevs.com`, and `legal@giventakedevs.com` for public email addresses.
- Do not invent the registered business address; leave the existing explicit address placeholder until the user provides the final address.
- Do not deploy or configure email automation in this task.

---

### Task 1: Launch Identity Invariant Test

**Files:**
- Create: `tests/launch-identity.test.mjs`

**Interfaces:**
- Consumes: source files on disk.
- Produces: a Node-executable invariant test run with `node tests/launch-identity.test.mjs`.

- [ ] **Step 1: Write the failing test**

Create a Node test that asserts production source contains the final domain, brand, legal entity, and email values, and does not contain the old Lovable preview domain or retired public brand/email values in `src`, `public`, or `.env.example`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/launch-identity.test.mjs`
Expected: FAIL because `src/lib/seo.ts`, `public/robots.txt`, and public source files still contain old values.

- [ ] **Step 3: Implement minimal source changes**

Patch public-facing source constants and text in `src`, `public`, and `.env.example`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/launch-identity.test.mjs`
Expected: PASS.

### Task 2: Lint Formatting Rescue

**Files:**
- Modify: `src/lib/consent.tsx`
- Modify: `src/routes/sitemap[.]xml.ts`

**Interfaces:**
- Consumes: ESLint and Prettier configuration already in the repo.
- Produces: clean `npm run lint` result except any remaining non-format rule that needs separate handling.

- [ ] **Step 1: Verify current lint failure**

Run: `npm run lint`
Expected: FAIL on Prettier formatting and React refresh warnings already found in the audit.

- [ ] **Step 2: Apply minimal formatting/rule-safe edits**

Use the repo's Prettier formatting for the failing files. If React refresh warnings remain, either keep them as known warnings or make a targeted export split only if lint exits non-zero.

- [ ] **Step 3: Verify lint**

Run: `npm run lint`
Expected: PASS.

### Task 3: Build Verification

**Files:**
- No direct source edits unless verification exposes a new source-owned failure.

**Interfaces:**
- Consumes: updated source and generated route tree behavior.
- Produces: verified deployable build output.

- [ ] **Step 1: Run TypeScript**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: PASS, with known non-blocking Lovable asset warnings if unchanged.

- [ ] **Step 3: Browser spot-check**

Start a local dev server and verify the home page canonical/title and a routed page such as `/services` reflect `giventakedevs.com` and `GivenTake Devs`.
