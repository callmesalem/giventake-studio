// The auth decision on giventake-mcp is the one part of that function worth
// testing, and it used to live inside a Deno handler where nothing here could
// reach it. These tests exist to hold the helpers to the two promises the edge
// function relies on: the audit write never breaks a request, and the rate
// limiter never locks the owner out.
import test from "node:test";
import assert from "node:assert/strict";
import {
  timingSafeEqual,
  clientIp,
  presentedVia,
  recordChannelAuth,
  tooManyFailures,
} from "../supabase/functions/_shared/channel-auth.ts";

const URL_BASE = "https://mcp.giventake.test/functions/v1/giventake-mcp";
const req = (headers = {}, url = URL_BASE) => new Request(url, { headers });

// These helpers log and carry on by design, so a passing run would otherwise
// bury the real assertions under expected noise. Capturing also lets a test say
// "and it told the logs", which is the whole point of failing quietly.
const quiet = async (fn) => {
  const original = console.error;
  const lines = [];
  console.error = (...args) => lines.push(args);
  try {
    return { result: await fn(), lines };
  } finally {
    console.error = original;
  }
};

test("timingSafeEqual matches on content and length, not on prefix", () => {
  assert.equal(timingSafeEqual("sami-token-abc", "sami-token-abc"), true);
  assert.equal(timingSafeEqual("short", "much-longer-value"), false);
  assert.equal(timingSafeEqual("abcdef", "abcdeg"), false);
  // A shared prefix must not be enough, or the leak this replaces comes back.
  assert.equal(timingSafeEqual("abcdefghij", "abcdefghiX"), false);
  // True, deliberately: callers must refuse an unset token before comparing.
  assert.equal(timingSafeEqual("", ""), true);
});

test("clientIp trusts the edge over anything the caller can write", () => {
  // cf-connecting-ip wins outright. The edge overwrites it, so it is the one
  // value here the caller cannot pick.
  assert.equal(clientIp(req({ "cf-connecting-ip": "198.51.100.4" })), "198.51.100.4");
  assert.equal(
    clientIp(req({ "x-forwarded-for": "203.0.113.7", "cf-connecting-ip": "198.51.100.4" })),
    "198.51.100.4",
  );

  // Falling back to x-forwarded-for, the LAST entry is used, not the first.
  // Everything left of it is what the client sent before our proxy appended, so
  // "150.172.238.178" here is the only entry we did not let a stranger choose.
  assert.equal(
    clientIp(req({ "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178" })),
    "150.172.238.178",
  );
  // The evasion this closes: a guesser prepending a fresh value per attempt to
  // land in a fresh rate-limit bucket. Both of these resolve to the same ip.
  assert.equal(clientIp(req({ "x-forwarded-for": "fake-1, 150.172.238.178" })), "150.172.238.178");
  assert.equal(clientIp(req({ "x-forwarded-for": "fake-2, 150.172.238.178" })), "150.172.238.178");

  assert.equal(clientIp(req({ "x-forwarded-for": "  203.0.113.7  " })), "203.0.113.7");
  assert.equal(clientIp(req()), null);
  // A blank rightmost entry yields null rather than reaching further left into
  // client-supplied territory. Unidentified is allowed through; misattributed
  // to a value the caller chose is worse.
  assert.equal(clientIp(req({ "x-forwarded-for": "203.0.113.7, " })), null);

  // It lands in an unbounded text column and an index key, so it is capped.
  assert.equal(clientIp(req({ "cf-connecting-ip": "a".repeat(200) })).length, 64);
  assert.equal(clientIp(req({ "x-forwarded-for": `1.2.3.4, ${"b".repeat(200)}` })).length, 64);
});

test("presentedVia distinguishes header, query and nothing at all", () => {
  assert.equal(presentedVia(req({ "x-sami-token": "abc" }), "x-sami-token", "token"), "header");
  assert.equal(presentedVia(req({}, `${URL_BASE}?token=abc`), "x-sami-token", "token"), "query");
  assert.equal(presentedVia(req(), "x-sami-token", "token"), "none");
  // A header present but empty is not a presentation.
  assert.equal(presentedVia(req({ "x-sami-token": "" }), "x-sami-token", "token"), "none");
});

