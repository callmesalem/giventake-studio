import "@tanstack/react-start/server-only";

import { z } from "zod";

import { createStudioUserSupabase } from "./supabase.server";
import type { StudioAuthUser } from "./identity";

const emailInputSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(320)
    .transform((email) => email.toLowerCase()),
});
const callbackCodeSchema = z.string().trim().min(8).max(4096);

export class StudioAuthError extends Error {
  constructor(public readonly code: "UNAUTHENTICATED" | "AUTH_CALLBACK_INVALID") {
    super(code);
    this.name = "StudioAuthError";
  }
}

type UserLookup = () => Promise<{
  data: { user: { id: string; email?: string | null } | null };
  error: unknown;
}>;

export async function getAuthenticatedStudioUserFrom(
  getUser: UserLookup,
): Promise<StudioAuthUser | null> {
  const { data, error } = await getUser();
  if (error || !data.user?.email) return null;
  return { id: data.user.id, email: data.user.email.toLowerCase() };
}

export async function getAuthenticatedStudioUser(): Promise<StudioAuthUser | null> {
  const supabase = createStudioUserSupabase();
  return getAuthenticatedStudioUserFrom(() => supabase.auth.getUser());
}

type MagicLinkDependencies = {
  appUrl: string;
  signInWithOtp: (input: {
    email: string;
    options: { emailRedirectTo: string };
  }) => Promise<unknown>;
};

export async function requestStudioMagicLinkForEmail(
  input: unknown,
  dependencies?: MagicLinkDependencies,
): Promise<{ accepted: true }> {
  const { email } = emailInputSchema.parse(input);
  const appUrl = (dependencies?.appUrl ?? process.env.STUDIO_APP_URL)?.replace(/\/$/, "");
  if (!appUrl) throw new Error("STUDIO_APP_URL is not configured.");
  const supabase = dependencies ? null : createStudioUserSupabase();
  const signInWithOtp =
    dependencies?.signInWithOtp ?? ((payload) => supabase!.auth.signInWithOtp(payload));

  try {
    await signInWithOtp({
      email,
      options: { emailRedirectTo: `${appUrl}/studio/auth/callback` },
    });
  } catch {
    // Never expose provider failures or account existence to the browser.
  }

  return { accepted: true };
}

type CallbackDependencies = {
  exchangeCode: (code: string) => Promise<{ user: StudioAuthUser | null }>;
};

export async function completeStudioAuthCallbackWith(
  code: string,
  dependencies: CallbackDependencies,
): Promise<{ authenticated: true }> {
  const parsedCode = callbackCodeSchema.safeParse(code);
  if (!parsedCode.success) throw new StudioAuthError("AUTH_CALLBACK_INVALID");
  const { user } = await dependencies.exchangeCode(parsedCode.data);
  if (!user) throw new StudioAuthError("AUTH_CALLBACK_INVALID");
  return { authenticated: true };
}

export async function completeStudioAuthCallback(code: string): Promise<{ authenticated: true }> {
  const supabase = createStudioUserSupabase();
  return completeStudioAuthCallbackWith(code, {
    async exchangeCode(callbackCode) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(callbackCode);
      if (error || !data.session?.user.email) return { user: null };
      return {
        user: {
          id: data.session.user.id,
          email: data.session.user.email.toLowerCase(),
        },
      };
    },
  });
}

export async function signOutStudioUser(): Promise<void> {
  const { error } = await createStudioUserSupabase().auth.signOut();
  if (error) throw new StudioAuthError("UNAUTHENTICATED");
}
