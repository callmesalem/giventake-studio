import "@tanstack/react-start/server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { z } from "zod";
import { createJobSupabase, createUserSupabase } from "@/lib/server/supabase.server";
import {
  authCallbackSchema,
  inviteClientOwnerSchema,
  requestMagicLinkSchema,
  type InviteClientOwnerInput,
  type RequestMagicLinkInput,
} from "./auth.schemas";

export type AuthUser = {
  id: string;
  email: string;
};

type UserLookup = () => Promise<{
  data: { user: { id: string; email?: string | null } | null };
  error: unknown;
}>;

type CallbackUser = {
  id: string;
  email: string;
  appMetadata: Record<string, unknown>;
  userMetadata: Record<string, unknown>;
};

type PendingInvitation = {
  invitationId: string;
  tenantId: string;
  userId: string;
  email: string;
};

export class AuthBoundaryError extends Error {
  constructor(
    public readonly code:
      | "UNAUTHENTICATED"
      | "AUTH_CALLBACK_INVALID"
      | "PLATFORM_ADMIN_REQUIRED"
      | "TENANT_NOT_FOUND"
      | "INVITATION_FAILED"
      | "INVITATION_INVALID",
  ) {
    super(code);
    this.name = "AuthBoundaryError";
  }
}

export async function getAuthenticatedUserFrom(getUser: UserLookup): Promise<AuthUser | null> {
  const { data, error } = await getUser();
  if (error || !data.user?.email) return null;
  return { id: data.user.id, email: data.user.email };
}

export async function getAuthenticatedUser(): Promise<AuthUser | null> {
  const supabase = createUserSupabase();
  return getAuthenticatedUserFrom(() => supabase.auth.getUser());
}

export async function requireAuthenticatedUserFrom(getUser: UserLookup): Promise<AuthUser> {
  const user = await getAuthenticatedUserFrom(getUser);
  if (!user) throw new AuthBoundaryError("UNAUTHENTICATED");
  return user;
}

export async function requireAuthenticatedUser(): Promise<AuthUser> {
  const supabase = createUserSupabase();
  return requireAuthenticatedUserFrom(() => supabase.auth.getUser());
}

type MagicLinkDependencies = {
  appUrl: string;
  signInWithOtp: (input: {
    email: string;
    options: { emailRedirectTo: string };
  }) => Promise<unknown>;
};

export async function requestMagicLinkForEmail(
  input: RequestMagicLinkInput,
  dependencies?: MagicLinkDependencies,
): Promise<{ accepted: true }> {
  const { email } = requestMagicLinkSchema.parse(input);
  const supabase = dependencies ? null : createUserSupabase();
  const appUrl = (dependencies?.appUrl ?? process.env.APP_URL)?.replace(/\/$/, "");

  if (!appUrl) throw new Error("Growth OS app URL is not configured");

  const signInWithOtp =
    dependencies?.signInWithOtp ?? ((payload) => supabase!.auth.signInWithOtp(payload));

  try {
    await signInWithOtp({
      email,
      options: { emailRedirectTo: `${appUrl}/auth/callback` },
    });
  } catch {
    // Account state and provider failures intentionally share the same response.
  }

  return { accepted: true };
}

export async function signOutAuthenticatedUser(): Promise<void> {
  const { error } = await createUserSupabase().auth.signOut();
  if (error) throw new AuthBoundaryError("UNAUTHENTICATED");
}

type CallbackDependencies = {
  exchangeCode: (code: string) => Promise<{ user: CallbackUser | null }>;
  findPendingInvitations: (user: CallbackUser) => Promise<PendingInvitation[]>;
  acceptInvitation: (invitation: PendingInvitation) => Promise<void>;
  clearPendingInvitation: (
    userId: string,
    remainingAppMetadata: Record<string, unknown>,
  ) => Promise<void>;
};

const pendingInvitationMetadataSchema = z.object({
  pending_invitation_id: z.string().uuid(),
  pending_tenant_id: z.string().uuid(),
});

function pendingInvitationFrom(user: CallbackUser): PendingInvitation | null {
  const hasInvitationId = Object.hasOwn(user.appMetadata, "pending_invitation_id");
  const hasTenantId = Object.hasOwn(user.appMetadata, "pending_tenant_id");
  if (!hasInvitationId && !hasTenantId) return null;

  const parsed = pendingInvitationMetadataSchema.safeParse(user.appMetadata);
  if (!parsed.success) throw new AuthBoundaryError("INVITATION_INVALID");

  return {
    invitationId: parsed.data.pending_invitation_id,
    tenantId: parsed.data.pending_tenant_id,
    userId: user.id,
    email: user.email.toLowerCase(),
  };
}

export async function completeAuthCallbackWith(
  code: string,
  dependencies: CallbackDependencies,
): Promise<{ authenticated: true }> {
  const parsed = authCallbackSchema.parse({ code });
  const { user } = await dependencies.exchangeCode(parsed.code);
  if (!user) throw new AuthBoundaryError("AUTH_CALLBACK_INVALID");

  let pendingInvitation = pendingInvitationFrom(user);
  if (!pendingInvitation) {
    const candidates = await dependencies.findPendingInvitations(user);
    if (candidates.length > 1) throw new AuthBoundaryError("INVITATION_INVALID");
    pendingInvitation = candidates[0] ?? null;
  }
  if (pendingInvitation) {
    await dependencies.acceptInvitation(pendingInvitation);
    const { pending_invitation_id, pending_tenant_id, ...remainingAppMetadata } = user.appMetadata;
    await dependencies.clearPendingInvitation(user.id, remainingAppMetadata);
  }

  return { authenticated: true };
}