test("recordChannelAuth never throws out of a broken client", async () => {
  const entry = { surface: "giventake-mcp", outcome: "denied", presentedVia: "header" };

  const thrower = {
    rpc() {
      throw new Error("connection refused");
    },
  };
  const thrown = await quiet(() => recordChannelAuth(thrower, req(), entry));
  assert.equal(thrown.lines.length, 1);

  const rejecter = { rpc: async () => Promise.reject(new Error("socket hang up")) };
  const rejected = await quiet(() => recordChannelAuth(rejecter, req(), entry));
  assert.equal(rejected.lines.length, 1);

  // An RPC that answers with an error is logged, not raised.
  const errored = { rpc: async () => ({ data: null, error: { message: "no such function" } }) };
  const returned = await quiet(() => recordChannelAuth(errored, req(), entry));
  assert.equal(returned.lines.length, 1);

  // No client at all (service-role env missing) is a silent no-op, not a crash.
  const none = await quiet(() => recordChannelAuth(null, req(), entry));
  assert.equal(none.lines.length, 0);
});

test("recordChannelAuth sends the surface, outcome, ip and capped user agent", async () => {
  const calls = [];
  const db = {
    rpc: async (fn, args) => {
      calls.push([fn, args]);
      return { data: null, error: null };
    },
  };
  await recordChannelAuth(
    db,
    req({ "x-forwarded-for": "203.0.113.7", "user-agent": "u".repeat(500) }),
    { surface: "giventake-mcp", outcome: "granted", presentedVia: "query" },
  );
  assert.equal(calls.length, 1);
  const [fn, args] = calls[0];
  assert.equal(fn, "channel_auth_record");
  assert.equal(args.p_surface, "giventake-mcp");
  assert.equal(args.p_outcome, "granted");
  assert.equal(args.p_presented_via, "query");
  assert.equal(args.p_client_ip, "203.0.113.7");
  assert.equal(args.p_user_agent.length, 300);
});

test("tooManyFailures reports a limit that is actually exceeded", async () => {
  const calls = [];
  const db = {
    rpc: async (fn, args) => {
      calls.push([fn, args]);
      return { data: true, error: null };
    },
  };
  assert.equal(
    await tooManyFailures(db, req({ "x-forwarded-for": "203.0.113.7" }), "giventake-mcp"),
    true,
  );
  assert.equal(calls[0][0], "channel_auth_too_many_failures");
  assert.deepEqual(calls[0][1], {
    p_surface: "giventake-mcp",
    p_client_ip: "203.0.113.7",
    p_max: 10,
    p_window_seconds: 300,
  });

  const under = { rpc: async () => ({ data: false, error: null }) };
  assert.equal(
    await tooManyFailures(under, req({ "x-forwarded-for": "203.0.113.7" }), "giventake-mcp"),
    false,
  );
});

test("tooManyFailures fails open on every error path", async () => {
  const ip = req({ "x-forwarded-for": "203.0.113.7" });

  // The limiter is a brake on guessing, not the gate. A database hiccup must not
  // lock Salem out of his own agent, so every one of these has to allow.
  const errored = { rpc: async () => ({ data: null, error: { message: "boom" } }) };
  assert.equal((await quiet(() => tooManyFailures(errored, ip, "giventake-mcp"))).result, false);

  const thrower = {
    rpc() {
      throw new Error("connection refused");
    },
  };
  assert.equal((await quiet(() => tooManyFailures(thrower, ip, "giventake-mcp"))).result, false);

  // Anything that is not a clear yes reads as no.
  const vague = { rpc: async () => ({ data: null, error: null }) };
  assert.equal(await tooManyFailures(vague, ip, "giventake-mcp"), false);

  // No client at all.
  assert.equal(await tooManyFailures(null, ip, "giventake-mcp"), false);
});

test("tooManyFailures allows a caller it cannot identify", async () => {
  let called = false;
  const db = {
    rpc: async () => {
      called = true;
      return { data: true, error: null };
    },
  };
  // No ip means no key to limit on. Refusing every unidentifiable caller would
  // lock out anyone behind a proxy that strips the header, so this allows — and
  // does not spend a round trip finding out.
  assert.equal(await tooManyFailures(db, req(), "giventake-mcp"), false);
  assert.equal(called, false);
});
