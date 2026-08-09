import "@tanstack/react-start/server-only";
import { randomUUID } from "node:crypto";
import {
  requireClientOwnerContext,
  requireTenantContext,
} from "@/features/tenants/tenant-context.server";
import { createUserSupabase } from "@/lib/server/supabase.server";
import { brandInputSchema, type BrandInput } from "./brand.schemas";

type BrandContext = { tenantId: string };

type BrandRecord = {
  display_name: string;
  logo_url: string;
  primary_color: string;
  accent_color: string;
  on_primary_color: string;
  report_name: string;
};

function toBrandInput(record: BrandRecord): BrandInput {
  return brandInputSchema.parse({
    displayName: record.display_name,
    logoUrl: record.logo_url,
    primaryColor: `#${record.primary_color}`,
    accentColor: `#${record.accent_color}`,
    onPrimaryColor: `#${record.on_primary_color}`,
    reportName: record.report_name,
  });
}

type GetBrandDependencies = {
  requireTenant: () => Promise<BrandContext>;
  loadBrand: (tenantId: string) => Promise<BrandInput>;
};

export async function getBrandWith(dependencies: GetBrandDependencies): Promise<BrandInput> {
  const context = await dependencies.requireTenant();
  return dependencies.loadBrand(context.tenantId);
}

export async function getBrand(): Promise<BrandInput> {
  return getBrandWith({
    requireTenant: requireTenantContext,
    async loadBrand(tenantId) {
      const { data, error } = await createUserSupabase()
        .from("brands")
        .select(
          "display_name, logo_url, primary_color, accent_color, on_primary_color, report_name",
        )
        .eq("tenant_id", tenantId)
        .single();
      if (error || !data) throw error ?? new Error("Tenant brand was not found");
      return toBrandInput(data);
    },
  });
}

type UpdateBrandTransactionInput = {
  tenantId: string;
  actorId: string;
  requestId: string;
  brand: BrandInput;
};

type UpdateBrandDependencies = {
  requireOwner: () => Promise<{ tenantId: string; userId: string }>;
  updateBrandTransaction: (input: UpdateBrandTransactionInput) => Promise<void>;
  requestId: () => string;
};

export async function updateBrandWith(
  input: BrandInput,
  dependencies: UpdateBrandDependencies,
): Promise<{ updated: true }> {
  const brand = brandInputSchema.parse(input);
  const context = await dependencies.requireOwner();
  await dependencies.updateBrandTransaction({
    tenantId: context.tenantId,
    actorId: context.userId,
    requestId: dependencies.requestId(),
    brand,
  });
  return { updated: true };
}

export async function updateBrand(input: BrandInput): Promise<{ updated: true }> {
  return updateBrandWith(input, {
    requireOwner: requireClientOwnerContext,
    requestId: randomUUID,
    async updateBrandTransaction({ tenantId, requestId, brand }) {
      const { data, error } = await createUserSupabase().rpc("update_tenant_brand", {
        target_tenant: tenantId,
        brand_display_name: brand.displayName,
        brand_logo_url: brand.logoUrl,
        brand_primary_color: brand.primaryColor.slice(1),
        brand_accent_color: brand.accentColor.slice(1),
        brand_on_primary_color: brand.onPrimaryColor.slice(1),
        brand_report_name: brand.reportName,
        event_request_id: requestId,
      });
      if (error || !data) throw error ?? new Error("Tenant brand was not updated");
    },
  });
}