function callbackUserFrom(user: User | null): CallbackUser | null {
  if (!user?.email) return null;
  return {
    id: user.id,
    email: user.email,
    appMetadata: user.app_metadata,
    userMetadata: user.user_metadata,
  };
}

export async function completeAuthCallback(code: string): Promise<{ authenticated: true }> {
  const userSupabase = createUserSupabase();
  const jobSupabase = createJobSupabase();

  return completeAuthCallbackWith(code, {
    async exchangeCode(callbackCode) {
      const { data, error } = await userSupabase.auth.exchangeCodeForSession(callbackCode);
      if (error) throw new AuthBoundaryError("AUTH_CALLBACK_INVALID");
      return { user: callbackUserFrom(data.session?.user ?? null) };
    },
    async findPendingInvitations(user) {
      const { data, error } = await jobSupabase
        .from("membership_invitations")
        .select("id, tenant_id")
        .eq("email", user.email.toLowerCase())
        .is("accepted_at", null)
        .is("superseded_at", null)
        .gt("expires_at", new Date().toISOString())
        .limit(2);
      if (error || !data) throw new AuthBoundaryError("INVITATION_INVALID");
      return data.map((invitation) => ({
        invitationId: invitation.id,
        tenantId: invitation.tenant_id,
        userId: user.id,
        email: user.email.toLowerCase(),
      }));
    },
    async acceptInvitation(invitation) {
      const { data, error } = await jobSupabase.rpc("accept_membership_invitation", {
        invitation_id: invitation.invitationId,
        target_tenant: invitation.tenantId,
        invited_user_id: invitation.userId,
        invited_email: invitation.email,
        event_request_id: randomUUID(),
      });
      if (error || !data) throw new AuthBoundaryError("INVITATION_INVALID");
    },
    async clearPendingInvitation(userId, remainingAppMetadata) {
      const { error } = await jobSupabase.auth.admin.updateUserById(userId, {
        app_metadata: remainingAppMetadata,
      });
      if (error) throw new AuthBoundaryError("INVITATION_FAILED");
    },
  });
}

type InvitationDependencies = {
  actor: AuthUser;
  isPlatformAdmin: (userId: string) => Promise<boolean>;
  tenantExists: (tenantId: string) => Promise<boolean>;
  prepareInvitation: (input: {
    tenantId: string;
    email: string;
    invitedBy: string;
  }) => Promise<{ id: string }>;
  inviteUserByEmail: (email: string) => Promise<{
    userId: string;
    appMetadata?: Record<string, unknown>;
  }>;
  setAppMetadata: (userId: string, metadata: Record<string, unknown>) => Promise<void>;
};

export async function inviteClientOwnerAccount(
  input: InviteClientOwnerInput,
  dependencies: InvitationDependencies,
): Promise<{ invited: true }> {
  const parsed = inviteClientOwnerSchema.parse(input);
  if (!(await dependencies.isPlatformAdmin(dependencies.actor.id))) {
    throw new AuthBoundaryError("PLATFORM_ADMIN_REQUIRED");
  }
  if (!(await dependencies.tenantExists(parsed.tenantId))) {
    throw new AuthBoundaryError("TENANT_NOT_FOUND");
  }

  const invitation = await dependencies.prepareInvitation({
    tenantId: parsed.tenantId,
    email: parsed.email,
    invitedBy: dependencies.actor.id,
  });
  const invited = await dependencies.inviteUserByEmail(parsed.email);
  await dependencies.setAppMetadata(invited.userId, {
    ...(invited.appMetadata ?? {}),
    pending_invitation_id: invitation.id,
    pending_tenant_id: parsed.tenantId,
  });
  return { invited: true };
}

export async function inviteClientOwner(input: InviteClientOwnerInput): Promise<{ invited: true }> {
  const actor = await requireAuthenticatedUser();
  const jobSupabase = createJobSupabase();
  const appUrl = process.env.APP_URL?.replace(/\/$/, "");
  if (!appUrl) throw new Error("Growth OS app URL is not configured");

  return inviteClientOwnerAccount(input, {
    actor,
    async isPlatformAdmin(userId) {
      const { data, error } = await jobSupabase
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new AuthBoundaryError("PLATFORM_ADMIN_REQUIRED");
      return Boolean(data);
    },
    async tenantExists(tenantId) {
      const { data, error } = await jobSupabase
        .from("tenants")
        .select("id")
        .eq("id", tenantId)
        .maybeSingle();
      if (error) throw new AuthBoundaryError("TENANT_NOT_FOUND");
      return Boolean(data);
    },
    async inviteUserByEmail(email) {
      const { data, error } = await jobSupabase.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${appUrl}/auth/callback`,
      });
      if (error || !data.user) throw new AuthBoundaryError("INVITATION_FAILED");
      return { userId: data.user.id, appMetadata: data.user.app_metadata };
    },
    async prepareInvitation({ tenantId, email, invitedBy }) {
      const tokenHash = createHash("sha256").update(randomBytes(32)).digest("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await jobSupabase.rpc("prepare_membership_invitation", {
        target_tenant: tenantId,
        invitation_email: email,
        inviter_user_id: invitedBy,
        invitation_token_hash: tokenHash,
        invitation_expires_at: expiresAt,
        event_request_id: randomUUID(),
      });
      if (error || !data) throw new AuthBoundaryError("INVITATION_FAILED");
      return { id: data };
    },
    async setAppMetadata(userId, metadata) {
      const { error } = await jobSupabase.auth.admin.updateUserById(userId, {
        app_metadata: metadata,
      });
      if (error) throw new AuthBoundaryError("INVITATION_FAILED");
    },
  });
}
