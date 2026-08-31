import { describe, test, expect } from "vitest";
import { createRouter, createMemoryHistory } from "@tanstack/react-router";

/**
 * Detail routes have to hang off a layout that can render them.
 *
 * The CRM detail pages were unreachable for weeks and nothing ever threw. The
 * `$id` routes were nested under their list routes — `crm.companies.tsx` was
 * the parent of `crm.companies.$id.tsx` — and a nested child only renders
 * inside its parent's <Outlet />. The list routes had none, so navigating to a
 * record matched the route, ran the loader, fetched the record, and then
 * re-rendered the list in the child's place. A clean console and a page that
 * never changed.
 *
 * tests/crm-detail-routes.test.mjs guards the file-layout convention that
 * causes this. This asserts the consequence on the real thing: the route tree
 * that actually ships, assembled by the real router. `/crm` is the only CRM
 * route that renders an <Outlet />, so a detail route parented anywhere else
 * cannot mount.
 *
 * Rendering the tree outright is deliberately not attempted here — RouterProvider
 * needs the TanStack Start runtime that vitest.config.ts explicitly leaves out.
 * The parent wiring is the thing that broke, and it is checkable directly.
 */

function routesById() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return import("@/routeTree.gen").then(({ routeTree }) => {
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ["/crm"] }),
    });
    return (router as unknown as { routesById: Record<string, { parentRoute?: { id: string } }> })
      .routesById;
  });
}

describe("CRM record detail routes", () => {
  const ENTITIES = ["companies", "contacts", "deals"];

  test("every detail route is parented to /crm, the layout that renders an <Outlet />", async () => {
    const byId = await routesById();

    for (const entity of ENTITIES) {
      const id = `/crm/${entity}/$id`;
      expect(byId[id], `expected a ${id} route`).toBeTruthy();
      expect(
        byId[id].parentRoute?.id,
        `${id} must hang off /crm. Parented to the list route instead, it can ` +
          `never mount: the list renders no <Outlet />, so the detail page is ` +
          `silently swallowed and the list re-renders in its place.`,
      ).toBe("/crm");
    }
  });

  test("the collection URL is a sibling index route, not the detail route's parent", async () => {
    const byId = await routesById();

    for (const entity of ENTITIES) {
      const index = byId[`/crm/${entity}/`];
      expect(index, `expected an index route for ${entity}`).toBeTruthy();
      expect(index.parentRoute?.id).toBe("/crm");

      // The bug in one assertion: the list must not be an ancestor of the detail.
      expect(byId[`/crm/${entity}`]).toBeUndefined();
    }
  });
});
