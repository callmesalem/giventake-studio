import { consentReceiptV1Schema, type ConsentReceiptV1 } from "@giventake/growth-os-contract";
import { z } from "zod";
import { LEAD_STATUSES, type LeadStatus } from "./lead-state";

export { consentReceiptV1Schema };
export type { ConsentReceiptV1, LeadStatus };

export const ISO_4217_CURRENCIES = [
  "AED",
  "AFN",
  "ALL",
  "AMD",
  "ANG",
  "AOA",
  "ARS",
  "AUD",
  "AWG",
  "AZN",
  "BAM",
  "BBD",
  "BDT",
  "BGN",
  "BHD",
  "BIF",
  "BMD",
  "BND",
  "BOB",
  "BOV",
  "BRL",
  "BSD",
  "BTN",
  "BWP",
  "BYN",
  "BZD",
  "CAD",
  "CDF",
  "CHE",
  "CHF",
  "CHW",
  "CLF",
  "CLP",
  "CNY",
  "COP",
  "COU",
  "CRC",
  "CUP",
  "CVE",
  "CZK",
  "DJF",
  "DKK",
  "DOP",
  "DZD",
  "EGP",
  "ERN",
  "ETB",
  "EUR",
  "FJD",
  "FKP",
  "GBP",
  "GEL",
  "GHS",
  "GIP",
  "GMD",
  "GNF",
  "GTQ",
  "GYD",
  "HKD",
  "HNL",
  "HTG",
  "HUF",
  "IDR",
  "ILS",
  "INR",
  "IQD",
  "IRR",
  "ISK",
  "JMD",
  "JOD",
  "JPY",
  "KES",
  "KGS",
  "KHR",
  "KMF",
  "KPW",
  "KRW",
  "KWD",
  "KYD",
  "KZT",
  "LAK",
  "LBP",
  "LKR",
  "LRD",
  "LSL",
  "LYD",
  "MAD",
  "MDL",
  "MGA",
  "MKD",
  "MMK",
  "MNT",
  "MOP",
  "MRU",
  "MUR",
  "MVR",
  "MWK",
  "MXN",
  "MXV",
  "MYR",
  "MZN",
  "NAD",
  "NGN",
  "NIO",
  "NOK",
  "NPR",
  "NZD",
  "OMR",
  "PAB",
  "PEN",
  "PGK",
  "PHP",
  "PKR",
  "PLN",
  "PYG",
  "QAR",
  "RON",
  "RSD",
  "RUB",
  "RWF",
  "SAR",
  "SBD",
  "SCR",
  "SDG",
  "SEK",
  "SGD",
  "SHP",
  "SLE",
  "SOS",
  "SRD",
  "SSP",
  "STN",
  "SVC",
  "SYP",
  "SZL",
  "THB",
  "TJS",
  "TMT",
  "TND",
  "TOP",
  "TRY",
  "TTD",
  "TWD",
  "TZS",
  "UAH",
  "UGX",
  "USD",
  "USN",
  "UYI",
  "UYU",
  "UYW",
  "UZS",
  "VED",
  "VES",
  "VND",
  "VUV",
  "WST",
  "XAF",
  "XAG",
  "XAU",
  "XBA",
  "XBB",
  "XBC",
  "XBD",
  "XCG",
  "XCD",
  "XDR",
  "XOF",
  "XPD",
  "XPF",
  "XPT",
  "XSU",
  "XTS",
  "XUA",
  "XXX",
  "YER",
  "ZAR",
  "ZMW",
  "ZWG",
] as const;

const currencySet = new Set<string>(ISO_4217_CURRENCIES);
const uuid = z.string().uuid();
const hasControlCharacter = (value: string) =>
  Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }, "Invalid calendar date");
const optionalTrimmed = (maximum: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(1).max(maximum).optional(),
  );

