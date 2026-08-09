import "@tanstack/react-start/server-only";
import { createServerClient, parseCookieHeader, type CookieMethodsServer } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getRequestHeader, setCookie } from "@tanstack/react-start/server";
import type { Database } from "../database.types";

type CookiesToSet = Parameters<NonNullable<CookieMethodsServer["setAll"]>>[0];

export function createUserSupabase(): SupabaseClient<Database> {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase user client is not configured");
  }

  const client = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return parseCookieHeader(getRequestHeader("cookie") ?? "");
      },
      setAll(values: CookiesToSet) {
        for (const { name, value, options } of values) {
          setCookie(name, value, {
            ...options,
            httpOnly: true,
            sameSite: "lax",
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
