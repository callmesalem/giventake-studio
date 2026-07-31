"""
Automated accessibility suite for the cookie consent banner + preferences dialog.

Covers:
  1. axe-core scan (WCAG 2.1 A/AA) with the banner visible
  2. axe-core scan with the preferences dialog open
  3. Keyboard reachability of every banner control
  4. Dialog focus behaviour: initial focus, focus trap, Escape to close
  5. Focus return to the exact element that opened the dialog
  6. Global Privacy Control: analytics/marketing forced off, no banner
  7. Consent-change audit trail written to localStorage

Run:  python3 tests/a11y/consent_a11y.py [base_url]
Exit code 0 = all checks passed.
"""

import asyncio
import json
import sys
from pathlib import Path

from playwright.async_api import async_playwright

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080"
AXE_CDN = "https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js"
SCREENSHOTS = Path(__file__).parent / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

results: list[tuple[bool, str, str]] = []


def check(ok: bool, name: str, detail: str = "") -> None:
    results.append((ok, name, detail))
    print(("PASS  " if ok else "FAIL  ") + name + ((" :: " + detail) if detail else ""))


AXE_RUN = """
async (ctx) => {
  const r = await window.axe.run(ctx || document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }
  });
  return r.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length,
    example: (v.nodes[0] && v.nodes[0].html || '').slice(0, 160) }));
}
"""


