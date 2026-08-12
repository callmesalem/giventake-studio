import "@tanstack/react-start/server-only";
import { createHash, randomUUID } from "node:crypto";
import {
  leadEventV1Schema,
  type LeadEventAck,
  type LeadEventV1,
} from "@giventake/growth-os-contract";
import { z } from "zod";
import type { Json } from "@/lib/database.types";
import { decryptField, encryptField, lookupHash } from "@/lib/server/crypto.server";
import { createJobSupabase } from "@/lib/server/supabase.server";
import { IngestSignatureError, MAX_BODY_BYTES, verifyIngestSignature } from "./signature.server";

type IngestErrorCode =
  | "AUTHENTICATION_FAILED"
  | "IDEMPOTENCY_CONFLICT"
  | "INGEST_UNAVAILABLE"
  | "INVALID_PAYLOAD"
  | "PAYLOAD_TOO_LARGE"
  | "RATE_LIMITED";

export class IngestBoundaryError extends Error {
  constructor(public readonly code: IngestErrorCode) {
    super(code);
    this.name = "IngestBoundaryError";
  }
}

export type IngestSite = {
  id: string;
  tenantId: string;
  enabled: boolean;
  rateLimitPerMinute: number;
  signingSecretCiphertext: string;
};

type AtomicLeadInput = {
  tenantId: string;
  siteId: string;
  eventId: string;
  occurredAt: string;
  idempotencyKey: string;
  bodyDigest: string;
  requestId: string;
  lead: {
    nameCiphertext: string;
    emailCiphertext: string;
    emailLookupHash: string;
    phoneCiphertext: string | null;
    phoneLookupHash: string | null;
    companyCiphertext: string | null;
    notesCiphertext: string;
    budgetRange: string;
    timelineRange: string;
  };
  attribution: {
    declaredSource: string;
    sourceDetail: string | null;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    utmContent: string | null;
    utmTerm: string | null;
    referrerDomain: string | null;
    clickIds: LeadEventV1["attribution"]["click_ids"];
    landingOrigin: string;
    landingPath: string;
    offerId: string;
  };
  consent: {
    policyVersion: string;
    source: "contact-form";
    necessary: true;
    analytics: boolean;
    marketing: boolean;
    preferences: boolean;
    contactRequested: true;
    gpc: boolean;
    recordedAt: string;
  };
};

type IngestLeadContext = {
  idempotencyKey: string;
  bodyDigest: string;
  requestId: string;
};

type IngestLeadDependencies = {
  findSite: (siteKeyId: string) => Promise<IngestSite | null>;
  persistAtomic: (input: AtomicLeadInput) => Promise<LeadEventAck>;
};

const ackSchema = z
  .object({
    status: z.enum(["accepted", "duplicate"]),
    lead_id: z.string().uuid(),
  })
  .strict();

function nullableEncrypted(value: string | null, purpose: "lead") {
  return value === null ? null : encryptField(value, purpose);
}

function sanitizeReferrerDomain(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(`https://${value}`).hostname.slice(0, 200) || null;
  } catch {
    return null;
  }
}

export async function ingestLeadWith(
  siteKeyId: string,
  eventInput: LeadEventV1,
  context: IngestLeadContext,
  dependencies: IngestLeadDependencies,
): Promise<LeadEventAck> {
  const event = leadEventV1Schema.parse(eventInput);
  const site = await dependencies.findSite(siteKeyId);
  if (!site?.enabled) throw new IngestBoundaryError("AUTHENTICATION_FAILED");

  let landing: URL;
  try {
    landing = new URL(event.attribution.landing_page);
  } catch {
    throw new IngestBoundaryError("INVALID_PAYLOAD");
  }
  if (landing.protocol !== "https:") throw new IngestBoundaryError("INVALID_PAYLOAD");

  const marketing = event.consent.marketing && !event.consent.gpc;
  const clickIds = marketing ? event.attribution.click_ids : {};
  return dependencies.persistAtomic({
    tenantId: site.tenantId,
    siteId: site.id,
    eventId: event.event_id,
    occurredAt: event.occurred_at,
    idempotencyKey: context.idempotencyKey,
    bodyDigest: context.bodyDigest,
    requestId: context.requestId,
    lead: {
      nameCiphertext: encryptField(event.lead.name, "lead"),
      emailCiphertext: encryptField(event.lead.email, "lead"),
      emailLookupHash: lookupHash(event.lead.email, "email"),
      phoneCiphertext: nullableEncrypted(event.lead.phone, "lead"),
      phoneLookupHash: event.lead.phone ? lookupHash(event.lead.phone, "phone") : null,
      companyCiphertext: nullableEncrypted(event.lead.company, "lead"),
      notesCiphertext: encryptField(event.lead.notes, "lead"),
      budgetRange: event.lead.budget_range,
      timelineRange: event.lead.timeline_range,
    },
    attribution: {
      declaredSource: event.attribution.declared_source,
      sourceDetail: event.attribution.source_detail,
      utmSource: event.attribution.utm_source,
      utmMedium: event.attribution.utm_medium,
      utmCampaign: event.attribution.utm_campaign,
      utmContent: event.attribution.utm_content,
      utmTerm: event.attribution.utm_term,
      referrerDomain: sanitizeReferrerDomain(event.attribution.referrer_domain),
      clickIds,
      landingOrigin: landing.origin,
      landingPath: landing.pathname,
      offerId: event.attribution.offer_id,
    },
    consent: {
      policyVersion: event.consent.policy_version,
      source: event.consent.source,
      necessary: true,
      analytics: event.consent.analytics,
      marketing,
      preferences: event.consent.preferences,
      contactRequested: true,
      gpc: event.consent.gpc,
      recordedAt: event.consent.recorded_at,
    },
  });
}

