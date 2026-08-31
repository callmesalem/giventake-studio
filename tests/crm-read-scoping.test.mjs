import test from "node:test";
import assert from "node:assert/strict";
import { CrmRead } from "../src/server/crm/read.ts";

const CONFIG = { url: "https://example.supabase.co", serviceRoleKey: "svc-key" };

const DEALS = [
  { id: "d1", owner_id: "u-me", assigned_to: null },
  { id: "d2", owner_id: "u-other", assigned_to: "u-me" },
  { id: "d3", owner_id: "u-other", assigned_to: null },
];
const COMPANIES = [
  { id: "c1", owner_id: "u-other" },
  { id: "c2", owner_id: "u-me" },
];
const LEADS = [
  { id: "l1", owner_id: "u-me", assigned_to: null },
  { id: "l2", owner_id: null, assigned_to: null }, // unassigned pool
  { id: "l3", owner_id: "u-other", assigned_to: "u-other" },
];
const INVOICES = [{ id: "inv1", owner_id: "u-other" }];

/** Stub fetch: route by table / rpc name in the url. */
function stubFetch(url) {
  const body = url.includes("/rpc/leads_list")
    ? LEADS
    : url.includes("/rest/v1/deals")
      ? DEALS
      : url.includes("/rest/v1/companies")
        ? COMPANIES
        : url.includes("/rest/v1/invoices")
          ? INVOICES
          : [];
  return { ok: true, status: 200, json: async () => body };
}

function reader(actor) {
  return new CrmRead({ ...CONFIG, fetch: async (u) => stubFetch(u), actor });
}

const ids = (rows) => rows.map((r) => r.id).sort();

test("admin (default, no actor) sees every row", async () => {
  const r = reader(undefined);
  assert.deepEqual(ids(await r.listDeals()), ["d1", "d2", "d3"]);
  assert.deepEqual(ids(await r.listCompanies()), ["c1", "c2"]);
  assert.deepEqual(ids(await r.listLeads()), ["l1", "l2", "l3"]);
  assert.deepEqual(ids(await r.relatedByAll("invoices")), ["inv1"]);
});

test("member sees only owned or assigned pipeline rows", async () => {
  const r = reader({ id: "u-me", isAdmin: false });
  // d1 owned, d2 assigned; d3 (other's, unassigned) hidden.
  assert.deepEqual(ids(await r.listDeals()), ["d1", "d2"]);
});

test("member sees the full shared directory (companies)", async () => {
  const r = reader({ id: "u-me", isAdmin: false });
  assert.deepEqual(ids(await r.listCompanies()), ["c1", "c2"]);
});

test("member sees owned leads plus the unassigned claimable pool", async () => {
  const r = reader({ id: "u-me", isAdmin: false });
  // l1 owned, l2 unassigned pool; l3 (other's, assigned to other) hidden.
  assert.deepEqual(ids(await r.listLeads()), ["l1", "l2"]);
});

test("member sees NOTHING from admin-only financial tables", async () => {
  const r = reader({ id: "u-me", isAdmin: false });
  assert.deepEqual(await r.relatedByAll("invoices"), []);
});

test("member overview leaks no company-wide aggregates", async () => {
  const r = reader({ id: "u-me", isAdmin: false });
  const o = await r.getOverview();
  assert.equal(o.prospecting.deals, 0);
  assert.equal(o.activity.tasks, 0);
  assert.equal(o.pendingApprovals, 0);
});

test("member cannot see company-wide revenue attribution", async () => {
  const r = reader({ id: "u-me", isAdmin: false });
  // The dashboard home calls attribution(); a member must get an empty result,
  // never the business's channel/revenue mix.
  assert.deepEqual(await r.attribution(), { bySource: [] });
});

/**
 * Migration 20260830210000_leads_list_owner_fields is a HARD PREREQUISITE for
 * this code, and the failure mode if it is missing is silent.
 *
 * `leads` is RPC-only, so member scoping reads owner_id / assigned_to off the
 * leads_list result rather than off the table. Before that migration the RPC
 * does not return those fields at all. The scope filter compares strictly, and
 * `undefined === null` is false, so the unassigned-pool branch does not rescue
 * them either: a member sees an empty Leads view, with no error anywhere.
 *
 * Deploy order is therefore: migration first, then this code.
 */
test("without the leads_list owner-fields migration a member sees no leads at all", async () => {
  // leads_list as it exists in production today: no owner_id, no assigned_to.
  const legacy = LEADS.map(({ id }) => ({ id }));
  const fetchLegacy = async () => ({ ok: true, status: 200, json: async () => legacy });

  const member = new CrmRead({
    ...CONFIG,
    fetch: fetchLegacy,
    actor: { id: "u-me", isAdmin: false },
  });
  assert.deepEqual(
    await member.listLeads(),
    [],
    "fails closed rather than leaking, but the member loses their own leads too",
  );

  // An admin is unaffected, which is why this would not show up in owner testing.
  const admin = new CrmRead({ ...CONFIG, fetch: fetchLegacy });
  assert.deepEqual(ids(await admin.listLeads()), ["l1", "l2", "l3"]);
});
