import { z } from "zod";

/**
 * Shared between the browser form and the server function so both validate
 * identically. The client check is for UX; the server check is the one that
 * matters, because a server function is a public HTTP endpoint.
 */

export const CONTACT_SOURCE_OPTIONS = [
  { value: "warm_network", label: "Someone I know / warm referral" },
  { value: "referral_partner", label: "Referral partner" },
  { value: "google_search", label: "Google or search" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "direct", label: "Typed the website directly" },
  { value: "article_or_content", label: "Article or content" },
  { value: "other", label: "Other" },
] as const;

const contactSourceValues = CONTACT_SOURCE_OPTIONS.map((option) => option.value) as [
  (typeof CONTACT_SOURCE_OPTIONS)[number]["value"],
  ...(typeof CONTACT_SOURCE_OPTIONS)[number]["value"][],
];

const optionalAttribution = z.string().trim().max(200).optional();

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  company: z.string().trim().max(120).optional(),
  description: z.string().trim().min(10, "Tell us a bit more about your project").max(1500),
  budget: z.string().trim().min(1, "Select a budget").max(60),
  timeline: z.string().trim().min(1, "Select a timeline").max(60),
  source: z.enum(contactSourceValues, { required_error: "Select how you heard about us" }),
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
