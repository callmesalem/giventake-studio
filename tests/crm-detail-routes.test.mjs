/**
 * Detail routes have to be reachable.
 *
 * TanStack Router's file-based codegen nests `a.b.$id.tsx` UNDER `a.b.tsx`
 * whenever that parent file exists. A nested child only mounts inside its
 * parent's <Outlet />. A parent that renders no <Outlet /> therefore swallows
 * every detail page silently: the URL changes, the route matches, the loader
 * runs, nothing throws — and the list simply re-renders in place.
 *
 * That is precisely how the CRM detail pages broke. Clicking a company, deal or
 * contact "opened nothing" and the console stayed clean, because from the
 * router's point of view everything had gone fine.
 *
 * The fix is the convention this repo already uses for articles and services:
 * the list lives at `a.b.index.tsx`, so the list and the detail page are
 * siblings under a real layout, instead of the list being the detail page's
 * parent. This test locks that in.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROUTES = join(process.cwd(), "src", "routes");

/** Route files, e.g. "crm.companies.$id.tsx". */
const files = readdirSync(ROUTES).filter((f) => f.endsWith(".tsx"));

/** "crm.companies.$id.tsx" -> "crm.companies" */
function parentSegmentOf(file) {
  const parts = file.replace(/\.tsx$/, "").split(".");
  const paramAt = parts.findIndex((p) => p.startsWith("$"));
  if (paramAt <= 0) return null;
  return parts.slice(0, paramAt).join(".");
}

const dynamicRoutes = files.map((f) => [f, parentSegmentOf(f)]).filter(([, p]) => p !== null);

test("every dynamic route file has a parent that can actually render it", () => {
  assert.ok(dynamicRoutes.length > 0, "expected to find dynamic ($param) route files");

  const unreachable = [];

  for (const [file, parent] of dynamicRoutes) {
    const parentFile = `${parent}.tsx`;
    if (!files.includes(parentFile)) continue; // sibling layout — nothing to swallow it

    const source = readFileSync(join(ROUTES, parentFile), "utf8");

    // A parent that declares no component of its own is harmless: TanStack
    // falls back to a default component that is exactly <Outlet />. Only a
    // parent that renders its OWN component without an <Outlet /> swallows the
    // child. crm.leads.tsx is the former (a bare redirect) and must not trip.
    if (!/\bcomponent\s*:/.test(source)) continue;

    if (!source.includes("<Outlet")) {
      unreachable.push(`${file} is nested under ${parentFile}, which renders no <Outlet />`);
    }
  }

  assert.deepEqual(
    unreachable,
    [],
    `These detail pages can never mount:\n  ${unreachable.join("\n  ")}\n` +
      `Fix: rename the parent list route to <name>.index.tsx so the list and the ` +
      `detail page are siblings (the pattern articles.index.tsx / articles.$slug.tsx uses).`,
  );
});

test("the CRM list routes are index routes, not detail-page parents", () => {
  for (const entity of ["companies", "deals", "contacts"]) {
    assert.ok(files.includes(`crm.${entity}.$id.tsx`), `expected a detail route for ${entity}`);
    assert.ok(
      !files.includes(`crm.${entity}.tsx`),
      `crm.${entity}.tsx must not exist — it would become the parent of ` +
        `crm.${entity}.$id.tsx and swallow it. The list belongs in crm.${entity}.index.tsx.`,
    );
    assert.ok(
      files.includes(`crm.${entity}.index.tsx`),
      `expected the ${entity} list at crm.${entity}.index.tsx`,
    );
  }
});
