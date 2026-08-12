import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LeadNotFoundError,
  leadListInputSchema,
  majorAmountToMinor,
  reopenLeadInputSchema,
  revenueInputSchema,
} from "./lead.schemas";
import {
  changeLeadStatusWith,
  getLeadWith,
  listLeadsWith,
  recordRevenueWith,
  reopenLeadWith,
} from "./leads.server";

const TENANT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_ID = "11111111-1111-1111-1111-111111111111";
const LEAD_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const REQUEST_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const NOW = new Date("2026-08-12T16:00:00.000Z");
const FIELD_KEY = Buffer.alloc(32, 7).toString("base64");
const LOOKUP_KEY = Buffer.alloc(32, 11).toString("base64");

const consent = {
  policy_version: "privacy-2026-08-08",
  source: "contact-form" as const,
  necessary: true as const,
  analytics: false,
  marketing: false,
  preferences: false,
  contact_requested: true as const,
  gpc: false,
  recorded_at: "2026-08-09T16:00:00.000Z",
};

const encryptedRow = {
  id: LEAD_ID,
  name_ciphertext: "encrypted-name",
  email_ciphertext: "encrypted-email",
  company_ciphertext: "encrypted-company",
  status: "new" as const,
  declared_source: "google",
  occurred_at: "2026-08-09T16:00:00.000Z",
  last_activity_at: "2026-08-09T16:00:00.000Z",
  attribution_touches: [{ confidence: "high" as const }],
  revenue_outcomes: [],
};

describe("lead schemas", () => {
  it("caps list pages at 100 and validates exact lookup filters", () => {
    expect(leadListInputSchema.parse({ limit: 500 }).limit).toBe(100);
    expect(
      leadListInputSchema.parse({ limit: 25, exactEmail: " Lead@Example.com " }).exactEmail,
    ).toBe("lead@example.com");
    expect(() => leadListInputSchema.parse({ limit: 25, status: "archived" })).toThrow();
  });

  it.each(["0", "-1", "1.001", "not-money", "9223372036854775808"])(
    "rejects invalid positive bigint amount %s",
    (amountMinor) => {
      expect(() =>
        revenueInputSchema.parse({
          leadId: LEAD_ID,
          amountMinor,
          currency: "USD",
          confirmedAt: "2026-08-12",
        }),
      ).toThrow();
    },
  );

  it("rejects invalid ISO 4217 currency codes", () => {
    for (const currency of ["US", "usd", "ZZZ"]) {
      expect(() =>
        revenueInputSchema.parse({
          leadId: LEAD_ID,
          amountMinor: "100",
          currency,
          confirmedAt: "2026-08-12",
        }),
      ).toThrow();
    }
  });

  it("accepts the current XCG ISO 4217 currency code", () => {
    expect(
      revenueInputSchema.parse({
        leadId: LEAD_ID,
        amountMinor: "100",
        currency: "XCG",
        confirmedAt: "2026-08-12",
      }).currency,
    ).toBe("XCG");
  });

  it("rejects future confirmation dates", () => {
    expect(() =>
      revenueInputSchema.parse({
        leadId: LEAD_ID,
        amountMinor: "100",
        currency: "USD",
        confirmedAt: "2999-01-01",
      }),
    ).toThrow();
  });

  it("converts major currency input only when it has at most two decimals", () => {
    expect(majorAmountToMinor("3500.00")).toBe("350000");
    expect(majorAmountToMinor("0.01")).toBe("1");
    expect(() => majorAmountToMinor("1.001")).toThrow();
  });

  it("requires a trimmed 10-500 character reopen reason", () => {
    expect(
      reopenLeadInputSchema.parse({ leadId: LEAD_ID, reason: "  Customer called us back.  " }),
    ).toEqual({ leadId: LEAD_ID, reason: "Customer called us back." });
    expect(() => reopenLeadInputSchema.parse({ leadId: LEAD_ID, reason: "too short" })).toThrow();
    expect(() =>
      reopenLeadInputSchema.parse({ leadId: LEAD_ID, reason: "x".repeat(501) }),
    ).toThrow();
  });
});