async function findIngestSite(siteKeyId: string): Promise<IngestSite | null> {
  const { data, error } = await createJobSupabase()
    .from("sites")
    .select("id, tenant_id, enabled, rate_limit_per_minute, signing_secret_ciphertext")
    .eq("key_id", siteKeyId)
    .maybeSingle();
  if (error) throw new IngestBoundaryError("INGEST_UNAVAILABLE");
  if (!data) return null;
  return {
    id: data.id,
    tenantId: data.tenant_id,
    enabled: data.enabled,
    rateLimitPerMinute: data.rate_limit_per_minute,
    signingSecretCiphertext: data.signing_secret_ciphertext,
  };
}

async function persistAtomicLead(input: AtomicLeadInput): Promise<LeadEventAck> {
  const { data, error } = await createJobSupabase().rpc("ingest_website_lead", {
    target_tenant: input.tenantId,
    target_site: input.siteId,
    request_idempotency_key: input.idempotencyKey,
    request_body_digest: input.bodyDigest,
    external_event: input.eventId,
    event_occurred_at: input.occurredAt,
    encrypted_lead: {
      name_ciphertext: input.lead.nameCiphertext,
      email_ciphertext: input.lead.emailCiphertext,
      email_lookup_hash: input.lead.emailLookupHash,
      phone_ciphertext: input.lead.phoneCiphertext,
      phone_lookup_hash: input.lead.phoneLookupHash,
      company_ciphertext: input.lead.companyCiphertext,
      notes_ciphertext: input.lead.notesCiphertext,
      budget_range: input.lead.budgetRange,
      timeline_range: input.lead.timelineRange,
    } as Json,
    attribution: {
      declared_source: input.attribution.declaredSource,
      source_detail: input.attribution.sourceDetail,
      utm_source: input.attribution.utmSource,
      utm_medium: input.attribution.utmMedium,
      utm_campaign: input.attribution.utmCampaign,
      utm_content: input.attribution.utmContent,
      utm_term: input.attribution.utmTerm,
      referrer_domain: input.attribution.referrerDomain,
      click_ids: input.attribution.clickIds,
      landing_origin: input.attribution.landingOrigin,
      landing_path: input.attribution.landingPath,
      offer_id: input.attribution.offerId,
    } as Json,
    consent: {
      policy_version: input.consent.policyVersion,
      source: input.consent.source,
      necessary: input.consent.necessary,
      analytics: input.consent.analytics,
      marketing: input.consent.marketing,
      preferences: input.consent.preferences,
      contact_requested: input.consent.contactRequested,
      gpc: input.consent.gpc,
      recorded_at: input.consent.recordedAt,
    } as Json,
    event_request_id: input.requestId,
  });

  if (error) {
    if (error.code === "23505" || error.message.includes("IDEMPOTENCY_CONFLICT")) {
      throw new IngestBoundaryError("IDEMPOTENCY_CONFLICT");
    }
    throw new IngestBoundaryError("INGEST_UNAVAILABLE");
  }
  const parsed = ackSchema.safeParse(data);
  if (!parsed.success) throw new IngestBoundaryError("INGEST_UNAVAILABLE");
  return parsed.data;
}

export async function ingestLead(
  siteKeyId: string,
  event: LeadEventV1,
  context: IngestLeadContext = {
    idempotencyKey: event.event_id,
    bodyDigest: createHash("sha256").update(JSON.stringify(event), "utf8").digest("hex"),
    requestId: randomUUID(),
  },
): Promise<LeadEventAck> {
  return ingestLeadWith(siteKeyId, event, context, {
    findSite: findIngestSite,
    persistAtomic: persistAtomicLead,
  });
}

