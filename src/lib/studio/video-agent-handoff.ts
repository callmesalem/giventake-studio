import type { CampaignRecord } from "./types";

const handoffParameter = "studioHandoff";

export function createVideoAgentHandoffUrl(
  campaign: CampaignRecord,
  videoAgentBaseUrl: string,
): string {
  const url = new URL(videoAgentBaseUrl);
  url.searchParams.set(
    handoffParameter,
    JSON.stringify({
      version: "giventake-video-agent/brief@1",
      source: { system: "giventake-studio", campaignId: campaign.id },
      brief: {
        name: campaign.name,
        goal: campaign.goal,
        offer: campaign.offer,
        audience: campaign.audience,
        callToAction: campaign.callToAction,
        tone: "Clear, grounded, and practical",
        primaryColor: "#0c605b",
        accentColor: "#ed715f",
        budgetCents: campaign.budgetCents,
      },
    }),
  );
  return url.toString();
}
