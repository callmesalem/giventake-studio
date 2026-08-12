import { createHmac } from "node:crypto";
import type { LeadEventV1 } from "@giventake/growth-os-contract";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IngestBoundaryError, handleIngestRequestWith, ingestLeadWith } from "./ingest.server";

const TENANT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const SITE_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const LEAD_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const REQUEST_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const EVENT_ID = "7e9f26af-2501-4d7c-bd8f-9a3c56bc8bd4";
const KEY_ID = "site-key-test-1";
const SECRET = "test-signing-secret-with-32-bytes-minimum";
const NOW = new Date("2026-08-09T16:00:00.000Z");
const FIELD_KEY = Buffer.alloc(32, 7).toString("base64");
const LOOKUP_KEY = Buffer.alloc(32, 11).toString("base64");

const baseEvent: LeadEventV1 = {
  schema_version: 1,
  event_id: EVENT_ID,
  occurred_at: NOW.toISOString(),
  lead: {
    name: "Test Lead",
    email: "lead@example.com",
    company: "Example Service",
    phone: null,
    notes: "Needs a privacy-safe intake website.",
    budget_range: "5k-10k",
    timeline_range: "1-2-months",
  },
  attribution: {
    declared_source: "google",
    source_detail: null,
    landing_page: "https://giventakedevs.com/contact?gclid=not-stored#form",
    offer_id: "project-brief",
    utm_source: "google",
    utm_medium: "cpc",
    utm_campaign: "launch",
    utm_content: null,
    utm_term: null,
    referrer_domain: "google.com",
    click_ids: { gclid: "safe-click-id" },
  },
  consent: {
    policy_version: "privacy-2026-08-08",
    source: "contact-form",
    necessary: true,
    analytics: false,
    marketing: false,
    preferences: false,
    contact_requested: true,
    gpc: false,
    recorded_at: NOW.toISOString(),
  },
};

const site = {
  id: SITE_ID,
  tenantId: TENANT_ID,
  enabled: true,
  rateLimitPerMinute: 120,
  signingSecretCiphertext: "v1.encrypted.site.secret",
};

describe("ingestLeadWith", () => {
  beforeEach(() => {
    process.env.FIELD_ENCRYPTION_KEY_V1 = FIELD_KEY;
    process.env.LOOKUP_HMAC_KEY_V1 = LOOKUP_KEY;
  });

  afterEach(() => {
    delete process.env.FIELD_ENCRYPTION_KEY_V1;
    delete process.env.LOOKUP_HMAC_KEY_V1;
  });

  it("encrypts personal fields and clears click ids when marketing is false", async () => {
    const persistAtomic = vi.fn().mockResolvedValue({ status: "accepted", lead_id: LEAD_ID });

    await expect(
      ingestLeadWith(
        KEY_ID,
        baseEvent,
        {
          idempotencyKey: EVENT_ID,
          bodyDigest: "a".repeat(64),
          requestId: REQUEST_ID,
        },
        {
          findSite: vi.fn().mockResolvedValue(site),
          persistAtomic,
        },
      ),
    ).resolves.toEqual({ status: "accepted", lead_id: LEAD_ID });

    const transaction = persistAtomic.mock.calls[0]![0];
    expect(transaction).toMatchObject({
      tenantId: TENANT_ID,
      siteId: SITE_ID,
      eventId: EVENT_ID,
      idempotencyKey: EVENT_ID,
      bodyDigest: "a".repeat(64),
      requestId: REQUEST_ID,
      attribution: {
        landingOrigin: "https://giventakedevs.com",
        landingPath: "/contact",
        referrerDomain: "google.com",
        clickIds: {},
      },
      consent: {
        necessary: true,
        analytics: false,
        marketing: false,
        preferences: false,
        contactRequested: true,
        gpc: false,
      },
    });
    expect(transaction.lead.nameCiphertext).not.toContain("Test Lead");
    expect(transaction.lead.emailCiphertext).not.toContain("lead@example.com");
    expect(transaction.lead.notesCiphertext).not.toContain("privacy-safe");
    expect(JSON.stringify(transaction.attribution)).not.toContain("lead@example.com");
  });

  it("forces marketing false and clears click ids under GPC", async () => {
    const persistAtomic = vi.fn().mockResolvedValue({ status: "accepted", lead_id: LEAD_ID });
    const event = {
      ...baseEvent,
      consent: { ...baseEvent.consent, marketing: true, gpc: true },
    };

    await ingestLeadWith(
      KEY_ID,
      event,
      { idempotencyKey: EVENT_ID, bodyDigest: "b".repeat(64), requestId: REQUEST_ID },
      { findSite: vi.fn().mockResolvedValue(site), persistAtomic },
    );

    expect(persistAtomic.mock.calls[0]![0].consent.marketing).toBe(false);
    expect(persistAtomic.mock.calls[0]![0].attribution.clickIds).toEqual({});
  });

  it("returns the atomic duplicate result without creating another lead", async () => {
    await expect(
      ingestLeadWith(
        KEY_ID,
        baseEvent,
        { idempotencyKey: EVENT_ID, bodyDigest: "c".repeat(64), requestId: REQUEST_ID },
        {
          findSite: vi.fn().mockResolvedValue(site),
          persistAtomic: vi.fn().mockResolvedValue({ status: "duplicate", lead_id: LEAD_ID }),
        },
      ),
    ).resolves.toEqual({ status: "duplicate", lead_id: LEAD_ID });
  });

  it.each([
    ["unknown", null],
    ["disabled", { ...site, enabled: false }],
  ])("does not distinguish an %s site key", async (_name, resolvedSite) => {
    await expect(
      ingestLeadWith(
        KEY_ID,
        baseEvent,
        { idempotencyKey: EVENT_ID, bodyDigest: "d".repeat(64), requestId: REQUEST_ID },
        {
          findSite: vi.fn().mockResolvedValue(resolvedSite),
          persistAtomic: vi.fn(),
        },
      ),
    ).rejects.toMatchObject({ code: "AUTHENTICATION_FAILED" });
  });
});