type HttpDependencies = {
  findSite: (siteKeyId: string) => Promise<IngestSite | null>;
  consumeRateLimit: (siteId: string, tenantId: string, now: Date) => Promise<boolean>;
  decryptSigningSecret: (ciphertext: string) => string;
  ingest: (
    siteKeyId: string,
    event: LeadEventV1,
    context: IngestLeadContext,
  ) => Promise<LeadEventAck>;
  now: () => Date;
  requestId: () => string;
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function errorResponse(code: IngestErrorCode, requestId: string, status: number) {
  return jsonResponse({ code, request_id: requestId }, status);
}

async function readBoundedRawBody(request: Request): Promise<Uint8Array> {
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new IngestSignatureError("PAYLOAD_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const rawBody = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    rawBody.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return rawBody;
}

function parseUtf8Json(rawBody: Uint8Array): unknown {
  if (rawBody[0] === 0xef && rawBody[1] === 0xbb && rawBody[2] === 0xbf) {
    throw new IngestBoundaryError("INVALID_PAYLOAD");
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(rawBody));
  } catch {
    throw new IngestBoundaryError("INVALID_PAYLOAD");
  }
}

export async function handleIngestRequestWith(
  request: Request,
  dependencies: HttpDependencies,
): Promise<Response> {
  const requestId = dependencies.requestId();
  try {
    let rawBody: Uint8Array;
    try {
      rawBody = await readBoundedRawBody(request);
    } catch (error) {
      if (error instanceof IngestSignatureError && error.code === "PAYLOAD_TOO_LARGE") {
        return errorResponse("PAYLOAD_TOO_LARGE", requestId, 413);
      }
      return errorResponse("INVALID_PAYLOAD", requestId, 400);
    }

    const siteKeyId = request.headers.get("X-GT-Key-Id") ?? "";
    const timestamp = request.headers.get("X-GT-Timestamp") ?? "";
    const idempotencyKey = request.headers.get("X-GT-Idempotency-Key") ?? "";
    const signature = request.headers.get("X-GT-Signature") ?? "";
    if (!siteKeyId || !timestamp || !idempotencyKey || !signature) {
      return errorResponse("AUTHENTICATION_FAILED", requestId, 401);
    }

    const site = await dependencies.findSite(siteKeyId);
    if (!site?.enabled) return errorResponse("AUTHENTICATION_FAILED", requestId, 401);
    const now = dependencies.now();

    try {
      verifyIngestSignature({
        body: rawBody,
        timestamp,
        idempotencyKey,
        presentedSignature: signature,
        secret: dependencies.decryptSigningSecret(site.signingSecretCiphertext),
        now,
      });
    } catch (error) {
      if (error instanceof IngestSignatureError && error.code === "PAYLOAD_TOO_LARGE") {
        return errorResponse("PAYLOAD_TOO_LARGE", requestId, 413);
      }
      return errorResponse("AUTHENTICATION_FAILED", requestId, 401);
    }

    if (!(await dependencies.consumeRateLimit(site.id, site.tenantId, now))) {
      return errorResponse("RATE_LIMITED", requestId, 429);
    }

    const unknownPayload = parseUtf8Json(rawBody);
    const parsed = leadEventV1Schema.safeParse(unknownPayload);
    if (!parsed.success || parsed.data.event_id !== idempotencyKey) {
      return errorResponse("INVALID_PAYLOAD", requestId, 400);
    }

    const acknowledgment = await dependencies.ingest(siteKeyId, parsed.data, {
      idempotencyKey,
      bodyDigest: createHash("sha256").update(rawBody).digest("hex"),
      requestId,
    });
    return jsonResponse(acknowledgment, acknowledgment.status === "accepted" ? 202 : 200);
  } catch (error) {
    if (error instanceof IngestBoundaryError) {
      if (error.code === "IDEMPOTENCY_CONFLICT") {
        return errorResponse(error.code, requestId, 409);
      }
      if (error.code === "AUTHENTICATION_FAILED") {
        return errorResponse(error.code, requestId, 401);
      }
      if (error.code === "INVALID_PAYLOAD") {
        return errorResponse(error.code, requestId, 400);
      }
    }
    return errorResponse("INGEST_UNAVAILABLE", requestId, 503);
  }
}

async function consumeRateLimit(siteId: string, tenantId: string, now: Date) {
  const { data, error } = await createJobSupabase().rpc("consume_site_ingest_rate_limit", {
    target_site: siteId,
    target_tenant: tenantId,
    attempt_time: now.toISOString(),
  });
  if (error) throw new IngestBoundaryError("INGEST_UNAVAILABLE");
  return data;
}

export async function handleIngestRequest(request: Request): Promise<Response> {
  return handleIngestRequestWith(request, {
    findSite: findIngestSite,
    consumeRateLimit,
    decryptSigningSecret: (ciphertext) => decryptField(ciphertext, "connector"),
    ingest: ingestLead,
    now: () => new Date(),
    requestId: randomUUID,
  });
}
