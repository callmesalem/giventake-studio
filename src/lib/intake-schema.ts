import { z } from "zod";
import {
  CONTACT_BUDGET_VALUES,
  CONTACT_SOURCE_VALUES,
  CONTACT_TIMELINE_VALUES,
} from "./contact-options";

export {
  CONTACT_BUDGET_OPTIONS,
  CONTACT_SOURCE_OPTIONS,
  CONTACT_TIMELINE_OPTIONS,
} from "./contact-options";

/**
 * Shared between the browser form and the server function so both validate
 * identically. The client check is for UX; the server check is the one that
 * matters, because a server function is a public HTTP endpoint.
 */

const optionalAttribution = z.string().trim().max(200).optional();

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  company: z.string().trim().max(120).optional(),
  description: z.string().trim().min(10, "Tell us a bit more about your project").max(1500),
  budget: z.enum(CONTACT_BUDGET_VALUES, { required_error: "Select a budget" }),
  timeline: z.enum(CONTACT_TIMELINE_VALUES, { required_error: "Select a timeline" }),
  source: z.enum(CONTACT_SOURCE_VALUES, { required_error: "Select how you heard about us" }),
  source_detail: z.string().trim().max(160).optional(),
  utm_source: optionalAttribution,
  utm_medium: optionalAttribution,
  utm_campaign: optionalAttribution,
  utm_content: optionalAttribution,
  utm_term: optionalAttribution,
  referrer: optionalAttribution,
});

export type ContactInput = z.infer<typeof contactSchema>;

export const DSAR_TYPES = [
  "access",
  "correction",
  "deletion",
  "portability",
  "restriction",
  "objection",
] as const;

export const dsarSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  residency: z.string().trim().max(80).optional(),
  requestType: z.enum(DSAR_TYPES),
  details: z
    .string()
    .trim()
    .min(10, "Add a short description so we can find your records")
    .max(1500),
  identity: z.string().trim().max(500).optional(),
});

export type DsarInput = z.infer<typeof dsarSchema>;

/** Result shape shared by both submit paths. */
export type IntakeResult =
  | { status: "sent" }
  /** No mail provider configured — the caller should fall back to mailto:. */
  | { status: "unconfigured" }
  | { status: "error"; message: string };