function sign(body: string, timestamp: string, idempotencyKey = EVENT_ID) {
  return `sha256=${createHmac("sha256", SECRET)
    .update(`${timestamp}\n${idempotencyKey}\n${body}`, "utf8")
    .digest("hex")}`;
}

function signBytes(body: Uint8Array, timestamp: string, idempotencyKey = EVENT_ID) {
  return `sha256=${createHmac("sha256", SECRET)
    .update(`${timestamp}\n${idempotencyKey}\n`, "utf8")
    .update(body)
    .digest("hex")}`;
}

function requestFor(
  body: string,
  overrides: Partial<Record<"keyId" | "timestamp" | "idempotencyKey" | "signature", string>> = {},
) {
  const timestamp = overrides.timestamp ?? NOW.toISOString();
  const idempotencyKey = overrides.idempotencyKey ?? EVENT_ID;
  return new Request("https://app.giventakedevs.com/api/ingest/v1/leads", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GT-Key-Id": overrides.keyId ?? KEY_ID,
      "X-GT-Timestamp": timestamp,
      "X-GT-Idempotency-Key": idempotencyKey,
      "X-GT-Signature": overrides.signature ?? sign(body, timestamp, idempotencyKey),
    },
    body,
  });
}

function wireRequest(
  body: ReadableStream<Uint8Array>,
  bytes: Uint8Array,
  overrides: Partial<Record<"keyId" | "timestamp" | "idempotencyKey" | "signature", string>> = {},
) {
  const timestamp = overrides.timestamp ?? NOW.toISOString();
  const idempotencyKey = overrides.idempotencyKey ?? EVENT_ID;
  return new Request("https://app.giventakedevs.com/api/ingest/v1/leads", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GT-Key-Id": overrides.keyId ?? KEY_ID,
      "X-GT-Timestamp": timestamp,
      "X-GT-Idempotency-Key": idempotencyKey,
      "X-GT-Signature": overrides.signature ?? signBytes(bytes, timestamp, idempotencyKey),
    },
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

function streamFromBytes(bytes: Uint8Array) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

function httpDependencies(overrides: Partial<Parameters<typeof handleIngestRequestWith>[1]> = {}) {
  return {
    findSite: vi.fn().mockResolvedValue(site),
    consumeRateLimit: vi.fn().mockResolvedValue(true),
    decryptSigningSecret: vi.fn().mockReturnValue(SECRET),
    ingest: vi.fn().mockResolvedValue({ status: "accepted", lead_id: LEAD_ID }),
    now: () => NOW,
    requestId: () => REQUEST_ID,
    ...overrides,
  };
}

async function errorBody(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

describe("signed lead ingestion HTTP contract", () => {
  it("returns 202 for accepted and 200 for duplicate", async () => {
    const body = JSON.stringify(baseEvent);
    const accepted = await handleIngestRequestWith(requestFor(body), httpDependencies());
    const duplicate = await handleIngestRequestWith(
      requestFor(body),
      httpDependencies({
        ingest: vi.fn().mockResolvedValue({ status: "duplicate", lead_id: LEAD_ID }),
      }),
    );

    expect(accepted.status).toBe(202);
    expect(await accepted.json()).toEqual({ status: "accepted", lead_id: LEAD_ID });
    expect(duplicate.status).toBe(200);
    expect(await duplicate.json()).toEqual({ status: "duplicate", lead_id: LEAD_ID });
  });

  it("uses the exact raw body digest and site id without reading an IP", async () => {
    const body = `${JSON.stringify(baseEvent, null, 2)}\n`;
    const ingest = vi.fn().mockResolvedValue({ status: "accepted", lead_id: LEAD_ID });
    const consumeRateLimit = vi.fn().mockResolvedValue(true);

    await handleIngestRequestWith(
      requestFor(body, { keyId: KEY_ID }),
      httpDependencies({ ingest, consumeRateLimit }),
    );

    expect(consumeRateLimit).toHaveBeenCalledWith(SITE_ID, TENANT_ID, NOW);
    expect(ingest).toHaveBeenCalledWith(
      KEY_ID,
      expect.objectContaining({ event_id: EVENT_ID }),
      expect.objectContaining({
        idempotencyKey: EVENT_ID,
        bodyDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
        requestId: REQUEST_ID,
      }),
    );
    expect(JSON.stringify(consumeRateLimit.mock.calls)).not.toMatch(/ip|forwarded|device/i);
  });

  it.each([
    ["unknown", null],
    ["disabled", { ...site, enabled: false }],
  ])("returns the same 401 contract for an %s site", async (_name, resolvedSite) => {
    const body = JSON.stringify(baseEvent);
    const response = await handleIngestRequestWith(
      requestFor(body),
      httpDependencies({ findSite: vi.fn().mockResolvedValue(resolvedSite) }),
    );

    expect(response.status).toBe(401);
    expect(await errorBody(response)).toEqual({
      code: "AUTHENTICATION_FAILED",
      request_id: REQUEST_ID,
    });
  });

  it("returns 401 for a bad signature without echoing request input", async () => {
    const body = JSON.stringify(baseEvent);
    const response = await handleIngestRequestWith(
      requestFor(body, { signature: "sha256=deadbeef" }),
      httpDependencies(),
    );
    const error = await errorBody(response);

    expect(response.status).toBe(401);
    expect(error).toEqual({ code: "AUTHENTICATION_FAILED", request_id: REQUEST_ID });
    expect(JSON.stringify(error)).not.toContain(KEY_ID);
    expect(JSON.stringify(error)).not.toContain("lead@example.com");
  });

  it.each([
    ["a UTF-8 BOM", new Uint8Array([0xef, 0xbb, 0xbf, ...Buffer.from(JSON.stringify(baseEvent))])],
    ["malformed UTF-8", new Uint8Array([0x7b, 0x80, 0x7d])],
  ])("rejects signed wire bytes containing %s without normalization", async (_name, bytes) => {
    const response = await handleIngestRequestWith(
      wireRequest(streamFromBytes(bytes), bytes),
      httpDependencies(),
    );

    expect(response.status).toBe(400);
    expect(await errorBody(response)).toEqual({ code: "INVALID_PAYLOAD", request_id: REQUEST_ID });
  });

  it("stops a streaming body at the 32 KiB boundary before parsing", async () => {
    let pulls = 0;
    let cancelled = false;
    const chunks = [new Uint8Array(16_384), new Uint8Array(16_384), new Uint8Array([0])];
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        const chunk = chunks[pulls++];
        if (chunk) controller.enqueue(chunk);
        else controller.close();
      },
      cancel() {
        cancelled = true;
      },
    });
    const bytes = new Uint8Array(32_769);
    const response = await handleIngestRequestWith(wireRequest(stream, bytes), httpDependencies());

    expect(response.status).toBe(413);
    expect(await errorBody(response)).toEqual({
      code: "PAYLOAD_TOO_LARGE",
      request_id: REQUEST_ID,
    });
    expect(cancelled).toBe(true);
    expect(pulls).toBeLessThanOrEqual(3);
  });

  it("does not let invalid signatures consume a site's valid-request quota", async () => {
    const body = JSON.stringify(baseEvent);
    let validAttempts = 0;
    const consumeRateLimit = vi
      .fn()
      .mockImplementation(() => Promise.resolve(++validAttempts <= 120));
    const dependencies = httpDependencies({ consumeRateLimit });

    for (let index = 0; index < 121; index += 1) {
      const invalid = await handleIngestRequestWith(
        requestFor(body, { signature: "sha256=deadbeef" }),
        dependencies,
      );
      expect(invalid.status).toBe(401);
    }

    const valid = await handleIngestRequestWith(requestFor(body), dependencies);
    expect(valid.status).toBe(202);
    expect(consumeRateLimit).toHaveBeenCalledTimes(1);
  });

  it("returns 413 before parsing an oversized raw body", async () => {
    const response = await handleIngestRequestWith(
      requestFor("x".repeat(32_769)),
      httpDependencies(),
    );

    expect(response.status).toBe(413);
    expect(await errorBody(response)).toEqual({
      code: "PAYLOAD_TOO_LARGE",
      request_id: REQUEST_ID,
    });
  });

  it("returns 400 for strict schema failures after authenticating the raw body", async () => {
    const invalid = JSON.stringify({ ...baseEvent, ip: "203.0.113.5" });
    const response = await handleIngestRequestWith(requestFor(invalid), httpDependencies());

    expect(response.status).toBe(400);
    expect(await errorBody(response)).toEqual({ code: "INVALID_PAYLOAD", request_id: REQUEST_ID });
  });

  it("returns 409 for a conflicting reused idempotency key", async () => {
    const body = JSON.stringify(baseEvent);
    const response = await handleIngestRequestWith(
      requestFor(body),
      httpDependencies({
        ingest: vi.fn().mockRejectedValue(new IngestBoundaryError("IDEMPOTENCY_CONFLICT")),
      }),
    );

    expect(response.status).toBe(409);
    expect(await errorBody(response)).toEqual({
      code: "IDEMPOTENCY_CONFLICT",
      request_id: REQUEST_ID,
    });
  });

  it("returns 429 when the known site exhausts its rolling limit", async () => {
    const body = JSON.stringify(baseEvent);
    const response = await handleIngestRequestWith(
      requestFor(body),
      httpDependencies({ consumeRateLimit: vi.fn().mockResolvedValue(false) }),
    );

    expect(response.status).toBe(429);
    expect(await errorBody(response)).toEqual({ code: "RATE_LIMITED", request_id: REQUEST_ID });
  });

  it("enforces 429 only after 120 authenticated requests for the site", async () => {
    const body = JSON.stringify(baseEvent);
    let authenticatedAttempts = 0;
    const consumeRateLimit = vi
      .fn()
      .mockImplementation(() => Promise.resolve(++authenticatedAttempts <= 120));
    const dependencies = httpDependencies({ consumeRateLimit });

    for (let index = 0; index < 120; index += 1) {
      expect((await handleIngestRequestWith(requestFor(body), dependencies)).status).toBe(202);
    }
    expect((await handleIngestRequestWith(requestFor(body), dependencies)).status).toBe(429);
    expect(consumeRateLimit).toHaveBeenCalledTimes(121);
  });
});
