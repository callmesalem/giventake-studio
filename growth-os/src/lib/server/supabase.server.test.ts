import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getRequestHeader: vi.fn().mockReturnValue(""),
  parseCookieHeader: vi.fn().mockReturnValue([]),
  setCookie: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
  parseCookieHeader: mocks.parseCookieHeader,
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: mocks.getRequestHeader,
  setCookie: mocks.setCookie,
}));

import { createUserSupabase } from "./supabase.server";

describe("createUserSupabase session cookies", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.SUPABASE_URL = "https://project.supabase.test";
    process.env.SUPABASE_ANON_KEY = "anon-key";
    mocks.setCookie.mockReset();
    mocks.parseCookieHeader.mockReset().mockReturnValue([]);
    mocks.createServerClient.mockImplementation((_url, _key, options) => {
      options.cookies.setAll([
        {
          name: "sb-session",
          value: "session-value",
          options: { httpOnly: false, sameSite: "none", secure: false },
        },
      ]);
      return {};
    });
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("forces Secure for production session cookies", () => {
    process.env.NODE_ENV = "production";

    createUserSupabase();

    expect(mocks.setCookie).toHaveBeenCalledWith("sb-session", "session-value", {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
    });
  });

  it("keeps local HTTP development cookies intentionally non-Secure", () => {
    process.env.NODE_ENV = "development";

    createUserSupabase();

    expect(mocks.setCookie).toHaveBeenCalledWith("sb-session", "session-value", {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
    });
  });

  it("propagates the exact HttpOnly support session to PostgREST server-side", () => {
    mocks.parseCookieHeader.mockReturnValue([
      { name: "gt_support_session", value: "22222222-2222-2222-2222-222222222222" },
    ]);

    createUserSupabase();

    expect(mocks.createServerClient).toHaveBeenCalledWith(
      "https://project.supabase.test",
      "anon-key",
      expect.objectContaining({
        global: {
          headers: {
            "x-gt-support-session": "22222222-2222-2222-2222-222222222222",
          },
        },
      }),
    );
  });

  it("does not propagate a malformed support session identifier", () => {
    mocks.parseCookieHeader.mockReturnValue([
      { name: "gt_support_session", value: "not-a-session-id" },
    ]);

    createUserSupabase();

    expect(mocks.createServerClient.mock.calls.at(-1)?.[2]).not.toHaveProperty("global");
  });
});
