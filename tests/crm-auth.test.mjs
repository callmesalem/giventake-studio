import test from "node:test";
import assert from "node:assert/strict";
import { CrmAuth } from "../src/server/crm/auth.ts";

const CONFIG = { url: "https://example.supabase.co", serviceRoleKey: "svc-key" };

/** Build a CrmAuth whose fetch is stubbed by a url-matching router. */
function withFetch(routes) {
  const calls = [];
  const fetchStub = async (url, options = {}) => {
    calls.push({ url, options });
    for (const [needle, responder] of routes) {
      if (url.includes(needle)) {
        const r = typeof responder === "function" ? responder(url, options) : responder;
        return {
          ok: r.ok ?? true,
          status: r.status ?? 200,
          json: async () => r.body,
        };
      }
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
  return { auth: new CrmAuth({ ...CONFIG, fetch: fetchStub }), calls };
}

test("SECURITY: role comes from app_metadata, NOT user-editable user_metadata", async () => {
  // A member sets their own user_metadata.role=admin (possible via GoTrue updateUser).
  // app_metadata (service-role only) still says member. Authz must return member.
  const { auth } = withFetch([
    [
      "/auth/v1/user",
      {
        body: {
          id: "u1",
          email: "m@x.com",
          user_metadata: { role: "admin" },
          app_metadata: { role: "member" },
        },
      },
    ],
  ]);
  const session = await auth.userFromAccessToken("at");
  assert.equal(session.role, "member", "must ignore user_metadata.role for authz");
});

test("SECURITY: app_metadata.role=admin grants admin even if user_metadata says member", async () => {
  const { auth } = withFetch([
    [
      "/auth/v1/user",
      {
        body: {
          id: "u1",
          email: "a@x.com",
          user_metadata: { role: "member" },
          app_metadata: { role: "admin" },
        },
      },
    ],
  ]);
  const session = await auth.userFromAccessToken("at");
  assert.equal(session.role, "admin");
});

test("no role anywhere defaults to member", async () => {
  const { auth } = withFetch([["/auth/v1/user", { body: { id: "u1", email: "n@x.com" } }]]);
  const session = await auth.userFromAccessToken("at");
  assert.equal(session.role, "member");
});

test("userFromAccessToken returns null on non-ok and empty token", async () => {
  const { auth } = withFetch([["/auth/v1/user", { ok: false, status: 401, body: {} }]]);
  assert.equal(await auth.userFromAccessToken("at"), null);
  assert.equal(await auth.userFromAccessToken(""), null);
});

test("login returns session (role from app_metadata) plus tokens", async () => {
  const { auth, calls } = withFetch([
    [
      "grant_type=password",
      {
        body: {
          access_token: "AT",
          refresh_token: "RT",
          expires_in: 3600,
          user: {
            id: "u1",
            email: "a@x.com",
            user_metadata: { full_name: "Ada" },
            app_metadata: { role: "admin" },
          },
        },
      },
    ],
  ]);
  const result = await auth.login("a@x.com", "pw");
  assert.equal(result.session.role, "admin");
  assert.equal(result.session.fullName, "Ada");
  assert.equal(result.tokens.accessToken, "AT");
  assert.equal(result.tokens.refreshToken, "RT");
  // password must be sent to the password grant endpoint
  assert.match(calls[0].url, /grant_type=password/);
});

test("login throws invalid_credentials on non-ok", async () => {
  const { auth } = withFetch([["grant_type=password", { ok: false, status: 400, body: {} }]]);
  await assert.rejects(() => auth.login("a@x.com", "bad"), /invalid_credentials/);
});

test("refresh returns null on dead token, session on success", async () => {
  const dead = withFetch([["grant_type=refresh_token", { ok: false, status: 400, body: {} }]]);
  assert.equal(await dead.auth.refresh("RT"), null);
  assert.equal(await dead.auth.refresh(""), null);

  const ok = withFetch([
    [
      "grant_type=refresh_token",
      {
        body: {
          access_token: "AT2",
          refresh_token: "RT2",
          expires_in: 3600,
          user: { id: "u1", email: "a@x.com", app_metadata: { role: "member" } },
        },
      },
    ],
  ]);
  const refreshed = await ok.auth.refresh("RT");
  assert.equal(refreshed.tokens.accessToken, "AT2");
  assert.equal(refreshed.session.role, "member");
});

test("createTeamMember confirms email and sets app_metadata.role", async () => {
  const { auth, calls } = withFetch([["/auth/v1/admin/users", { body: { id: "new-id" } }]]);
  const created = await auth.createTeamMember({
    email: "t@x.com",
    password: "temp",
    fullName: "Tess",
    role: "admin",
  });
  assert.equal(created.id, "new-id");
  const sent = JSON.parse(calls[0].options.body);
  assert.equal(sent.email_confirm, true, "member should be able to log in immediately");
  assert.equal(sent.app_metadata.role, "admin", "authz role must be in app_metadata");
});

test("createTeamMember surfaces the GoTrue error message", async () => {
  const { auth } = withFetch([
    ["/auth/v1/admin/users", { ok: false, status: 422, body: { msg: "email already exists" } }],
  ]);
  await assert.rejects(
    () => auth.createTeamMember({ email: "t@x.com", password: "p", fullName: "T", role: "member" }),
    /email already exists/,
  );
});
