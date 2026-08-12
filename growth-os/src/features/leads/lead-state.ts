export const LEAD_STATUSES = ["new", "qualified", "booked", "won", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

const transitions = new Set([
  "new:qualified",
  "new:lost",
  "qualified:booked",
  "qualified:won",
  "qualified:lost",
  "booked:won",
  "booked:lost",
]);

export function canTransitionLead(from: LeadStatus, to: LeadStatus) {
  return transitions.has(`${from}:${to}`);
}
