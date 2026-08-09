import { describe, expect, it, vi } from "vitest";
import {
  ACTIVE_TENANT_COOKIE,
  SUPPORT_SESSION_COOKIE,
  endSupportSessionWith,
  getSupportAdminDataWith,
  startSupportSessionWith,
  supportSessionInputSchema,
} from "./support.server";

const ADMIN_ID = "11111111-1111-1111-1111-111111111111";
const TENANT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const SESSION_ID = "22222222-2222-2222-2222-222222222222";
const REQUEST_ID = "33333333-3333-3333-3333-333333333333";
const NOW = new Date("2026-08-09T16:00:00.000Z");

describe("supportSessionInputSchema", () => {
  it("requires a sanitized nonempty reason", () => {
    expect(() =>
      supportSessionInputSchema.parse({ tenantId: TENANT_ID, reason: "   ", durationMinutes: 30 }),
    ).toThrow();
    expect(() =>
      supportSessionInputSchema.parse({
        tenantId: TENANT_ID,
        reason: "Investigating\u0000issue",
        durationMinutes: 30,
      }),
    ).toThrow();
  });

  it("rejects a duration over 60 minutes", () => {
    expect(() =>
      supportSessionInputSchema.parse({
        tenantId: TENANT_ID,
        reason: "Investigating a reported dashboard discrepancy.",
        durationMinutes: 61,
      }),
    ).toThrow();
  });
});

describe("startSupportSessionWith", () => {
  it("rejects a non-admin before creating a support session", async () => {
    const startSession = vi.fn();

    await expect(
      startSupportSessionWith(
        {
          tenantId: TENANT_ID,
          reason: "Investigating a reported dashboard discrepancy.",
          durationMinutes: 30,
        },
        {
          getActor: vi.fn().mockResolvedValue({ id: ADMIN_ID }),
          isPlatformAdmin: vi.fn().mockResolvedValue(false),
          startSession,
          setCookie: vi.fn(),
          now: () => NOW,
        },
      ),
    ).rejects.toMatchObject({ code: "PLATFORM_ADMIN_REQUIRED" });
    expect(startSession).not.toHaveBeenCalled();
  });

  it("starts an audited tenant session and sets both secure HTTP-only cookies", async () => {
    const setCookie = vi.fn();
    const expiresAt = "2026-08-09T16:30:00.000Z";
    const startSession = vi.fn().mockResolvedValue({ sessionId: SESSION_ID, expiresAt });

    await expect(
      startSupportSessionWith(
        {
          tenantId: TENANT_ID,
          reason: "  Investigating a reported dashboard discrepancy.  ",
          durationMinutes: 30,
        },
        {
          getActor: vi.fn().mockResolvedValue({ id: ADMIN_ID }),
          isPlatformAdmin: vi.fn().mockResolvedValue(true),
          startSession,
          setCookie,
          now: () => NOW,
        },
      ),
    ).resolves.toEqual({ expiresAt });

    expect(startSession).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      adminId: ADMIN_ID,
      reason: "Investigating a reported dashboard discrepancy.",
      expiresAt,
    });
    const cookieOptions = {
      expires: new Date(expiresAt),
      httpOnly: true,
      path: "/",
      sameSite: "strict",
      secure: true,
    };
    expect(setCookie).toHaveBeenCalledWith(ACTIVE_TENANT_COOKIE, TENANT_ID, cookieOptions);
    expect(setCookie).toHaveBeenCalledWith(SUPPORT_SESSION_COOKIE, SESSION_ID, cookieOptions);
  });
});

describe("endSupportSessionWith", () => {
  it("revokes the exact cookie-bound session and clears both cookies", async () => {
    const endSession = vi.fn().mockResolvedValue(undefined);
    const clearCookie = vi.fn();

    await expect(
      endSupportSessionWith({
        getActor: vi.fn().mockResolvedValue({ id: ADMIN_ID }),
        getSupportSessionId: vi.fn().mockReturnValue(SESSION_ID),
        endSession,
        clearCookie,
        requestId: () => REQUEST_ID,
      }),
    ).resolves.toEqual({ ended: true });

    expect(endSession).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      adminId: ADMIN_ID,
      requestId: REQUEST_ID,
    });
    expect(clearCookie).toHaveBeenCalledWith(SUPPORT_SESSION_COOKIE, { path: "/" });
    expect(clearCookie).toHaveBeenCalledWith(ACTIVE_TENANT_COOKIE, { path: "/" });
  });
});

describe("getSupportAdminDataWith", () => {
  it("does not expose tenant choices to a non-admin", async () => {
    const listTenants = vi.fn();
    await expect(
      getSupportAdminDataWith({
        getActor: vi.fn().mockResolvedValue({ id: ADMIN_ID }),
        isPlatformAdmin: vi.fn().mockResolvedValue(false),
        listTenants,
      }),
    ).rejects.toMatchObject({ code: "PLATFORM_ADMIN_REQUIRED" });
    expect(listTenants).not.toHaveBeenCalled();
  });
});
