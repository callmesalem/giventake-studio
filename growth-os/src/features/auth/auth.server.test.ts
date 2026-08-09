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
const OTHER_TENANT_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const INVITATION_ID = "33333333-3333-3333-3333-333333333333";
const OTHER_INVITATION_ID = "44444444-3333-3333-3333-333333333333";

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
  it("persists an audited usable invitation before sending email", async () => {
    const order: string[] = [];
    const prepareInvitation = vi.fn().mockImplementation(async () => {
      order.push("prepared");
      return { id: INVITATION_ID };
    });
    const inviteUserByEmail = vi.fn().mockImplementation(async () => {
      order.push("emailed");
      return { userId: USER_ID, appMetadata: { provider: "email" } };
    });
    const setAppMetadata = vi.fn().mockImplementation(async () => {
      order.push("metadata");
    });

    await expect(
      inviteClientOwnerAccount(
        { email: "Owner@Example.com", tenantId: TENANT_ID },
        {
          actor: { id: ADMIN_ID, email: "admin@example.com" },
          isPlatformAdmin: vi.fn().mockResolvedValue(true),
          tenantExists: vi.fn().mockResolvedValue(true),
          prepareInvitation,
          inviteUserByEmail,
          setAppMetadata,
        },
      ),
    ).resolves.toEqual({ invited: true });

    expect(order).toEqual(["prepared", "emailed", "metadata"]);
    expect(inviteUserByEmail).toHaveBeenCalledWith("owner@example.com");
    expect(setAppMetadata).toHaveBeenCalledWith(USER_ID, {
      provider: "email",
      pending_invitation_id: INVITATION_ID,
      pending_tenant_id: TENANT_ID,
    });
    expect(setAppMetadata.mock.calls[0]?.[1]).not.toHaveProperty("user_metadata");
  });

  it("does not send email when durable invitation preparation fails", async () => {
    const inviteUserByEmail = vi.fn();

    await expect(
      inviteClientOwnerAccount(
        { email: "owner@example.com", tenantId: TENANT_ID },
        {
          actor: { id: ADMIN_ID, email: "admin@example.com" },
          isPlatformAdmin: vi.fn().mockResolvedValue(true),
          tenantExists: vi.fn().mockResolvedValue(true),
          prepareInvitation: vi.fn().mockRejectedValue(new Error("audit unavailable")),
          inviteUserByEmail,
          setAppMetadata: vi.fn(),
        },
      ),
    ).rejects.toThrow("audit unavailable");
    expect(inviteUserByEmail).not.toHaveBeenCalled();
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
          prepareInvitation: vi.fn(),
          inviteUserByEmail,
          setAppMetadata: vi.fn(),
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
        findPendingInvitations: vi.fn().mockResolvedValue([]),
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

  it("recovers an emailed invitation when app metadata was not written", async () => {
    const acceptInvitation = vi.fn().mockResolvedValue(undefined);
    const clearPendingInvitation = vi.fn().mockResolvedValue(undefined);

    await expect(
      completeAuthCallbackWith("callback-code", {
        exchangeCode: vi.fn().mockResolvedValue({
          user: {
            id: USER_ID,
            email: "owner@example.com",
            appMetadata: { provider: "email" },
            userMetadata: {},
          },
        }),
        findPendingInvitations: vi.fn().mockResolvedValue([
          {
            invitationId: INVITATION_ID,
            tenantId: TENANT_ID,
            userId: USER_ID,
            email: "owner@example.com",
          },
        ]),
        acceptInvitation,
        clearPendingInvitation,
      }),
    ).resolves.toEqual({ authenticated: true });

    expect(acceptInvitation).toHaveBeenCalledOnce();
    expect(clearPendingInvitation).toHaveBeenCalledWith(USER_ID, { provider: "email" });
  });

  it("fails closed instead of choosing between concurrent tenant invitations", async () => {
    const acceptInvitation = vi.fn();

    await expect(
      completeAuthCallbackWith("callback-code", {
        exchangeCode: vi.fn().mockResolvedValue({
          user: {
            id: USER_ID,
            email: "owner@example.com",
            appMetadata: { provider: "email" },
            userMetadata: {},
          },
        }),
        findPendingInvitations: vi.fn().mockResolvedValue([
          {
            invitationId: INVITATION_ID,
            tenantId: TENANT_ID,
            userId: USER_ID,
            email: "owner@example.com",
          },
          {
            invitationId: OTHER_INVITATION_ID,
            tenantId: OTHER_TENANT_ID,
            userId: USER_ID,
            email: "owner@example.com",
          },
        ]),
        acceptInvitation,
        clearPendingInvitation: vi.fn(),
      }),
    ).rejects.toMatchObject({ code: "INVITATION_INVALID" });

    expect(acceptInvitation).not.toHaveBeenCalled();
  });

  it("fails closed on malformed server invitation metadata without using recovery", async () => {
    const findPendingInvitations = vi.fn();

    await expect(
      completeAuthCallbackWith("callback-code", {
        exchangeCode: vi.fn().mockResolvedValue({
          user: {
            id: USER_ID,
            email: "owner@example.com",
            appMetadata: {
              provider: "email",
              pending_invitation_id: INVITATION_ID,
            },
            userMetadata: { pending_tenant_id: TENANT_ID },
          },
        }),
        findPendingInvitations,
        acceptInvitation: vi.fn(),
        clearPendingInvitation: vi.fn(),
      }),
    ).rejects.toMatchObject({ code: "INVITATION_INVALID" });

    expect(findPendingInvitations).not.toHaveBeenCalled();
  });

  it("retries acceptance after metadata cleanup fails and preserves unrelated metadata", async () => {
    const user = {
      id: USER_ID,
      email: "owner@example.com",
      appMetadata: {
        provider: "email",
        feature_access: "retained",
        pending_invitation_id: INVITATION_ID,
        pending_tenant_id: TENANT_ID,
      },
      userMetadata: {},
    };
    const acceptInvitation = vi.fn().mockResolvedValue(undefined);
    const clearPendingInvitation = vi
      .fn()
      .mockRejectedValueOnce(new Error("metadata unavailable"))
      .mockResolvedValueOnce(undefined);
    const findPendingInvitations = vi.fn().mockResolvedValue([
      {
        invitationId: OTHER_INVITATION_ID,
        tenantId: OTHER_TENANT_ID,
        userId: USER_ID,
        email: "owner@example.com",
      },
    ]);
    const dependencies = {
      exchangeCode: vi.fn().mockResolvedValue({ user }),
      findPendingInvitations,
      acceptInvitation,
      clearPendingInvitation,
    };

    await expect(completeAuthCallbackWith("first-code", dependencies)).rejects.toThrow(
      "metadata unavailable",
    );
    await expect(completeAuthCallbackWith("retry-code", dependencies)).resolves.toEqual({
      authenticated: true,
    });

    expect(acceptInvitation).toHaveBeenCalledTimes(2);
    expect(acceptInvitation).toHaveBeenLastCalledWith({
      invitationId: INVITATION_ID,
      tenantId: TENANT_ID,
      userId: USER_ID,
      email: "owner@example.com",
    });
    expect(findPendingInvitations).not.toHaveBeenCalled();
    expect(clearPendingInvitation).toHaveBeenCalledTimes(2);
    expect(clearPendingInvitation).toHaveBeenLastCalledWith(USER_ID, {
      provider: "email",
      feature_access: "retained",
    });
  });
});