export const leadListInputSchema = z
  .object({
    status: z.enum(LEAD_STATUSES).optional(),
    source: optionalTrimmed(80),
    from: dateOnly.optional(),
    to: dateOnly.optional(),
    cursor: optionalTrimmed(1000),
    limit: z.coerce.number().int().positive().catch(25),
  })
  .strict()
  .transform((input) => ({ ...input, limit: Math.min(input.limit, 100) }))
  .superRefine((input, context) => {
    if (input.from && input.to && input.from > input.to) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "From date must not follow to date",
      });
    }
  });

export const leadLookupInputSchema = z
  .object({
    status: z.enum(LEAD_STATUSES).optional(),
    source: optionalTrimmed(80),
    from: dateOnly.optional(),
    to: dateOnly.optional(),
    exactEmail: z.string().trim().toLowerCase().email().max(255).optional(),
    exactPhone: optionalTrimmed(32),
    cursor: optionalTrimmed(1000),
    limit: z.coerce.number().int().positive().catch(25),
  })
  .strict()
  .transform((input) => ({ ...input, limit: Math.min(input.limit, 100) }))
  .superRefine((input, context) => {
    if (!input.exactEmail && !input.exactPhone) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Exact email or phone is required",
      });
    }
    if (input.from && input.to && input.from > input.to) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "From date must not follow to date",
      });
    }
  });

export const leadIdInputSchema = z.object({ leadId: uuid }).strict();
export const statusChangeSchema = z.object({ leadId: uuid, to: z.enum(LEAD_STATUSES) }).strict();
export const reopenLeadInputSchema = z
  .object({
    leadId: uuid,
    reason: z
      .string()
      .trim()
      .min(10)
      .max(500)
      .refine((value) => !hasControlCharacter(value)),
  })
  .strict();

const postgresPositiveBigint = z
  .string()
  .regex(/^[1-9]\d*$/)
  .refine((value) => BigInt(value) <= 9_223_372_036_854_775_807n, "Amount exceeds bigint");
const currency = z
  .string()
  .length(3)
  .refine((value) => currencySet.has(value), "Invalid ISO 4217 currency");

export const revenueInputSchema = z
  .object({
    leadId: uuid,
    amountMinor: postgresPositiveBigint,
    currency,
    confirmedAt: dateOnly,
    note: optionalTrimmed(500),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.confirmedAt > new Date().toISOString().slice(0, 10)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmedAt"],
        message: "Confirmation date cannot be in the future",
      });
    }
  });

export function parseRevenueInputAt(input: unknown, now: Date): RevenueInput {
  const parsed = revenueInputSchema.parse(input);
  if (parsed.confirmedAt > now.toISOString().slice(0, 10)) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: ["confirmedAt"],
        message: "Confirmation date cannot be in the future",
      },
    ]);
  }
  return parsed;
}

const ZERO_MINOR_UNIT_CURRENCIES = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "ISK",
  "JPY",
  "KMF",
  "KRW",
  "PYG",
  "RWF",
  "UGX",
  "UYI",
  "VND",
  "VUV",
  "XAF",
  "XAG",
  "XAU",
  "XBA",
  "XBB",
  "XBC",
  "XBD",
  "XDR",
  "XOF",
  "XPD",
  "XPF",
  "XPT",
  "XSU",
  "XTS",
  "XUA",
  "XXX",
]);
const THREE_MINOR_UNIT_CURRENCIES = new Set(["BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"]);
const FOUR_MINOR_UNIT_CURRENCIES = new Set(["CLF", "UYW"]);

export function currencyMinorUnits(currencyCode: string): number {
  if (!currencySet.has(currencyCode)) throw new Error("Invalid ISO 4217 currency");
  if (ZERO_MINOR_UNIT_CURRENCIES.has(currencyCode)) return 0;
  if (THREE_MINOR_UNIT_CURRENCIES.has(currencyCode)) return 3;
  if (FOUR_MINOR_UNIT_CURRENCIES.has(currencyCode)) return 4;
  return 2;
}

