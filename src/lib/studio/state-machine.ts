import type { CampaignStatus } from "./types";

const allowedTransitions: Record<CampaignStatus, CampaignStatus[]> = {
  draft: ["planned", "archived"],
  planned: ["awaiting_storyboard_approval", "draft", "archived"],
  awaiting_storyboard_approval: ["approved_for_generation", "planned", "archived"],
  approved_for_generation: ["rendering", "archived"],
  rendering: ["awaiting_edit_approval", "failed"],
  awaiting_edit_approval: ["exported", "rendering", "archived"],
  exported: ["handed_off", "archived"],
  handed_off: ["archived"],
  archived: [],
  failed: ["rendering", "archived"],
};

export function assertTransition(from: CampaignStatus, to: CampaignStatus): void {
  if (!allowedTransitions[from].includes(to)) {
    throw new Error(`Invalid campaign transition: ${from} -> ${to}`);
  }
}

export function isHumanApprovalTransition(from: CampaignStatus, to: CampaignStatus): boolean {
  return (
    (from === "awaiting_storyboard_approval" && to === "approved_for_generation") ||
    (from === "awaiting_edit_approval" && to === "exported") ||
    (from === "exported" && to === "handed_off")
  );
}
