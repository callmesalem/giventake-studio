import "@tanstack/react-start/server-only";
import { randomUUID, webcrypto } from "node:crypto";
import { leadEventV1Schema, type LeadEventV1 } from "@giventake/growth-os-contract";
import type { ContactInput } from "./intake-schema";

type BuildLeadEventOptions = {
  eventId?: string;
  now?: Date;
};

const encoder = new TextEncoder();

function nullable(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function referrerHostname(referrer: string | undefined): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname || null;
  } catch {
    return null;
  }
}

function safeLandingPage(value: string) {
  const landing = new URL(value);
  if (landing.protocol !== "https:") throw new Error("Growth OS landing page must use HTTPS");
  return `${landing.origin}${landing.pathname}`;
}

function allowedClickIds(input: ContactInput) {
  const clickIds: LeadEventV1["attribution"]["click_ids"] = {};
  for (const key of ["gclid", "gbraid", "wbraid", "fbclid"] as const) {
    const value = nullable(input[key]);
    if (value) clickIds[key] = value;
  }
  return clickIds;
}

export function buildGrowthOsLeadEvent(
  input: ContactInput,
  options: BuildLeadEventOptions = {},
): LeadEventV1 {
  const now = options.now ?? new Date();
  const marketing = input.consent_receipt.marketing && !input.consent_receipt.gpc;
  return leadEventV1Schema.parse({
    schema_version: 1,
    event_id: options.eventId ?? randomUUID(),
    occurred_at: now.toISOString(),
    lead: {
      name: input.name,
      email: input.email,
      company: nullable(input.company),
      phone: null,
      notes: input.description,
      budget_range: input.budget,
      timeline_range: input.timeline,
    },
    attribution: {
      declared_source: input.source,
      source_detail: nullable(input.source_detail),
      landing_page: safeLandingPage(input.landing_page),
      offer_id: "project-brief",
      utm_source: nullable(input.utm_source),
      utm_medium: nullable(input.utm_medium),
      utm_campaign: nullable(input.utm_campaign),
      utm_content: nullable(input.utm_content),
      utm_term: nullable(input.utm_term),
      referrer_domain: referrerHostname(input.referrer),
      click_ids: marketing ? allowedClickIds(input) : {},
    },
    consent: {
      ...input.consent_receipt,
      marketing,
    },
  });
}

function env(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value || undefined;
}

async function signRawBody(secret: string, message: string) {
  const key = await webcrypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = Buffer.from(await webcrypto.subtle.sign("HMAC", key, encoder.encode(message)));
  return `sha256=${digest.toString("hex")}`;
}

export async function deliverLeadToGrowthOs(
  event: LeadEventV1,
): Promise<"accepted" | "duplicate" | "unconfigured"> {
  const url = env("GROWTH_OS_INGEST_URL");
  const siteKeyId = env("GROWTH_OS_SITE_KEY_ID");
  const secret = env("GROWTH_OS_SITE_SIGNING_SECRET");
  if (!url || !siteKeyId || !secret) return "unconfigured";
  if (Buffer.byteLength(secret, "utf8") < 32) throw new Error("Growth OS signing is unavailable");

  const parsed = leadEventV1Schema.parse(event);
  const rawBody = JSON.stringify(parsed);
  const timestamp = new Date().toISOString();
  const idempotencyKey = parsed.event_id;
  const signature = await signRawBody(secret, `${timestamp}\n${idempotencyKey}\n${rawBody}`);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GT-Key-Id": siteKeyId,
      "X-GT-Timestamp": timestamp,
      "X-GT-Idempotency-Key": idempotencyKey,
      "X-GT-Signature": signature,
    },
    body: rawBody,
  });

  if (response.status === 202) return "accepted";
  if (response.status === 200) return "duplicate";
  throw new Error(`Growth OS delivery failed with status ${response.status}`);
}
