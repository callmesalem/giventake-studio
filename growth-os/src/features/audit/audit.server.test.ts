import { describe, expect, it, vi } from "vitest";
import {
  AUDIT_ACTIONS,
  auditActionSchema,
  auditMetadataSchema,
  writeAuditEventWith,
} from "./audit.server";

const TENANT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_ID = "11111111-1111-1111-1111-111111111111";
const TARGET_ID = "22222222-2222-2222-2222-222222222222";
const REQUEST_ID = "33333333-3333-3333-3333-333333333333";

describe("audit schemas", () => {
  it("accepts every fixed Release 1 action and rejects unsupported actions", () => {
    expect(AUDIT_ACTIONS).toHaveLength(23);
    for (const action of AUDIT_ACTIONS) {
      expect(auditActionSchema.parse(action)).toBe(action);
    }
    expect(() => auditActionSchema.parse("support.impersonated")).toThrow();
  });

  it.each([
    { access_token: "secret" },
    { lead_notes: "private" },
    { email: "lead@example.com" },
    { arbitrary_key: "value" },
    { reason_code: { nested: true } },
    { reason_code: "sk_live_encoded_secret" },
    { change_code: "customer_email" },
    { status: "private_notes" },
    { request_type: "subject_email" },
  ])("rejects sensitive, personal, nested, or unsupported metadata %#", (metadata) => {
    expect(() => auditMetadataSchema.parse(metadata)).toThrow();
  });

  it("accepts only allowlisted scalar operational metadata", () => {
    expect(
      auditMetadataSchema.parse({
        reason_code: "tenant_not_allowed",
        expires_at: "2026-08-09T17:00:00.000Z",
        rows_processed: 12,
        request_type: "deletion",
        matched_count: 1,
        has_more: false,
        error_code: null,
      }),
    ).toEqual({
      reason_code: "tenant_not_allowed",
      expires_at: "2026-08-09T17:00:00.000Z",
      rows_processed: 12,
      request_type: "deletion",
      matched_count: 1,
      has_more: false,
      error_code: null,
    });
  });

  it("accepts canonical privacy-safe attribution change metadata", () => {
    expect(
      auditMetadataSchema.parse({
        attribution_model: "first_touch",
        old_source: "referral",
        new_source: "google_ads",
        old_confidence: "medium",
        new_confidence: "high",
        old_state: "ambiguous",
        new_state: "attributed",
        old_reason_codes: "declared_source:referral,click_id:gclid",
        new_reason_codes: "manual_correction",
      }),
    ).toMatchObject({
      old_source: "referral",
      new_source: "google_ads",
      old_state: "ambiguous",
      new_state: "attributed",
    });
  });
});

describe("writeAuditEventWith", () => {
  it("passes a sanitized event to the database audit function", async () => {
    const persist = vi.fn().mockResolvedValue(TARGET_ID);

    await expect(
      writeAuditEventWith(
        {
          tenantId: TENANT_ID,
          actorId: USER_ID,
          action: "brand.updated",
          targetType: "brand",
          targetId: TARGET_ID,
          requestId: REQUEST_ID,
          metadata: { change_code: "settings_saved" },
        },
        persist,
      ),
    ).resolves.toBe(TARGET_ID);

    expect(persist).toHaveBeenCalledWith({
      target_tenant: TENANT_ID,
      event_actor_user_id: USER_ID,
      event_action: "brand.updated",
      event_target_type: "brand",
      event_target_id: TARGET_ID,
      event_request_id: REQUEST_ID,
      event_metadata: { change_code: "settings_saved" },
    });
  });

  it("fails closed when audit persistence fails", async () => {
    await expect(
      writeAuditEventWith(
        {
          tenantId: TENANT_ID,
          actorId: USER_ID,
          action: "brand.updated",
          targetType: "brand",
          targetId: null,
          requestId: REQUEST_ID,
          metadata: {},
        },
        vi.fn().mockRejectedValue(new Error("audit unavailable")),
      ),
    ).rejects.toThrow("audit unavailable");
  });
});