describe("lead server boundary", () => {
  beforeEach(() => {
    process.env.FIELD_ENCRYPTION_KEY_V1 = FIELD_KEY;
    process.env.LOOKUP_HMAC_KEY_V1 = LOOKUP_KEY;
  });

  afterEach(() => {
    delete process.env.FIELD_ENCRYPTION_KEY_V1;
    delete process.env.LOOKUP_HMAC_KEY_V1;
  });

  it("starts list reads with tenant context and decrypts only returned page rows", async () => {
    const sequence: string[] = [];
    const loadPage = vi.fn().mockImplementation(async () => {
      sequence.push("query");
      return { rows: [encryptedRow], hasMore: false };
    });
    const decrypt = vi.fn(
      (value: string) =>
        ({
          "encrypted-name": "Test Lead",
          "encrypted-email": "lead@example.com",
          "encrypted-company": "Example Co",
        })[value] ?? value,
    );

    const page = await listLeadsWith(
      { limit: 25, exactEmail: "LEAD@example.com" },
      {
        requireTenant: vi.fn().mockImplementation(async () => {
          sequence.push("context");
          return { tenantId: TENANT_ID };
        }),
        loadPage,
        decrypt,
        hashLookup: vi.fn().mockReturnValue("email-hash"),
      },
    );

    expect(sequence).toEqual(["context", "query"]);
    expect(loadPage).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT_ID,
        restrictedOnly: true,
        exactEmailHash: "email-hash",
      }),
    );
    expect(decrypt).toHaveBeenCalledTimes(3);
    expect(page.items[0]).toMatchObject({
      id: LEAD_ID,
      name: "Test Lead",
      email: "lead@example.com",
      company: "Example Co",
    });
    expect(JSON.stringify(page)).not.toMatch(/ciphertext|lookup_hash|email-hash/);
  });

  it("does not decrypt non-returned leads to search exact email or phone", async () => {
    const decrypt = vi.fn();
    const hashLookup = vi.fn().mockReturnValueOnce("email-hash").mockReturnValueOnce("phone-hash");

    await listLeadsWith(
      { limit: 25, exactEmail: "lead@example.com", exactPhone: "+1 (555) 010-0100" },
      {
        requireTenant: vi.fn().mockResolvedValue({ tenantId: TENANT_ID }),
        loadPage: vi.fn().mockResolvedValue({ rows: [], hasMore: false }),
        decrypt,
        hashLookup,
      },
    );

    expect(hashLookup).toHaveBeenNthCalledWith(1, "lead@example.com", "email");
    expect(hashLookup).toHaveBeenNthCalledWith(2, "+1 (555) 010-0100", "phone");
    expect(decrypt).not.toHaveBeenCalled();
  });

  it("uses the strongest returned attribution confidence deterministically", async () => {
    const page = await listLeadsWith(
      { limit: 25 },
      {
        requireTenant: vi.fn().mockResolvedValue({ tenantId: TENANT_ID }),
        loadPage: vi.fn().mockResolvedValue({
          rows: [
            {
              ...encryptedRow,
              attribution_touches: [{ confidence: "low" }, { confidence: "high" }],
            },
          ],
          hasMore: false,
        }),
        decrypt: vi.fn((value: string) => value),
        hashLookup: vi.fn(),
      },
    );

    expect(page.items[0]?.confidence).toBe("high");
  });

  it("makes wrong-tenant and unknown lead ids indistinguishable", async () => {
    for (const reason of ["wrong tenant", "unknown uuid"]) {
      await expect(
        getLeadWith(
          { leadId: LEAD_ID },
          {
            requireTenant: vi.fn().mockResolvedValue({ tenantId: TENANT_ID }),
            loadDetail: vi.fn().mockResolvedValue(null),
            decrypt: vi.fn(),
          },
        ),
        reason,
      ).rejects.toEqual(new LeadNotFoundError());
    }
  });

  it("returns only the typed consent receipt and lead-specific audit chronology", async () => {
    const detail = await getLeadWith(
      { leadId: LEAD_ID },
      {
        requireTenant: vi.fn().mockResolvedValue({ tenantId: TENANT_ID }),
        loadDetail: vi.fn().mockResolvedValue({
          lead: {
            ...encryptedRow,
            phone_ciphertext: null,
            notes_ciphertext: "encrypted-notes",
            budget_range: "5k-10k",
            timeline_range: "1-2-months",
          },
          touches: [],
          consent: {
            policy_version: consent.policy_version,
            source: consent.source,
            recorded_at: consent.recorded_at,
            categories: {
              necessary: true,
              analytics: false,
              marketing: false,
              preferences: false,
              contact_requested: true,
              gpc: false,
              raw_provider_metadata: "must-not-escape",
            },
          },
          audit: [
            {
              action: "lead.status_changed",
              created_at: "2026-08-10T16:00:00.000Z",
              metadata: {
                previous_status: "new",
                current_status: "qualified",
                unrelated_internal_value: "must-not-escape",
              },
            },
          ],
          revenue: null,
        }),
        decrypt: vi.fn(
          (value: string) =>
            ({
              "encrypted-name": "Test Lead",
              "encrypted-email": "lead@example.com",
              "encrypted-company": "Example Co",
              "encrypted-notes": "Needs a follow-up call.",
            })[value] ?? value,
        ),
      },
    );

    expect(detail.consent).toEqual(consent);
    expect(detail.audit).toEqual([
      {
        action: "lead.status_changed",
        createdAt: "2026-08-10T16:00:00.000Z",
        previousStatus: "new",
        currentStatus: "qualified",
      },
    ]);
    expect(JSON.stringify(detail)).not.toMatch(
      /ciphertext|lookup_hash|raw_provider_metadata|unrelated_internal_value/,
    );
  });

  it("allows a won transition without inventing revenue", async () => {
    const updateStatus = vi.fn().mockResolvedValue({ status: "won" });
    await expect(
      changeLeadStatusWith(
        { leadId: LEAD_ID, to: "won" },
        {
          requireOwner: vi.fn().mockResolvedValue({ tenantId: TENANT_ID, userId: USER_ID }),
          updateStatus,
          requestId: () => REQUEST_ID,
        },
      ),
    ).resolves.toEqual({ status: "won" });

    expect(updateStatus).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      leadId: LEAD_ID,
      to: "won",
      requestId: REQUEST_ID,
    });
    expect(JSON.stringify(updateStatus.mock.calls)).not.toMatch(/revenue|amount|note/i);
  });

  it("records revenue through one owner transaction and encrypts only the optional note", async () => {
    const recordRevenue = vi.fn().mockResolvedValue({
      amountMinor: "350000",
      currency: "USD",
      confirmedAt: "2026-08-12",
    });
    const encrypt = vi.fn().mockReturnValue("encrypted-revenue-note");

    await expect(
      recordRevenueWith(
        {
          leadId: LEAD_ID,
          amountMinor: "350000",
          currency: "USD",
          confirmedAt: "2026-08-12",
          note: "Client confirmed the signed agreement.",
        },
        {
          requireOwner: vi.fn().mockResolvedValue({ tenantId: TENANT_ID, userId: USER_ID }),
          recordRevenue,
          encrypt,
          requestId: () => REQUEST_ID,
          now: () => NOW,
        },
      ),
    ).resolves.toMatchObject({ amountMinor: "350000", currency: "USD" });

    expect(encrypt).toHaveBeenCalledWith("Client confirmed the signed agreement.", "lead");
    expect(recordRevenue).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      leadId: LEAD_ID,
      amountMinor: "350000",
      currency: "USD",
      confirmedAt: "2026-08-12",
      noteCiphertext: "encrypted-revenue-note",
      requestId: REQUEST_ID,
    });
  });

  it("maps non-won, unknown, and wrong-tenant revenue targets to LEAD_NOT_FOUND", async () => {
    for (const reason of ["not won", "unknown", "wrong tenant"]) {
      await expect(
        recordRevenueWith(
          {
            leadId: LEAD_ID,
            amountMinor: "100",
            currency: "USD",
            confirmedAt: "2026-08-12",
          },
          {
            requireOwner: vi.fn().mockResolvedValue({ tenantId: TENANT_ID, userId: USER_ID }),
            recordRevenue: vi.fn().mockResolvedValue(null),
            encrypt: vi.fn(),
            requestId: () => REQUEST_ID,
            now: () => NOW,
          },
        ),
        reason,
      ).rejects.toMatchObject({ code: "LEAD_NOT_FOUND" });
    }
  });

  it("reopens terminal leads through a separate audited owner action", async () => {
    const reopenLead = vi.fn().mockResolvedValue({ status: "qualified" });
    await expect(
      reopenLeadWith(
        { leadId: LEAD_ID, reason: "Customer restarted the project discussion." },
        {
          requireOwner: vi.fn().mockResolvedValue({ tenantId: TENANT_ID, userId: USER_ID }),
          reopenLead,
          requestId: () => REQUEST_ID,
        },
      ),
    ).resolves.toEqual({ status: "qualified" });

    expect(reopenLead).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      leadId: LEAD_ID,
      reason: "Customer restarted the project discussion.",
      requestId: REQUEST_ID,
    });
  });

  it("does not invoke a mutation when owner context rejects support", async () => {
    const updateStatus = vi.fn();
    await expect(
      changeLeadStatusWith(
        { leadId: LEAD_ID, to: "qualified" },
        {
          requireOwner: vi.fn().mockRejectedValue(new Error("SUPPORT_READ_ONLY")),
          updateStatus,
          requestId: vi.fn(),
        },
      ),
    ).rejects.toThrow("SUPPORT_READ_ONLY");
    expect(updateStatus).not.toHaveBeenCalled();
  });
});
