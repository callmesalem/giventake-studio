import type { ApprovalRecord, CampaignStatus, ExportProfile, StoryboardScene } from "./types";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type TenantRow = {
  id: string;
  slug: string;
  display_name: string;
  created_at: string;
  updated_at: string;
};

type TenantInsert = Omit<TenantRow, "id" | "created_at" | "updated_at"> &
  Partial<Pick<TenantRow, "id" | "created_at" | "updated_at">>;

type TenantScopedRow = {
  id: string;
  tenant_id: string;
  created_at: string;
};

type CampaignRow = TenantScopedRow & {
  brand_id: string;
  name: string;
  goal: string;
  offer: string;
  audience: string;
  call_to_action: string;
  budget_cents: number;
  status: CampaignStatus;
  current_revision_id: string | null;
  updated_at: string;
};

type RevisionRow = TenantScopedRow & {
  campaign_id: string;
  number: number;
  brief: Json;
  storyboard: StoryboardScene[];
  created_by: string;
};

type RenderJobRow = TenantScopedRow & {
  campaign_id: string;
  revision_id: string;
  provider: string;
  model: string;
  requested_budget_cents: number;
  reserved_cents: number;
  idempotency_key: string;
  worker_job_id: string | null;
  status: "queued" | "submitted" | "rendering" | "completed" | "failed" | "cancelled";
  failure_code: string | null;
  updated_at: string;
};

export type StudioDatabase = {
  video_studio: {
    Tables: {
      tenants: {
        Row: TenantRow;
        Insert: TenantInsert;
        Update: Partial<TenantInsert>;
      };
      memberships: {
        Row: TenantScopedRow & {
          user_id: string;
          role: "operator" | "reviewer" | "viewer";
        };
        Insert: Pick<TenantScopedRow, "tenant_id"> & {
          id?: string;
          user_id: string;
          role: "operator" | "reviewer" | "viewer";
          created_at?: string;
        };
        Update: never;
      };
      brands: {
        Row: TenantScopedRow & {
          name: string;
          website: string;
          call_to_action: string;
          primary_color: string | null;
          accent_color: string | null;
          updated_at: string;
        };
        Insert: Partial<Pick<TenantScopedRow, "id" | "created_at">> &
          Pick<TenantScopedRow, "tenant_id"> & {
            name: string;
            website: string;
            call_to_action: string;
            primary_color?: string | null;
            accent_color?: string | null;
          };
        Update: Partial<{
          name: string;
          website: string;
          call_to_action: string;
          primary_color: string | null;
          accent_color: string | null;
        }>;
      };
      campaigns: {
        Row: CampaignRow;
        Insert: Omit<
          CampaignRow,
          "id" | "status" | "current_revision_id" | "created_at" | "updated_at"
        > &
          Partial<
            Pick<CampaignRow, "id" | "status" | "current_revision_id" | "created_at" | "updated_at">
          >;
        Update: Partial<
          Pick<
            CampaignRow,
            | "name"
            | "goal"
            | "offer"
            | "audience"
            | "call_to_action"
            | "budget_cents"
            | "status"
            | "current_revision_id"
          >
        >;
      };
      campaign_revisions: {
        Row: RevisionRow;
        Insert: Omit<RevisionRow, "id" | "created_at"> &
          Partial<Pick<RevisionRow, "id" | "created_at">>;
        Update: never;
      };
      approvals: {
        Row: TenantScopedRow & {
          campaign_id: string;
          revision_id: string;
          kind: ApprovalRecord["kind"];
          actor_user_id: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          campaign_id: string;
          revision_id: string;
          kind: ApprovalRecord["kind"];
          actor_user_id?: string;
          created_at?: string;
        };
        Update: never;
      };
      render_jobs: {
        Row: RenderJobRow;
        Insert: Omit<
          RenderJobRow,
          "id" | "worker_job_id" | "status" | "failure_code" | "created_at" | "updated_at"
        > &
          Partial<
            Pick<
              RenderJobRow,
              "id" | "worker_job_id" | "status" | "failure_code" | "created_at" | "updated_at"
            >
          >;
        Update: Partial<Pick<RenderJobRow, "worker_job_id" | "status" | "failure_code">>;
      };
      assets: {
        Row: TenantScopedRow & {
          render_job_id: string | null;
          storage_key: string;
          media_type: "video" | "image" | "audio" | "caption";
          sha256: string;
          byte_size: number;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          render_job_id?: string | null;
          storage_key: string;
          media_type: "video" | "image" | "audio" | "caption";
          sha256: string;
          byte_size: number;
          created_at?: string;
        };
        Update: never;
      };
      exports: {
        Row: TenantScopedRow & {
          campaign_id: string;
          revision_id: string;
          render_job_id: string;
          asset_id: string | null;
          profile: ExportProfile;
          width: number;
          height: number;
          status: "ready" | "handed_off";
        };
        Insert: {
          id?: string;
          tenant_id: string;
          campaign_id: string;
          revision_id: string;
          render_job_id: string;
          asset_id?: string | null;
          profile: ExportProfile;
          width: number;
          height: number;
          status?: "ready" | "handed_off";
          created_at?: string;
        };
        Update: Partial<{ asset_id: string | null; status: "ready" | "handed_off" }>;
      };
      audit_events: {
        Row: TenantScopedRow & {
          campaign_id: string | null;
          actor_user_id: string;
          action: string;
          target_type: string;
          target_id: string | null;
          request_id: string;
          metadata: Json;
        };
        Insert: never;
        Update: never;
      };
    };
    Views: Record<string, never>;
    Functions: {
      can_access_tenant: { Args: { target_tenant: string }; Returns: boolean };
      can_operate_tenant: { Args: { target_tenant: string }; Returns: boolean };
      can_approve_tenant: { Args: { target_tenant: string }; Returns: boolean };
      write_audit_event: {
        Args: {
          target_tenant: string;
          target_action: string;
          event_target_type: string;
          event_target_id: string | null;
          event_request_id: string;
          event_metadata?: Json;
          target_campaign_id?: string | null;
        };
        Returns: string;
      };
    };
    Enums: {
      membership_role: "operator" | "reviewer" | "viewer";
      campaign_status: CampaignStatus;
      approval_kind: ApprovalRecord["kind"];
      render_status: RenderJobRow["status"];
      export_profile: ExportProfile;
      export_status: "ready" | "handed_off";
    };
    CompositeTypes: Record<string, never>;
  };
};
