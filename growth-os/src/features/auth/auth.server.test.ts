import { describe, expect, it, vi } from "vitest";
import {
  completeAuthCallbackWith,
  getAuthenticatedUserFrom,
  inviteClientOwnerAccount,
  requestMagicLinkForEmail,
  requireAuthenticatedUserFrom,
} from "./auth.server";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const ADMIN_ID = "22222222-2222-2222-2222-222222222222";
const TENANT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const INVITATION_ID = "33333333-3333-3333-3333-333333333333";

describe("magic-link authentication", () => {
  it("returns the same accepted result when Supabase rejects the request", async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({
      data: { user: null, session: null },
      error: new Error("user not found"),
    });

    await expect(
      requestMagicLinkForEmail(
        { email: "Owner@Example.com" },
        { appUrl: "https://app.example.com/", signInWithOtp },
      ),
    ).resolves.toEqual({ accepted: true });
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "owner@example.com",
      options: { emailRedirectTo: "https://app.example.com/auth/callback" },
    });
  });

  it("rejects malformed email before requesting a link", async () => {
    const signInWithOtp = vi.fn();

    await expect(
      requestMagicLinkForEmail(
        { email: "not-an-email" },
        { appUrl: "https://app.example.com", signInWithOtp },
      ),
    ).rejects.toMatchObject({ name: "ZodError" });
    expect(signInWithOtp).not.toHaveBeenCalled();
  });
});

describe("authenticated user", () => {
  it("returns the exact public user shape", async () => {
    const user = await getAuthenticatedUserFrom(async () => ({
      data: {
        user: {
          id: USER_ID,
          email: "owner@example.com",
          app_metadata: { internal: "not-public" },
        },
      },
      error: null,
    }));

    expect(user).toEqual({ id: USER_ID, email: "owner@example.com" });
  });

  it("treats a failed user lookup as unauthenticated", async () => {
    await expect(
      requireAuthenticatedUserFrom(async () => ({
        data: { user: null },
        error: new Error("expired session"),
      })),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });
});

describe("invitation acceptance", () => {
  it("stores pending tenant context in app metadata only", async () => {
    const setAppMetadata = vi.fn().mockResolvedValue(undefined);
    const createInvitation = vi.fn().mockResolvedValue({ id: INVITATION_ID });
    const inviteUserByEmail = vi.fn().mockResolvedValue({
      userId: USER_ID,
      appMetadata: { provider: "email" },
    });

    await expect(
      inviteClientOwnerAccount(
        { email: "Owner@Example.com", tenantId: TENANT_ID },
        {
          actor: { id: ADMIN_ID, email: "admin@example.com" },
          isPlatformAdmin: vi.fn().mockResolvedValue(true),
          tenantExists: vi.fn().mockResolvedValue(true),
          createInvitation,
          inviteUserByEmail,
          setAppMetadata,
          recordInvitation: vi.fn().mockResolvedValue(undefined),
        },
      ),
    ).resolves.toEqual({ invited: true });

    expect(inviteUserByEmail).toHaveBeenCalledWith("owner@example.com");
    expect(setAppMetadata).toHaveBeenCalledWith(USER_ID, {
      provider: "email",
      pending_invitation_id: INVITATION_ID,
      pending_tenant_id: TENANT_ID,
    });
    expect(setAppMetadata.mock.calls[0]?.[1]).not.toHaveProperty("user_metadata");
  });

  it("rejects invitation creation by a non-platform administrator", async () => {
    const inviteUserByEmail = vi.fn();

    await expect(
      inviteClientOwnerAccount(
        { email: "owner@example.com", tenantId: TENANT_ID },
        {
          actor: { id: USER_ID, email: "owner@example.com" },
          isPlatformAdmin: vi.fn().mockResolvedValue(false),
          tenantExists: vi.fn(),
          createInvitation: vi.fn(),
          inviteUserByEmail,
          setAppMetadata: vi.fn(),
          recordInvitation: vi.fn(),
        },
      ),
    ).rejects.toMatchObject({ code: "PLATFORM_ADMIN_REQUIRED" });
    expect(inviteUserByEmail).not.toHaveBeenCalled();
  });

  it("accepts the server-controlled pending invitation during callback", async () => {
    const acceptInvitation = vi.fn().mockResolvedValue(undefined);
    const clearPendingInvitation = vi.fn().mockResolvedValue(undefined);

    await expect(
      completeAuthCallbackWith("callback-code", {
        exchangeCode: vi.fn().mockResolvedValue({
          user: {
            id: USER_ID,
            email: "owner@example.com",
            appMetadata: {
              provider: "email",
              pending_invitation_id: INVITATION_ID,
              pending_tenant_id: TENANT_ID,
            },
            userMetadata: { pending_tenant_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" },
          },
        }),
        acceptInvitation,
        clearPendingInvitation,
      }),
    ).resolves.toEqual({ authenticated: true });

    expect(acceptInvitation).toHaveBeenCalledWith({
      invitationId: INVITATION_ID,
      tenantId: TENANT_ID,
      userId: USER_ID,
      email: "owner@example.com",
    });
    expect(clearPendingInvitation).toHaveBeenCalledWith(USER_ID, { provider: "email" });
  });
});
