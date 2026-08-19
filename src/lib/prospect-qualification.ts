/**
 * Outbound prospect qualification — the /100 rubric as deterministic, auditable
 * code. This complements `qualification-brief.ts` (which scores INBOUND contact
 * form submissions); this module scores an OUTBOUND prospect Piper discovered.
 *
 * Pure and deterministic. The LLM operator (Piper) supplies the seven sub-scores
 * with reasoning; this module validates, totals, and bands them so the score is
 * consistent and reviewable rather than a free-form number. It never invents a
 * score — out-of-range input is rejected, not clamped silently.
 */

export interface ProspectScores {
  businessNeed: number; // 0-20
  problemSeverity: number; // 0-20
  abilityToPay: number; // 0-15
  technologyFit: number; // 0-15
  decisionMakerAccess: number; // 0-10
  timingTrigger: number; // 0-10
  strategicFit: number; // 0-10
}

export type QualificationBand =
  | "exceptional" // 90-100
  | "high_priority" // 75-89
  | "qualified" // 60-74
  | "nurture" // 40-59
  | "do_not_pursue"; // <40

const RUBRIC: { key: keyof ProspectScores; max: number }[] = [
  { key: "businessNeed", max: 20 },
  { key: "problemSeverity", max: 20 },
  { key: "abilityToPay", max: 15 },
  { key: "technologyFit", max: 15 },
  { key: "decisionMakerAccess", max: 10 },
  { key: "timingTrigger", max: 10 },
  { key: "strategicFit", max: 10 },
];

export class QualificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QualificationError";
  }
}

/** Validate a single sub-score is an integer within [0, max]. */
function validateSub(key: keyof ProspectScores, value: number, max: number): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new QualificationError(`${key}: score must be a finite number`);
  }
  if (!Number.isInteger(value)) {
    throw new QualificationError(`${key}: score must be an integer`);
  }
  if (value < 0 || value > max) {
    throw new QualificationError(`${key}: score ${value} out of range 0-${max}`);
  }
}

export function bandFor(total: number): QualificationBand {
  if (total >= 90) return "exceptional";
  if (total >= 75) return "high_priority";
  if (total >= 60) return "qualified";
  if (total >= 40) return "nurture";
  return "do_not_pursue";
}

/**
 * Whether a prospect is worth tracking in the CRM. Everything from `nurture` up
 * is tracked (nurture at low priority); only `do_not_pursue` is dropped.
 */
export function isPursuable(band: QualificationBand): boolean {
  return band !== "do_not_pursue";
}

export interface QualificationResult {
  scores: ProspectScores;
  total: number;
  band: QualificationBand;
  /** Max possible = 100; surfaced so callers never hardcode it. */
  maxTotal: number;
}

/**
 * Total and band a set of sub-scores. Throws QualificationError on any
 * out-of-range or non-integer input — a bad score fails loudly rather than
 * producing a misleading total.
 */
export function qualifyProspect(scores: ProspectScores): QualificationResult {
  let total = 0;
  for (const { key, max } of RUBRIC) {
    const value = scores[key];
    validateSub(key, value, max);
    total += value;
  }
  return { scores, total, band: bandFor(total), maxTotal: 100 };
}
