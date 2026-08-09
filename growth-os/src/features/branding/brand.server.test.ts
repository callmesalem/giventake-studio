import { describe, expect, it, vi } from "vitest";
import { brandInputSchema, contrastRatio } from "./brand.schemas";
import { getBrandWith, updateBrandWith } from "./brand.server";

const TENANT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_ID = "11111111-1111-1111-1111-111111111111";

const validBrand = {
  displayName: "Pilot Adjusters",
  logoUrl: "https://cdn.example.com/pilot.svg",
  primaryColor: "#0057B8",
  accentColor: "#F4B400",
  onPrimaryColor: "#FFFFFF",
  reportName: "Pilot Growth Report",
};

describe("brandInputSchema", () => {
  it("normalizes brand colors to six-digit lowercase hex", () => {
    expect(brandInputSchema.parse(validBrand)).toMatchObject({
      primaryColor: "#0057b8",
      accentColor: "#f4b400",
      onPrimaryColor: "#ffffff",
    });
  });

  it("rejects non-HTTPS logos", () => {
    expect(() =>
      brandInputSchema.parse({ ...validBrand, logoUrl: "http://cdn.example.com/pilot.svg" }),
    ).toThrow();
  });

  it("rejects primary text contrast below 4.5 to 1", () => {
    expect(contrastRatio("#ffffff", "#777777")).toBeLessThan(4.5);
    expect(() =>
      brandInputSchema.parse({
        ...validBrand,
        primaryColor: "#ffffff",
        onPrimaryColor: "#777777",
      }),
    ).toThrow();
  });
});

describe("brand server boundary", () => {
  it("loads branding only for the active tenant context", async () => {
    const loadBrand = vi.fn().mockResolvedValue(validBrand);

    await expect(
      getBrandWith({
        requireTenant: vi.fn().mockResolvedValue({ tenantId: TENANT_ID }),
        loadBrand,
      }),
    ).resolves.toEqual(validBrand);
    expect(loadBrand).toHaveBeenCalledWith(TENANT_ID);
  });

  it("updates the owner's active tenant through one transactional mutation", async () => {
    const updateBrandTransaction = vi.fn().mockResolvedValue(undefined);

    await expect(
      updateBrandWith(validBrand, {
        requireOwner: vi.fn().mockResolvedValue({ tenantId: TENANT_ID, userId: USER_ID }),
        updateBrandTransaction,
        requestId: () => "33333333-3333-3333-3333-333333333333",
      }),
    ).resolves.toEqual({ updated: true });

    expect(updateBrandTransaction).toHaveBeenCalledOnce();
    expect(updateBrandTransaction).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      actorId: USER_ID,
      requestId: "33333333-3333-3333-3333-333333333333",
      brand: {
        ...validBrand,
        primaryColor: "#0057b8",
        accentColor: "#f4b400",
        onPrimaryColor: "#ffffff",
      },
    });
  });

  it("does not mutate branding when the client-owner boundary rejects support access", async () => {
    const updateBrandTransaction = vi.fn();

    await expect(
      updateBrandWith(validBrand, {
        requireOwner: vi.fn().mockRejectedValue(new Error("SUPPORT_READ_ONLY")),
        updateBrandTransaction,
        requestId: vi.fn(),
      }),
    ).rejects.toThrow("SUPPORT_READ_ONLY");
    expect(updateBrandTransaction).not.toHaveBeenCalled();
  });
});
