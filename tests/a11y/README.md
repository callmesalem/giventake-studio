# Consent accessibility suite

## Automated (`bun run test:a11y`)

Runs `tests/a11y/consent_a11y.py` (Playwright + axe-core 4.10) against a running
dev server at `http://localhost:8080`. 20 checks covering:

- axe-core WCAG 2.1 A/AA scan with the banner visible and with the dialog open
- keyboard reachability of Accept all / Reject all / Manage preferences
- dialog: opens on Enter, initial focus lands inside, focus trap holds for 25 tabs,
  Escape closes, modal overlay present, accessible name + description
- checkbox rows expose `aria-labelledby` and `aria-describedby`
- focus returns to the **exact** trigger that opened the dialog (banner button and
  persistent cookie-settings button, including the case where the banner unmounts
  and re-renders while the dialog is open)
- Global Privacy Control: analytics and marketing forced off, banner suppressed
- local consent audit trail written with timestamp, source, diff and GPC flag

Screenshots land in `tests/a11y/screenshots/`. Exit code is non-zero on any failure.

Known informational finding: Radix leaves the app root `<div>` without
`aria-hidden` while the dialog is open. Focus is trapped and the overlay is
present, so keyboard users cannot reach the background, but virtual-cursor
browsing (NVDA/JAWS) can still read past the dialog. Re-verify this in the
manual pass below after any Radix upgrade.

## Manual screen-reader pass (not automatable)

NVDA and VoiceOver cannot be driven from CI: NVDA needs a Windows desktop
session with the speech-viewer add-on, VoiceOver needs macOS with Accessibility
permissions granted to the driving app. These runs must be done on real hardware
and the transcript recorded here.

Record: date, OS/browser/SR versions, pass/fail per row, and the exact spoken
output for anything that fails.

### NVDA 2024.x + Firefox and Chrome (Windows)

| # | Step | Expected announcement / behaviour | Result |
|---|------|-----------------------------------|--------|
| 1 | Load site with cleared storage | Banner is reachable in browse mode; region announces "Your privacy, region" then the body copy | |
| 2 | `Tab` from page load | "Accept all button", "Reject all button", "Manage preferences button" in that order | |
| 3 | Activate "Manage preferences" | "Cookie settings dialog", then the description text | |
| 4 | `Tab` through dialog | Each row: category name, "check box, not checked", then the purpose description | |
| 5 | "Strictly necessary" row | Announced as checked and unavailable/disabled | |
| 6 | `Space` on Analytics | "checked" | |
| 7 | Browse mode arrow past the last control | Should not read page content behind the dialog (see known finding) | |
| 8 | `Escape` | Dialog dismissed, focus back on "Manage preferences button" | |
| 9 | Accept all, then footer "Cookie settings" | Dialog reopens; on close focus returns to that same footer control | |

### VoiceOver + Safari (macOS)

| # | Step | Expected announcement / behaviour | Result |
|---|------|-----------------------------------|--------|
| 1 | Load site with cleared storage | VO rotor lists "Your privacy" region | |
| 2 | `VO + →` through banner | Heading, body copy, then the three buttons in DOM order | |
| 3 | Open preferences | "Cookie settings, dialog" and the description are spoken | |
| 4 | `VO + →` inside dialog | Category label and description spoken with each checkbox | |
| 5 | Interact with checkboxes (`VO + Space`) | State change announced immediately | |
| 6 | `Escape` | Dialog closes, VO cursor and keyboard focus both return to the trigger | |
| 7 | Rotate to Landmarks | Dialog is the only reachable region while open | |

### iOS VoiceOver / Android TalkBack (touch)

| # | Step | Expected | Result |
|---|------|----------|--------|
| 1 | Swipe through banner | All three buttons reachable, each ≥ 44×44 pt | |
| 2 | Open preferences | Focus moves into the sheet; swiping does not escape it | |
| 3 | Two-finger scrub (VO) / back gesture | Dialog closes and focus returns to the trigger | |

## Mobile navigation — not yet automated

`MobileNav` in `src/components/site-chrome.tsx` is the header menu shown below
768px. It is a **disclosure, not a modal**: no focus trap, because the panel does
not claim the whole screen and the page behind it stays legitimately reachable.
Do not "fix" the missing focus trap without changing the pattern to a dialog
first — a trap without a modal overlay is worse than neither.

The automated suite (`consent_a11y.py`) does not cover it yet. Add it there when
convenient; until then, run this by hand at a 375px viewport.

| # | Step | Expected | Result |
|---|------|----------|--------|
| 1 | Load any page at 375px wide | Menu button visible; "Start a project" still visible | |
| 2 | Inspect the trigger | `aria-expanded="false"`, `aria-controls` points at the panel id, has an accessible name | |
| 3 | `Tab` to the trigger and press `Enter` | Panel opens, `aria-expanded` flips to `true` | |
| 4 | `Tab` through the panel | Every link reachable in DOM order, each row ≥ 48px tall | |
| 5 | Press `Escape` | Panel closes **and focus returns to the trigger** | |
| 6 | Open, then activate any link | Panel closes on navigation, does not persist across pages | |
| 7 | Screen reader, panel open | Announced as expanded; nav landmark labelled "Main" | |
| 8 | Rotor / landmark list at 375px | Exactly **one** navigation landmark named "Main" | |

On row 8: both navs are in the DOM and both are labelled "Main", but each is
hidden at the other's breakpoint with `display: none` (Tailwind `hidden` /
`md:hidden`), which removes it from the accessibility tree. So only one should
ever be exposed. Worth confirming once rather than assuming — if two are
announced, render one conditionally instead of hiding with CSS.
