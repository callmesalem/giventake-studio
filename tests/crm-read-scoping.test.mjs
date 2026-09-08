import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

/** Apply the request's `select=` list to the stub rows.
 *
 *  Not a detail: the scope filter reads owner_id / assigned_to off the row it
 *  is handed, so a projection that omits them silently changes the answer. A
 *  stub that ignores `select` cannot reproduce that, which is why a caller
 *  reading deals as "id,name" looked fine in tests and 404d in production. */
function project(rows, url) {
  const select = new URL(url).searchParams.get("select");
  if (!select || select === "*") return rows;
  const keep = select.split(",").map((c) => c.trim());
  return rows.map((row) =>
    Object.fromEntries(Object.entries(row).filter(([key]) => keep.includes(key))),
  );
}

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
  // RPC results are a POST body, not a projected REST select.
  const rows = url.includes("/rpc/") ? body : project(body, url);
  return { ok: true, status: 200, json: async () => rows };
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

/**
 * The projection is part of the authorisation check.
 *
 * #scope filters on owner_id / assigned_to, and it can only read what the
 * select asked for. Omit those columns and the predicate is `undefined === me`
 * for every row: the filter drops everything, silently, and a member is told
 * the record does not exist. There is no error and no log line — the read
 * simply comes back empty, which reads exactly like "no such row".
 *
 * src/lib/documents-data.ts read the deal as "id,name" and every non-admin
 * therefore 404d on a deal they owned, taking all four document server
 * functions with it.
 */
test("a scoped read whose projection omits the ownership columns hides the member's own row", async () => {
  const r = reader({ id: "u-me", isAdmin: false });
  assert.equal(
    await r.getById("deals", "d1", "id,name"),
    null,
    "d1 is owned by u-me; it disappears only because the filter cannot see owner_id",
  );
});

test("the same read WITH the ownership columns returns the member's own deal", async () => {
  const r = reader({ id: "u-me", isAdmin: false });
  const deal = await r.getById("deals", "d1", "id,name,owner_id,assigned_to");
  assert.equal(deal?.id, "d1");
});

test("an admin is unaffected by the projection, which is why this hid", async () => {
  const admin = reader(undefined);
  const deal = await admin.getById("deals", "d1", "id,name");
  assert.equal(deal?.id, "d1");
});

test("the document deal-access read includes the columns the scope filter needs", () => {
  // The behavioural tests above pin the mechanism; this pins the call site the
  // mechanism actually broke. The scoped deal read now lives in the server-only
  // deal-access module (moved out of documents-data.ts to keep server imports
  // off the client graph); reverting the projection there must fail the suite.
  const source = readFileSync(
    new URL("../src/server/documents/deal-access.ts", import.meta.url),
    "utf8",
  );
  const match = source.match(/getById<[^(]*\(\s*"deals",\s*\w+,\s*"([^"]*)"/);
  assert.ok(match, "deal-access.ts must still read the deal by id before serving documents");
  const columns = match[1].split(",").map((c) => c.trim());
  for (const column of ["owner_id", "assigned_to"]) {
    assert.ok(columns.includes(column), `the deals projection must include ${column}`);
  }
});
