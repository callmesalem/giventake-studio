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

export type StudioBrand = {
  id: string;
  tenantId: string;
  name: string;
  website: string;
  callToAction: string;
  primaryColor: string | null;
  accentColor: string | null;
  createdAt: string;
  updatedAt: string;
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

export type RenderJobStatus =
  "queued" | "submitted" | "rendering" | "completed" | "failed" | "cancelled";

export type RenderJobRecord = {
  id: string;
  tenantId: string;
  campaignId: string;
  revisionId: string;
  provider: string;
  model: string;
  requestedBudgetCents: number;
  reservedCents: number;
  idempotencyKey: string;
  workerJobId: string | null;
  status: RenderJobStatus;
  failureCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateRenderJob = Omit<
  RenderJobRecord,
  "id" | "workerJobId" | "status" | "failureCode" | "createdAt" | "updatedAt"
>;

export type StudioRepository = {
  createCampaign: (brief: CampaignBrief, actorId: string) => Promise<CampaignRecord>;
  getCampaign: (tenantId: string, campaignId: string) => Promise<CampaignRecord | null>;
  listCampaigns: (tenantId: string) => Promise<CampaignRecord[]>;
  saveCampaign: (campaign: CampaignRecord) => Promise<CampaignRecord>;
  createRevision: (revision: CampaignRevision) => Promise<CampaignRevision>;
  getCurrentRevision: (tenantId: string, campaignId: string) => Promise<CampaignRevision | null>;
  addApproval: (approval: ApprovalRecord) => Promise<ApprovalRecord>;
  listApprovals: (tenantId: string, campaignId: string) => Promise<ApprovalRecord[]>;
  addAuditEvent: (event: AuditEvent) => Promise<AuditEvent>;
  listAuditEvents: (tenantId: string, campaignId: string) => Promise<AuditEvent[]>;
  addExport: (item: ExportRecord) => Promise<ExportRecord>;
  listExports: (tenantId: string, campaignId: string) => Promise<ExportRecord[]>;
  createRenderJob: (job: CreateRenderJob) => Promise<RenderJobRecord>;
  getRenderJob: (tenantId: string, jobId: string) => Promise<RenderJobRecord | null>;
  getRenderJobByIdempotencyKey: (
    tenantId: string,
    campaignId: string,
    idempotencyKey: string,
  ) => Promise<RenderJobRecord | null>;
  saveRenderJob: (job: RenderJobRecord) => Promise<RenderJobRecord>;
};