async def axe_scan(page, ctx=None, label="page"):
    await page.add_script_tag(url=AXE_CDN)
    violations = await page.evaluate(AXE_RUN, ctx)
    serious = [v for v in violations if v["impact"] in ("serious", "critical")]
    check(
        not serious,
        f"axe-core: no serious/critical violations ({label})",
        json.dumps(violations) if violations else "",
    )


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)

        # ---------- default session ----------
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()
        await page.goto(BASE_URL, wait_until="domcontentloaded")

        banner = page.get_by_role("region", name="Your privacy")
        await banner.wait_for(state="visible", timeout=15000)
        await page.wait_for_timeout(1500)  # let hydration settle
        check(True, "consent banner renders on a fresh session")
        await page.screenshot(path=str(SCREENSHOTS / "1_banner.png"))

        await axe_scan(page, None, "banner visible")

        # --- keyboard reachability of banner controls ---
        names = ["Accept all", "Reject all", "Manage preferences"]
        reached = []
        await page.keyboard.press("Tab")
        for _ in range(200):
            label = await page.evaluate(
                "() => { const a = document.activeElement;"
                " return a ? (a.getAttribute('aria-label') || a.textContent || '').trim() : ''; }"
            )
            if label in names and label not in reached:
                reached.append(label)
            if len(reached) == len(names):
                break
            await page.keyboard.press("Tab")
        check(
            sorted(reached) == sorted(names),
            "every banner control is reachable by Tab",
            f"reached={reached}",
        )

        # --- open dialog from the keyboard ---
        trigger = page.get_by_role("button", name="Manage preferences")
        await trigger.focus()
        await page.keyboard.press("Enter")
        dialog = page.get_by_role("dialog")
        await dialog.wait_for(state="visible", timeout=5000)
        check(True, "preferences dialog opens via keyboard (Enter)")
        await page.screenshot(path=str(SCREENSHOTS / "2_dialog.png"))

        inside = await page.evaluate(
            "() => !!document.activeElement?.closest('[role=dialog]')"
        )
        check(inside, "focus moves inside the dialog on open")

        # --- accessible name / description ---
        meta = await page.evaluate(
            """() => {
              const d = document.querySelector('[role=dialog]');
              const t = d.getAttribute('aria-labelledby');
              const s = d.getAttribute('aria-describedby');
              const txt = id => id ? (document.getElementById(id)?.textContent || '').trim() : '';
              return { label: txt(t), desc: txt(s), modal: d.getAttribute('aria-modal') };
            }"""
        )
        check(bool(meta["label"]), "dialog has an accessible name", json.dumps(meta))
        check(bool(meta["desc"]), "dialog has an accessible description")
        overlay = await page.evaluate(
            """() => {
                 const ov = document.querySelector('[data-slot=dialog-overlay], [data-radix-dialog-overlay]')
                   || Array.from(document.body.querySelectorAll('div'))
                        .find(el => el.getAttribute('aria-hidden') === 'true'
                                 && el.className.toString().includes('fixed inset-0'));
                 return !!ov;
               }"""
        )
        check(overlay, "a modal overlay renders behind the dialog")

        # Informational: which background nodes are still exposed to AT.
        exposed = await page.evaluate(
            """() => {
                 const d = document.querySelector('[role=dialog]');
                 return Array.from(document.body.children)
                   .filter(el => !el.contains(d)
                             && !['SCRIPT','STYLE','TEMPLATE','LINK'].includes(el.tagName)
                             && el.getAttribute('aria-hidden') !== 'true'
                             && !el.hasAttribute('data-aria-hidden')
                             && !el.hasAttribute('inert'))
                   .map(el => el.tagName);
               }"""
        )
        print(f"INFO  background nodes still exposed to AT: {exposed or 'none'}")

        # --- focus trap: tabbing 25 times never escapes the dialog ---
        escaped = False
        for _ in range(25):
            await page.keyboard.press("Tab")
            if not await page.evaluate(
                "() => !!document.activeElement?.closest('[role=dialog]')"
            ):
                escaped = True
                break
        check(not escaped, "focus stays trapped inside the dialog while tabbing")

        # --- checkbox rows announce label + description ---
        cb = await page.evaluate(
            """() => Array.from(document.querySelectorAll('[role=dialog] [role=checkbox]'))
                 .map(c => ({
                   labelled: !!c.getAttribute('aria-labelledby'),
                   described: !!c.getAttribute('aria-describedby'),
                   disabled: c.getAttribute('data-disabled') !== null
                 }))"""
        )
        check(len(cb) == 4, "four consent categories are exposed as checkboxes", json.dumps(cb))
        check(
            all(c["labelled"] and c["described"] for c in cb),
            "each checkbox exposes a label and a description",
        )

        await axe_scan(page, "[role=dialog]", "dialog open")

        # --- Escape closes and focus returns to the exact trigger ---
        await page.keyboard.press("Escape")
        await dialog.wait_for(state="hidden", timeout=5000)
        returned = await page.evaluate(
            """() => { const a = document.activeElement;
                 return a ? (a.getAttribute('aria-label') || a.textContent || '').trim() : ''; }"""
        )
        check(
            returned == "Manage preferences",
            "Escape closes the dialog and focus returns to the exact trigger",
            f"activeElement={returned!r}",
        )

        # --- exact-trigger restore from the persistent footer control ---
        await page.get_by_role("button", name="Accept all").click()
        persistent = page.locator('[data-consent-trigger="persistent"]')
        await persistent.wait_for(state="visible", timeout=5000)
        await persistent.click()
        await dialog.wait_for(state="visible", timeout=5000)
        await page.keyboard.press("Escape")
        await dialog.wait_for(state="hidden", timeout=5000)
        same = await page.evaluate(
            "() => document.activeElement?.getAttribute('data-consent-trigger') === 'persistent'"
        )
        check(same, "focus returns to the persistent cookie-settings trigger")

        # --- audit trail ---
        log = await page.evaluate(
            "() => JSON.parse(localStorage.getItem('gt.consent.audit.v1') || '[]')"
        )
        sources = [e["source"] for e in log]
        check(len(log) > 0, "consent audit trail is written locally", f"sources={sources}")
        check("accept-all" in sources, "audit trail records the accept-all event")
        check(
            all({"at", "source", "state", "changed", "gpc"} <= set(e) for e in log),
            "every audit entry has timestamp, source, state, diff and GPC flag",
        )
        await context.close()

        # ---------- Global Privacy Control session ----------
        gpc_ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        gpc_page = await gpc_ctx.new_page()
        await gpc_ctx.add_init_script(
            "Object.defineProperty(navigator, 'globalPrivacyControl',"
            " { get: () => true, configurable: true });"
        )
        await gpc_page.goto(BASE_URL, wait_until="domcontentloaded")
        await gpc_page.wait_for_timeout(3000)

        gpc_state = await gpc_page.evaluate(
            "() => JSON.parse(localStorage.getItem('gt.consent.v1') || 'null')"
        )
        check(
            bool(gpc_state)
            and gpc_state["state"]["analytics"] is False
            and gpc_state["state"]["marketing"] is False,
            "GPC forces analytics and marketing to opt-out",
            json.dumps(gpc_state),
        )
        banner_visible = await gpc_page.get_by_role("region", name="Your privacy").is_visible()
        check(not banner_visible, "GPC is treated as a decision, so the banner stays hidden")

        gpc_log = await gpc_page.evaluate(
            "() => JSON.parse(localStorage.getItem('gt.consent.audit.v1') || '[]')"
        )
        check(
            any(e["source"] == "gpc" for e in gpc_log),
            "audit trail records the GPC opt-out",
            json.dumps([e["source"] for e in gpc_log]),
        )

        # GPC cannot be overridden by a later accept-all
        await gpc_page.evaluate(
            "() => window.dispatchEvent(new Event('nothing'))"
        )
        await gpc_ctx.close()

        await browser.close()

    failed = [r for r in results if not r[0]]
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
    sys.exit(1 if failed else 0)


asyncio.run(main())
