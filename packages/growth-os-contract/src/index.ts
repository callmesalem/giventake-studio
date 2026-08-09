import { z } from "zod";

const nullableShort = z.string().trim().min(1).max(200).nullable();
const isoDate = z.string().datetime({ offset: true });

export const consentReceiptV1Schema = z
  .object({
    policy_version: z.string().trim().min(1).max(80),
    source: z.literal("contact-form"),
    necessary: z.literal(true),
    analytics: z.boolean(),
    marketing: z.boolean(),
    preferences: z.boolean(),
    contact_requested: z.literal(true),
    gpc: z.boolean(),
    recorded_at: isoDate,
  })
  .strict();

export const leadEventV1Schema = z
  .object({
    schema_version: z.literal(1),
    event_id: z.string().uuid(),
    occurred_at: isoDate,
    lead: z
      .object({
        name: z.string().trim().min(1).max(100),
        email: z.string().trim().email().max(255),
        company: z.string().trim().min(1).max(120).nullable(),
        phone: z.string().trim().min(7).max(32).nullable(),
        notes: z.string().trim().min(10).max(1500),
        budget_range: z.string().trim().min(1).max(80),
        timeline_range: z.string().trim().min(1).max(80),
      })
      .strict(),
    attribution: z
      .object({
        declared_source: z.string().trim().min(1).max(80),
        source_detail: nullableShort,
        landing_page: z.string().url().max(500),
        offer_id: z.string().trim().min(1).max(100),
        utm_source: nullableShort,
        utm_medium: nullableShort,
        utm_campaign: nullableShort,
        utm_content: nullableShort,
        utm_term: nullableShort,
        referrer_domain: nullableShort,
        click_ids: z
          .object({
            gclid: nullableShort.optional(),
            gbraid: nullableShort.optional(),
            wbraid: nullableShort.optional(),
            fbclid: nullableShort.optional(),
          })
          .strict(),
      })
      .strict(),
    consent: consentReceiptV1Schema,
  })
  .strict();

export type ConsentReceiptV1 = z.infer<typeof consentReceiptV1Schema>;
export type LeadEventV1 = z.infer<typeof leadEventV1Schema>;
export type LeadEventAck = { status: "accepted" | "duplicate"; lead_id: string };
