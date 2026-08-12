import { describe, expect, it } from "vitest";
import { canTransitionLead, type LeadStatus } from "./lead-state";

describe("lead status transitions", () => {
  const allowed: Record<LeadStatus, LeadStatus[]> = {
    new: ["qualified", "lost"],
    qualified: ["booked", "won", "lost"],
    booked: ["won", "lost"],
    won: [],
    lost: [],
  };

  for (const from of Object.keys(allowed) as LeadStatus[]) {
    for (const to of ["new", "qualified", "booked", "won", "lost"] as LeadStatus[]) {
      it(`${from} -> ${to}`, () => {
        expect(canTransitionLead(from, to)).toBe(allowed[from].includes(to));
      });
    }
  }
});
