export const campaignStatuses = [
  "draft",
  "planned",
  "awaiting_storyboard_approval",
  "approved_for_generation",
  "rendering",
  "awaiting_edit_approval",
  "exported",
  "handed_off",
  "archived",
  "failed",
] as const;

export type CampaignStatus = (typeof campaignStatuses)[number];

export type StudioIdentity = {
  tenantId: string;
  actorId: string;
};

export type CampaignBrief = {
  tenantId: string;
  name: string;
  goal: string;
  offer: string;
  audience: string;
  callToAction: string;
  budgetCents: number;
};

export type StoryboardScene = {
  order: number;
  durationSeconds: number;
  purpose: "hook" | "proof" | "cta";
  narration: string;
  prompt: string;
  safeArea: "bottom" | "center";
};

export type CampaignRevision = {
  id: string;
  campaignId: string;
  tenantId: string;
  number: number;
  brief: CampaignBrief;
  storyboard: StoryboardScene[];
  createdAt: string;
  createdBy: string;
};

export type CampaignRecord = CampaignBrief & {
  id: string;
  status: CampaignStatus;
  currentRevisionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApprovalRecord = {
  id: string;
  tenantId: string;
  campaignId: string;
  revisionId: string;
  kind: "storyboard" | "edit" | "handoff";
  actorId: string;
  createdAt: string;
};

export type AuditEvent = {
  id: string;
  tenantId: string;
  campaignId: string;
  actorId: string;
  action: string;
  createdAt: string;
  detail: Record<string, string | number | boolean | null>;
};

export type ExportProfile = "vertical" | "square" | "landscape";

export type ExportRecord = {
  id: string;
  tenantId: string;
  campaignId: string;
  revisionId: string;
  profile: ExportProfile;
  width: number;
  height: number;
  status: "ready" | "handed_off";
  createdAt: string;
};

export type StudioRepository = {
  createCampaign: (brief: CampaignBrief, actorId: string) => CampaignRecord;
  getCampaign: (tenantId: string, campaignId: string) => CampaignRecord | null;
  listCampaigns: (tenantId: string) => CampaignRecord[];
  saveCampaign: (campaign: CampaignRecord) => CampaignRecord;
  createRevision: (revision: CampaignRevision) => CampaignRevision;
  getCurrentRevision: (tenantId: string, campaignId: string) => CampaignRevision | null;
  addApproval: (approval: ApprovalRecord) => ApprovalRecord;
  listApprovals: (tenantId: string, campaignId: string) => ApprovalRecord[];
  addAuditEvent: (event: AuditEvent) => AuditEvent;
  listAuditEvents: (tenantId: string, campaignId: string) => AuditEvent[];
  addExport: (item: ExportRecord) => ExportRecord;
  listExports: (tenantId: string, campaignId: string) => ExportRecord[];
};
