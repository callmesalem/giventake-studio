import "@tanstack/react-start/server-only";
import { createServerClient, parseCookieHeader, type CookieMethodsServer } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getRequestHeader, setCookie } from "@tanstack/react-start/server";
import type { Database } from "../database.types";

type CookiesToSet = Parameters<NonNullable<CookieMethodsServer["setAll"]>>[0];
const SUPPORT_SESSION_COOKIE = "gt_support_session";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createUserSupabase(): SupabaseClient<Database> {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase user client is not configured");
  }

  const requestCookies = parseCookieHeader(getRequestHeader("cookie") ?? "");
  const supportSessionId = requestCookies.find(
    (cookie) => cookie.name === SUPPORT_SESSION_COOKIE,
  )?.value;
  const supportHeaders =
    supportSessionId && UUID_PATTERN.test(supportSessionId)
      ? { global: { headers: { "x-gt-support-session": supportSessionId } } }
      : {};

  const client = createServerClient<Database>(url, anonKey, {
    ...supportHeaders,
    cookies: {
      getAll() {
        return requestCookies;
      },
      setAll(values: CookiesToSet) {
        for (const { name, value, options } of values) {
          setCookie(name, value, {
            ...options,
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
          });
        }
      },
    },
  });

  // @supabase/ssr 0.5 uses the pre-options generic position from supabase-js.
  return client as unknown as SupabaseClient<Database>;
}

export function createJobSupabase(): SupabaseClient<Database> {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase job client is not configured");
  }

  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
