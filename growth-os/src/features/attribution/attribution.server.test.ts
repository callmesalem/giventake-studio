import { describe, expect, it, vi } from "vitest";
import {
  AttributionNotFoundError,
  correctAttributionWith,
  recomputeLeadAttributionWith,
  selectAttributionEvidence,
} from "./attribution.server";

const TENANT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const OTHER_TENANT_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const LEAD_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const USER_ID = "11111111-1111-1111-1111-111111111111";
const REQUEST_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const FIRST_EVIDENCE_ID = "e1000000-0000-0000-0000-000000000001";
const LAST_EVIDENCE_ID = "e1000000-0000-0000-0000-000000000002";
const ORIGINAL_TOUCH_ID = "f1000000-0000-0000-0000-000000000001";

const evidence = [
  {
    id: LAST_EVIDENCE_ID,
    occurredAt: "2026-08-09T15:59:00.000Z",
    declaredSource: null,
    clickIds: { fbclid: "f-1" },
    utmSource: "meta",
    utmCampaign: "late-campaign",
    referrerDomain: null,
  },
  {
    id: FIRST_EVIDENCE_ID,
    occurredAt: "2026-08-08T10:00:00.000Z",
    declaredSource: "referral",
    clickIds: {},
    utmSource: null,
    utmCampaign: null,
    referrerDomain: null,
  },
  {
    id: "e1000000-0000-0000-0000-000000000003",
    occurredAt: "2026-08-10T00:00:00.000Z",
    declaredSource: "google",
    clickIds: { gclid: "too-late" },
    utmSource: "google",
    utmCampaign: null,
    referrerDomain: null,
  },
];

describe("attribution evidence selection", () => {
  it("uses deterministic earliest and latest accepted evidence at or before submission", () => {
    expect(selectAttributionEvidence(evidence, "2026-08-09T16:00:00.000Z")).toEqual({
      first: evidence[1],
      last: evidence[0],
    });
  });

  it("breaks equal timestamps by evidence id", () => {
    const tied = [
      { ...evidence[0]!, id: LAST_EVIDENCE_ID, occurredAt: "2026-08-09T10:00:00.000Z" },
      { ...evidence[1]!, id: FIRST_EVIDENCE_ID, occurredAt: "2026-08-09T10:00:00.000Z" },
    ];
    expect(selectAttributionEvidence(tied, "2026-08-09T16:00:00.000Z")).toEqual({
      first: tied[1],
      last: tied[0],
    });
  });
});

describe("recomputeLeadAttributionWith", () => {
  it("passes deterministic first and last decisions to one append-only transaction", async () => {
    const applyRecomputation = vi.fn().mockResolvedValue({ changed: true });

    await expect(
      recomputeLeadAttributionWith(TENANT_ID, LEAD_ID, {
        loadLead: vi.fn().mockResolvedValue({ submittedAt: "2026-08-09T16:00:00.000Z" }),
        loadEvidence: vi.fn().mockResolvedValue(evidence),
        applyRecomputation,
        requestId: () => REQUEST_ID,
      }),
    ).resolves.toBeUndefined();

    expect(applyRecomputation).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      leadId: LEAD_ID,
      requestId: REQUEST_ID,
      first: {
        evidenceId: FIRST_EVIDENCE_ID,
        decision: {
          source: "referral",
          campaignExternalId: null,
          confidence: "high",
          state: "attributed",
          reasonCodes: ["declared_source:referral"],
        },
      },
      last: {
        evidenceId: LAST_EVIDENCE_ID,
        decision: {
          source: "meta_ads",
          campaignExternalId: null,
          confidence: "high",
          state: "attributed",
          reasonCodes: ["click_id:fbclid"],
        },
      },
    });
  });

  it("fails closed for wrong-tenant and unknown leads before reading evidence", async () => {
    for (const tenantId of [TENANT_ID, OTHER_TENANT_ID]) {
      const loadEvidence = vi.fn();
      const applyRecomputation = vi.fn();
      await expect(
        recomputeLeadAttributionWith(tenantId, LEAD_ID, {
          loadLead: vi.fn().mockResolvedValue(null),
          loadEvidence,
          applyRecomputation,
          requestId: () => REQUEST_ID,
        }),
      ).rejects.toEqual(new AttributionNotFoundError());
      expect(loadEvidence).not.toHaveBeenCalled();
      expect(applyRecomputation).not.toHaveBeenCalled();
    }
  });
});

describe("manual attribution correction", () => {
  it("requires owner context and stores a separate overlay pointing to the original", async () => {
    const correct = vi.fn().mockResolvedValue({
      original: {
        id: ORIGINAL_TOUCH_ID,
        source: "google_ads",
        campaignExternalId: null,
        confidence: "high",
        state: "attributed",
        reasonCodes: ["click_id:gclid"],
      },
      correction: {
        id: "f2000000-0000-0000-0000-000000000001",
        source: "referral",
        campaignExternalId: null,
        confidence: "high",
        state: "attributed",
        reasonCodes: ["manual_correction"],
        reason: "Customer confirmed the referral source.",
      },
    });

    const result = await correctAttributionWith(
      {
        leadId: LEAD_ID,
        originalComputedTouchId: ORIGINAL_TOUCH_ID,
        source: "referral",
        campaignExternalId: null,
        confidence: "high",
        reason: "  Customer confirmed the referral source.  ",
      },
      {
        requireOwner: vi.fn().mockResolvedValue({ tenantId: TENANT_ID, userId: USER_ID }),
        correct,
        requestId: () => REQUEST_ID,
      },
    );

    expect(correct).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      leadId: LEAD_ID,
      originalComputedTouchId: ORIGINAL_TOUCH_ID,
      actorId: USER_ID,
      source: "referral",
      campaignExternalId: null,
      confidence: "high",
      reason: "Customer confirmed the referral source.",
      requestId: REQUEST_ID,
    });
    expect(result.original.id).toBe(ORIGINAL_TOUCH_ID);
    expect(result.correction.source).toBe("referral");
  });

  it("rejects support sessions and invalid reasons before mutation", async () => {
    const correct = vi.fn();
    await expect(
      correctAttributionWith(
        {
          leadId: LEAD_ID,
          originalComputedTouchId: ORIGINAL_TOUCH_ID,
          source: "referral",
          campaignExternalId: null,
          confidence: "high",
          reason: "too short",
        },
        {
          requireOwner: vi.fn().mockRejectedValue(new Error("SUPPORT_READ_ONLY")),
          correct,
          requestId: () => REQUEST_ID,
        },
      ),
    ).rejects.toThrow("SUPPORT_READ_ONLY");
    expect(correct).not.toHaveBeenCalled();
  });
});
