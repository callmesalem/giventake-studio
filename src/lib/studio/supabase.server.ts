import "@tanstack/react-start/server-only";

import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { getRequestHeader, setCookie } from "@tanstack/react-start/server";

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export function createStudioUserSupabase() {
  const requestCookies = parseCookieHeader(getRequestHeader("cookie") ?? "");
  return createServerClient(
    requiredEnvironment("SUPABASE_URL"),
    requiredEnvironment("SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return requestCookies;
        },
        setAll(values) {
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
    },
  );
}

export function createStudioServiceSupabase() {
  return createClient(
    requiredEnvironment("SUPABASE_URL"),
    requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