export function majorAmountToMinor(value: string, currencyCode: string): string {
  const exponent = currencyMinorUnits(currencyCode);
  const decimalPattern = exponent === 0 ? "" : `(?:\\.(\\d{1,${exponent}}))?`;
  const match = new RegExp(`^(0|[1-9]\\d*)${decimalPattern}$`).exec(value.trim());
  if (!match) throw new Error(`Amount must have at most ${exponent} decimal places`);
  const scale = 10n ** BigInt(exponent);
  const fraction = exponent === 0 ? "" : (match[2] ?? "").padEnd(exponent, "0");
  const amount = BigInt(match[1]!) * scale + BigInt(fraction || "0");
  if (amount <= 0n || amount > 9_223_372_036_854_775_807n) {
    throw new Error("Amount must be a positive bigint");
  }
  return amount.toString();
}

export function formatMinorAmount(amountMinor: string, currencyCode: string): string {
  const exponent = currencyMinorUnits(currencyCode);
  const scale = 10n ** BigInt(exponent);
  const amount = BigInt(amountMinor);
  const whole = (amount / scale).toLocaleString("en-US");
  if (exponent === 0) return `${currencyCode} ${whole}`;
  const fraction = (amount % scale).toString().padStart(exponent, "0");
  return `${currencyCode} ${whole}.${fraction}`;
}

export type LeadListInput = z.input<typeof leadListInputSchema>;
export type ParsedLeadListInput = z.output<typeof leadListInputSchema>;
export type LeadLookupInput = z.input<typeof leadLookupInputSchema>;
export type StatusChangeInput = z.infer<typeof statusChangeSchema>;
export type ReopenLeadInput = z.infer<typeof reopenLeadInputSchema>;
export type RevenueInput = z.infer<typeof revenueInputSchema>;

export type LeadListItem = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  status: LeadStatus;
  declaredSource: string;
  confidence: "high" | "medium" | "low";
  confirmedRevenueMinor: string | null;
  confirmedRevenueCurrency: string | null;
  occurredAt: string;
  lastActivityAt: string;
};

export type LeadListPage = {
  items: LeadListItem[];
  nextCursor: string | null;
};

export type LeadAuditEvent = {
  action: "lead.created" | "lead.status_changed" | "lead.reopened" | "revenue.recorded";
  createdAt: string;
  previousStatus?: LeadStatus;
  currentStatus?: LeadStatus;
  changeCode?: "lead_status_changed" | "lead_reopened" | "revenue_recorded";
  recordedOn?: string;
  supersededCount?: number;
};

export type LeadDetail = LeadListItem & {
  phone: string | null;
  notes: string;
  budgetRange: string;
  timelineRange: string;
  firstTouch: {
    source: string | null;
    confidence: "high" | "medium" | "low";
    state: "attributed" | "ambiguous" | "unattributed";
    original?: {
      source: string | null;
      confidence: "high" | "medium" | "low";
      state: "attributed" | "ambiguous" | "unattributed";
    };
    correction?: {
      source: string | null;
      confidence: "high" | "medium" | "low";
      state: "attributed" | "ambiguous" | "unattributed";
      reason: string;
    };
  } | null;
  lastTouch: {
    source: string | null;
    confidence: "high" | "medium" | "low";
    state: "attributed" | "ambiguous" | "unattributed";
    original?: {
      source: string | null;
      confidence: "high" | "medium" | "low";
      state: "attributed" | "ambiguous" | "unattributed";
    };
    correction?: {
      source: string | null;
      confidence: "high" | "medium" | "low";
      state: "attributed" | "ambiguous" | "unattributed";
      reason: string;
    };
  } | null;
  consent: ConsentReceiptV1;
  audit: LeadAuditEvent[];
};

export class LeadNotFoundError extends Error {
  readonly code = "LEAD_NOT_FOUND";

  constructor() {
    super("LEAD_NOT_FOUND");
    this.name = "LeadNotFoundError";
  }
}
