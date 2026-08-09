import { describe, expect, it, vi } from "vitest";
import {
  assertClientOwnerContext,
  resolveTenantContext,
  resolveTenantContextWithAdapters,
} from "./tenant-context.server";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const TENANT_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const SUPPORT_SESSION_ID = "22222222-2222-2222-2222-222222222222";

describe("resolveTenantContext", () => {
  it("denies a missing authenticated user", async () => {
    await expect(
      resolveTenantContext({ userId: null, requestedTenantId: null, memberships: [] }),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("does not accept a tenant id without membership", async () => {
    await expect(
      resolveTenantContext({
        userId: USER_ID,
        requestedTenantId: TENANT_B,
        memberships: [{ tenantId: TENANT_A, role: "client_owner" }],
      }),
    ).rejects.toMatchObject({ code: "TENANT_FORBIDDEN" });
  });

  it("requires tenant selection when an owner belongs to two tenants", async () => {
    await expect(
      resolveTenantContext({
        userId: USER_ID,
        requestedTenantId: null,
        memberships: [
          { tenantId: TENANT_A, role: "client_owner" },
          { tenantId: TENANT_B, role: "client_owner" },
        ],
      }),
    ).rejects.toMatchObject({ code: "TENANT_SELECTION_REQUIRED" });
  });

  it("automatically resolves one client-owner membership", async () => {
    await expect(
      resolveTenantContext({
        userId: USER_ID,
        requestedTenantId: null,
        memberships: [{ tenantId: TENANT_A, role: "client_owner" }],
      }),
    ).resolves.toEqual({
      userId: USER_ID,
      tenantId: TENANT_A,
      role: "client_owner",
      supportSessionId: null,
    });
  });

  it("allows only an active audited support session for its tenant", async () => {
    await expect(
      resolveTenantContext({
        userId: USER_ID,
        requestedTenantId: TENANT_A,
        memberships: [],
        supportSessions: [
          {
            id: SUPPORT_SESSION_ID,
            tenantId: TENANT_A,
            active: true,
            audited: true,
          },
        ],
      }),
    ).resolves.toEqual({
      userId: USER_ID,
      tenantId: TENANT_A,
      role: "platform_admin",
      supportSessionId: SUPPORT_SESSION_ID,
    });

    await expect(
      resolveTenantContext({
        userId: USER_ID,
        requestedTenantId: TENANT_A,
        memberships: [],
        supportSessions: [
          {
            id: SUPPORT_SESSION_ID,
            tenantId: TENANT_A,
            active: true,
            audited: false,
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "TENANT_FORBIDDEN" });
  });

  it("rejects support access at the client-owner mutation boundary", () => {
    expect(() =>
      assertClientOwnerContext({
        userId: USER_ID,
        tenantId: TENANT_A,
        role: "platform_admin",
        supportSessionId: SUPPORT_SESSION_ID,
      }),
    ).toThrowError(expect.objectContaining({ code: "SUPPORT_READ_ONLY" }));
  });
});

describe("resolveTenantContextWithAdapters", () => {
  it("records a sanitized event before denying a supplied cross-tenant id", async () => {
    const recordDeniedAccess = vi.fn().mockResolvedValue(undefined);

    await expect(
      resolveTenantContextWithAdapters({
        getUserId: vi.fn().mockResolvedValue(USER_ID),
        getRequestedTenantId: vi.fn().mockReturnValue(TENANT_B),
        listMemberships: vi.fn().mockResolvedValue([{ tenantId: TENANT_A, role: "client_owner" }]),
        listSupportSessions: vi.fn().mockResolvedValue([]),
        recordDeniedAccess,
      }),
    ).rejects.toMatchObject({ code: "TENANT_FORBIDDEN" });

    expect(recordDeniedAccess).toHaveBeenCalledOnce();
    expect(recordDeniedAccess).toHaveBeenCalledWith({
      action: "cross_tenant_access_denied",
      actorUserId: USER_ID,
      requestedTenantId: TENANT_B,
      authorizedTenantIds: [TENANT_A],
      metadata: { reason_code: "tenant_not_allowed" },
    });
    expect(JSON.stringify(recordDeniedAccess.mock.calls[0]?.[0].metadata)).not.toContain(TENANT_B);
  });
});
