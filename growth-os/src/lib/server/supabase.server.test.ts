import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getRequestHeader: vi.fn().mockReturnValue(""),
  setCookie: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
  parseCookieHeader: vi.fn().mockReturnValue([]),
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
});
