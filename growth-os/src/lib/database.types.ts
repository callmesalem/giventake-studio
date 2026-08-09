export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      attribution_evidence: {
        Row: {
          click_ids: Json;
          created_at: string;
          declared_source: string;
          id: string;
          landing_origin: string;
          landing_path: string;
          lead_id: string;
          occurred_at: string;
          offer_id: string;
          referrer_domain: string | null;
          source_detail: string | null;
          tenant_id: string;
          utm_campaign: string | null;
          utm_content: string | null;
          utm_medium: string | null;
          utm_source: string | null;
          utm_term: string | null;
        };
        Insert: {
          click_ids?: Json;
          created_at?: string;
          declared_source: string;
          id?: string;
          landing_origin: string;
          landing_path: string;
          lead_id: string;
          occurred_at: string;
          offer_id: string;
          referrer_domain?: string | null;
          source_detail?: string | null;
          tenant_id: string;
          utm_campaign?: string | null;
          utm_content?: string | null;
          utm_medium?: string | null;
          utm_source?: string | null;
          utm_term?: string | null;
        };
        Update: {
          click_ids?: Json;
          created_at?: string;
          declared_source?: string;
          id?: string;
          landing_origin?: string;
          landing_path?: string;
          lead_id?: string;
          occurred_at?: string;
          offer_id?: string;
          referrer_domain?: string | null;
          source_detail?: string | null;
          tenant_id?: string;
          utm_campaign?: string | null;
          utm_content?: string | null;
          utm_medium?: string | null;
          utm_source?: string | null;
          utm_term?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "attribution_evidence_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attribution_evidence_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attribution_evidence_tenant_lead_fkey";
            columns: ["tenant_id", "lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["tenant_id", "id"];
          },
        ];
      };
      attribution_touches: {
        Row: {
          campaign_id: string | null;
          confidence: Database["public"]["Enums"]["attribution_confidence"];
          created_at: string;
          evidence_id: string | null;
          id: string;
          lead_id: string;
          manual_actor: string | null;
          manual_reason: string | null;
          normalized_source: string;
          reason_codes: string[];
          state: string;
          tenant_id: string;
          touch_type: Database["public"]["Enums"]["attribution_touch_type"];
        };
        Insert: {
          campaign_id?: string | null;
          confidence: Database["public"]["Enums"]["attribution_confidence"];
          created_at?: string;
          evidence_id?: string | null;
          id?: string;
          lead_id: string;
          manual_actor?: string | null;
          manual_reason?: string | null;
          normalized_source: string;
          reason_codes?: string[];
          state: string;
          tenant_id: string;
          touch_type: Database["public"]["Enums"]["attribution_touch_type"];
        };
        Update: {
          campaign_id?: string | null;
          confidence?: Database["public"]["Enums"]["attribution_confidence"];
          created_at?: string;
          evidence_id?: string | null;
          id?: string;
          lead_id?: string;
          manual_actor?: string | null;
          manual_reason?: string | null;
          normalized_source?: string;
          reason_codes?: string[];
          state?: string;
          tenant_id?: string;
          touch_type?: Database["public"]["Enums"]["attribution_touch_type"];
        };
        Relationships: [
          {
            foreignKeyName: "attribution_touches_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attribution_touches_evidence_id_fkey";
            columns: ["evidence_id"];
            isOneToOne: false;
            referencedRelation: "attribution_evidence";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attribution_touches_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attribution_touches_tenant_campaign_fkey";
            columns: ["tenant_id", "campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["tenant_id", "id"];
          },
          {
            foreignKeyName: "attribution_touches_tenant_evidence_fkey";
            columns: ["tenant_id", "evidence_id"];
            isOneToOne: false;
            referencedRelation: "attribution_evidence";
            referencedColumns: ["tenant_id", "id"];
          },
          {
            foreignKeyName: "attribution_touches_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attribution_touches_tenant_lead_fkey";
            columns: ["tenant_id", "lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["tenant_id", "id"];
          },
        ];
      };
      audit_events: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"];
          actor_kind: string;
          actor_user_id: string | null;
          created_at: string;
          id: string;
          metadata: Json;
          request_id: string;
          target_id: string | null;
          target_type: string;
          tenant_id: string;
        };
        Insert: {
          action: Database["public"]["Enums"]["audit_action"];
          actor_kind: string;
          actor_user_id?: string | null;
          created_at?: string;
          id?: string;
          metadata?: Json;
          request_id: string;
          target_id?: string | null;
          target_type: string;
          tenant_id: string;
        };
        Update: {
          action?: Database["public"]["Enums"]["audit_action"];
          actor_kind?: string;
          actor_user_id?: string | null;
          created_at?: string;
          id?: string;
          metadata?: Json;
          request_id?: string;
          target_id?: string | null;
          target_type?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_events_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      brands: {
        Row: {
          accent_color: string;
          created_at: string;
          display_name: string;
          logo_url: string;
          on_primary_color: string;
          primary_color: string;
          report_name: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          accent_color: string;
          created_at?: string;
          display_name: string;
          logo_url: string;
          on_primary_color: string;
          primary_color: string;
          report_name: string;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          accent_color?: string;
          created_at?: string;
          display_name?: string;
          logo_url?: string;
          on_primary_color?: string;
          primary_color?: string;
          report_name?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brands_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: true;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_metrics_daily: {
        Row: {
          campaign_id: string | null;
          clicks: number | null;
          connection_id: string;
          currency: string;
          engaged_sessions: number | null;
          id: string;
          impressions: number | null;
          is_complete: boolean;
          metric_date: string;
          provider_conversion_value_minor: number | null;
          provider_conversions: number | null;
          published_at: string;
          sessions: number | null;
          source_updated_at: string | null;
          spend_minor: number | null;
          tenant_id: string;
          users_count: number | null;
        };
        Insert: {
          campaign_id?: string | null;
          clicks?: number | null;
          connection_id: string;
          currency: string;
          engaged_sessions?: number | null;
          id?: string;
          impressions?: number | null;
          is_complete?: boolean;
          metric_date: string;
          provider_conversion_value_minor?: number | null;
          provider_conversions?: number | null;
          published_at?: string;
          sessions?: number | null;
          source_updated_at?: string | null;
          spend_minor?: number | null;
          tenant_id: string;
          users_count?: number | null;
        };
        Update: {
          campaign_id?: string | null;
          clicks?: number | null;
          connection_id?: string;
          currency?: string;
          engaged_sessions?: number | null;
          id?: string;
          impressions?: number | null;
          is_complete?: boolean;
          metric_date?: string;
          provider_conversion_value_minor?: number | null;
          provider_conversions?: number | null;
          published_at?: string;
          sessions?: number | null;
          source_updated_at?: string | null;
          spend_minor?: number | null;
          tenant_id?: string;
          users_count?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_metrics_daily_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_metrics_daily_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "connections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_metrics_daily_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_metrics_tenant_campaign_fkey";
            columns: ["tenant_id", "campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["tenant_id", "id"];
          },
          {
            foreignKeyName: "campaign_metrics_tenant_connection_fkey";
            columns: ["tenant_id", "connection_id"];
            isOneToOne: false;
            referencedRelation: "connections";
            referencedColumns: ["tenant_id", "id"];
          },
        ];
      };
      campaigns: {
        Row: {
          connection_id: string;
          created_at: string;
          id: string;
          name: string;
          normalized_status: string;
          provider_external_id: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          connection_id: string;
          created_at?: string;
          id?: string;
          name: string;
          normalized_status?: string;
          provider_external_id: string;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          connection_id?: string;
          created_at?: string;
          id?: string;
          name?: string;
          normalized_status?: string;
          provider_external_id?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaigns_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "connections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaigns_tenant_connection_fkey";
            columns: ["tenant_id", "connection_id"];
            isOneToOne: false;
            referencedRelation: "connections";
            referencedColumns: ["tenant_id", "id"];
          },
          {
            foreignKeyName: "campaigns_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      connections: {
        Row: {
          checkpoint: Json;
          created_at: string;
          credential_envelope_ciphertext: string;
          currency: string;
          granted_scopes: string[];
          health: Database["public"]["Enums"]["connection_health"];
          id: string;
          last_success_at: string | null;
          next_retry_at: string | null;
          provider: Database["public"]["Enums"]["provider"];
          revoked_at: string | null;
          selected_external_account_id: string;
          selected_external_account_name: string;
          tenant_id: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          checkpoint?: Json;
          created_at?: string;
          credential_envelope_ciphertext: string;
          currency: string;
          granted_scopes: string[];
          health?: Database["public"]["Enums"]["connection_health"];
          id?: string;
          last_success_at?: string | null;
          next_retry_at?: string | null;
          provider: Database["public"]["Enums"]["provider"];
          revoked_at?: string | null;
          selected_external_account_id: string;
          selected_external_account_name: string;
          tenant_id: string;
          timezone: string;
          updated_at?: string;
        };
        Update: {
          checkpoint?: Json;
          created_at?: string;
          credential_envelope_ciphertext?: string;
          currency?: string;
          granted_scopes?: string[];
          health?: Database["public"]["Enums"]["connection_health"];
          id?: string;
          last_success_at?: string | null;
          next_retry_at?: string | null;
          provider?: Database["public"]["Enums"]["provider"];
          revoked_at?: string | null;
          selected_external_account_id?: string;
          selected_external_account_name?: string;
          tenant_id?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "connections_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      consent_receipts: {
        Row: {
          categories: Json;
          connection_id: string | null;
          created_at: string;
          id: string;
          lead_id: string | null;
          policy_version: string;
          processing_basis: string;
          receipt_type: string;
          recorded_at: string;
          source: string;
          sync_run_id: string | null;
          tenant_id: string;
        };
        Insert: {
          categories: Json;
          connection_id?: string | null;
          created_at?: string;
          id?: string;
          lead_id?: string | null;
          policy_version: string;
          processing_basis: string;
          receipt_type: string;
          recorded_at: string;
          source: string;
          sync_run_id?: string | null;
          tenant_id: string;
        };
        Update: {
          categories?: Json;
          connection_id?: string | null;
          created_at?: string;
          id?: string;
          lead_id?: string | null;
          policy_version?: string;
          processing_basis?: string;
          receipt_type?: string;
          recorded_at?: string;
          source?: string;
          sync_run_id?: string | null;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "consent_receipts_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "connections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "consent_receipts_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "consent_receipts_sync_run_id_fkey";
            columns: ["sync_run_id"];
            isOneToOne: false;
            referencedRelation: "sync_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "consent_receipts_tenant_connection_fkey";
            columns: ["tenant_id", "connection_id"];
            isOneToOne: false;
            referencedRelation: "connections";
            referencedColumns: ["tenant_id", "id"];
          },
          {
            foreignKeyName: "consent_receipts_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "consent_receipts_tenant_lead_fkey";
            columns: ["tenant_id", "lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["tenant_id", "id"];
          },
          {
            foreignKeyName: "consent_receipts_tenant_sync_run_fkey";
            columns: ["tenant_id", "sync_run_id"];
            isOneToOne: false;
            referencedRelation: "sync_runs";
            referencedColumns: ["tenant_id", "id"];
          },
        ];
      };
      ingest_idempotency: {
        Row: {
          accepted_at: string;
          body_digest: string;
          idempotency_key: string;
          lead_id: string;
          site_id: string;
          tenant_id: string;
        };
        Insert: {
          accepted_at?: string;
          body_digest: string;
          idempotency_key: string;
          lead_id: string;
          site_id: string;
          tenant_id: string;
        };
        Update: {
          accepted_at?: string;
          body_digest?: string;
          idempotency_key?: string;
          lead_id?: string;
          site_id?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ingest_idempotency_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ingest_idempotency_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ingest_idempotency_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ingest_idempotency_tenant_lead_fkey";
            columns: ["tenant_id", "lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["tenant_id", "id"];
          },
          {
            foreignKeyName: "ingest_idempotency_tenant_site_fkey";
            columns: ["tenant_id", "site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["tenant_id", "id"];
          },
        ];
      };
      leads: {
        Row: {
          budget_range: string;
          company_ciphertext: string | null;
          created_at: string;
          declared_source: string;
          email_ciphertext: string;
          email_lookup_hash: string;
          external_event_id: string;
          id: string;
          last_activity_at: string;
          name_ciphertext: string;
          notes_ciphertext: string;
          occurred_at: string;
          phone_ciphertext: string | null;
          phone_lookup_hash: string | null;
          restricted_at: string | null;
          site_id: string;
          source_detail: string | null;
          status: Database["public"]["Enums"]["lead_status"];
          tenant_id: string;
          timeline_range: string;
          updated_at: string;
        };
        Insert: {
          budget_range: string;
          company_ciphertext?: string | null;
          created_at?: string;
          declared_source: string;
          email_ciphertext: string;
          email_lookup_hash: string;
          external_event_id: string;
          id?: string;
          last_activity_at?: string;
          name_ciphertext: string;
          notes_ciphertext: string;
          occurred_at: string;
          phone_ciphertext?: string | null;
          phone_lookup_hash?: string | null;
          restricted_at?: string | null;
          site_id: string;
          source_detail?: string | null;
          status?: Database["public"]["Enums"]["lead_status"];
          tenant_id: string;
          timeline_range: string;
          updated_at?: string;
        };
        Update: {
          budget_range?: string;
          company_ciphertext?: string | null;
          created_at?: string;
          declared_source?: string;
          email_ciphertext?: string;
          email_lookup_hash?: string;
          external_event_id?: string;
          id?: string;
          last_activity_at?: string;
          name_ciphertext?: string;
          notes_ciphertext?: string;
          occurred_at?: string;
          phone_ciphertext?: string | null;
          phone_lookup_hash?: string | null;
          restricted_at?: string | null;
          site_id?: string;
          source_detail?: string | null;
          status?: Database["public"]["Enums"]["lead_status"];
          tenant_id?: string;
          timeline_range?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leads_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_tenant_site_fkey";
            columns: ["tenant_id", "site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["tenant_id", "id"];
          },
        ];
      };
      membership_invitations: {
        Row: {
          accepted_at: string | null;
          accepted_user_id: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string;
          role: Database["public"]["Enums"]["membership_role"];
          superseded_at: string | null;
          tenant_id: string;
          token_hash: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_user_id?: string | null;
          created_at?: string;
          email: string;
          expires_at: string;
          id?: string;
          invited_by: string;
          role?: Database["public"]["Enums"]["membership_role"];
          superseded_at?: string | null;
          tenant_id: string;
          token_hash: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_user_id?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string;
          role?: Database["public"]["Enums"]["membership_role"];
          superseded_at?: string | null;
          tenant_id?: string;
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "membership_invitations_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      memberships: {
        Row: {
          created_at: string;
          role: Database["public"]["Enums"]["membership_role"];
          tenant_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          role: Database["public"]["Enums"]["membership_role"];
          tenant_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          role?: Database["public"]["Enums"]["membership_role"];
          tenant_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "memberships_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_admins: {
        Row: {
          created_at: string;
          granted_by: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          granted_by: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          granted_by?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      privacy_requests: {
        Row: {
          completed_at: string | null;
          created_at: string;
          id: string;
          request_type: string;
          requested_at: string;
          requested_by: string;
          restricted_at: string | null;
          sanitized_failure_code: string | null;
          state: Database["public"]["Enums"]["privacy_request_state"];
          subject_lookup_hmac: string;
          tenant_id: string;
          updated_at: string;
          verified_at: string | null;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          request_type: string;
          requested_at?: string;
          requested_by: string;
          restricted_at?: string | null;
          sanitized_failure_code?: string | null;
          state?: Database["public"]["Enums"]["privacy_request_state"];
          subject_lookup_hmac: string;
          tenant_id: string;
          updated_at?: string;
          verified_at?: string | null;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          request_type?: string;
          requested_at?: string;
          requested_by?: string;
          restricted_at?: string | null;
          sanitized_failure_code?: string | null;
          state?: Database["public"]["Enums"]["privacy_request_state"];
          subject_lookup_hmac?: string;
          tenant_id?: string;
          updated_at?: string;
          verified_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "privacy_requests_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      provider_accounts: {
        Row: {
          connection_id: string;
          created_at: string;
          currency: string;
          display_name: string;
          id: string;
          provider: Database["public"]["Enums"]["provider"];
          provider_external_id: string;
          selected: boolean;
          tenant_id: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          connection_id: string;
          created_at?: string;
          currency: string;
          display_name: string;
          id?: string;
          provider: Database["public"]["Enums"]["provider"];
          provider_external_id: string;
          selected?: boolean;
          tenant_id: string;
          timezone: string;
          updated_at?: string;
        };
        Update: {
          connection_id?: string;
          created_at?: string;
          currency?: string;
          display_name?: string;
          id?: string;
          provider?: Database["public"]["Enums"]["provider"];
          provider_external_id?: string;
          selected?: boolean;
          tenant_id?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "provider_accounts_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "connections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "provider_accounts_tenant_connection_fkey";
            columns: ["tenant_id", "connection_id"];
            isOneToOne: false;
            referencedRelation: "connections";
            referencedColumns: ["tenant_id", "id"];
          },
          {
            foreignKeyName: "provider_accounts_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      revenue_outcomes: {
        Row: {
          amount_minor: number;
          confirmed_by: string;
          confirmed_on: string;
          created_at: string;
          currency: string;
          id: string;
          lead_id: string;
          note_ciphertext: string | null;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          amount_minor: number;
          confirmed_by: string;
          confirmed_on: string;
          created_at?: string;
          currency: string;
          id?: string;
          lead_id: string;
          note_ciphertext?: string | null;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          amount_minor?: number;
          confirmed_by?: string;
          confirmed_on?: string;
          created_at?: string;
          currency?: string;
          id?: string;
          lead_id?: string;
          note_ciphertext?: string | null;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "revenue_outcomes_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "revenue_outcomes_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "revenue_outcomes_tenant_lead_fkey";
            columns: ["tenant_id", "lead_id"];
            isOneToOne: true;
            referencedRelation: "leads";
            referencedColumns: ["tenant_id", "id"];
          },
        ];
      };
      sites: {
        Row: {
          created_at: string;
          enabled: boolean;
          id: string;
          key_id: string;
          origin: string;
          rate_limit_per_minute: number;
          signing_secret_ciphertext: string;
          tenant_id: string;
          updated_at: string;
          verified_at: string;
        };
        Insert: {
          created_at?: string;
          enabled?: boolean;
          id?: string;
          key_id: string;
          origin: string;
          rate_limit_per_minute?: number;
          signing_secret_ciphertext: string;
          tenant_id: string;
          updated_at?: string;
          verified_at: string;
        };
        Update: {
          created_at?: string;
          enabled?: boolean;
          id?: string;
          key_id?: string;
          origin?: string;
          rate_limit_per_minute?: number;
          signing_secret_ciphertext?: string;
          tenant_id?: string;
          updated_at?: string;
          verified_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sites_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      support_sessions: {
        Row: {
          admin_user_id: string;
          expires_at: string;
          id: string;
          reason: string;
          revoked_at: string | null;
          started_at: string;
          tenant_id: string;
        };
        Insert: {
          admin_user_id: string;
          expires_at: string;
          id?: string;
          reason: string;
          revoked_at?: string | null;
          started_at?: string;
          tenant_id: string;
        };
        Update: {
          admin_user_id?: string;
          expires_at?: string;
          id?: string;
          reason?: string;
          revoked_at?: string | null;
          started_at?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "support_sessions_admin_user_id_fkey";
            columns: ["admin_user_id"];
            isOneToOne: false;
            referencedRelation: "platform_admins";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "support_sessions_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      sync_payloads: {
        Row: {
          created_at: string;
          expires_at: string;
          id: string;
          payload_ciphertext: string;
          sync_run_id: string;
          tenant_id: string;
        };
        Insert: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          payload_ciphertext: string;
          sync_run_id: string;
          tenant_id: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          payload_ciphertext?: string;
          sync_run_id?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sync_payloads_sync_run_id_fkey";
            columns: ["sync_run_id"];
            isOneToOne: false;
            referencedRelation: "sync_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sync_payloads_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sync_payloads_tenant_sync_run_fkey";
            columns: ["tenant_id", "sync_run_id"];
            isOneToOne: false;
            referencedRelation: "sync_runs";
            referencedColumns: ["tenant_id", "id"];
          },
        ];
      };
      sync_runs: {
        Row: {
          attempt_number: number;
          checkpoint_after: Json | null;
          checkpoint_before: Json;
          completed_at: string | null;
          connection_id: string;
          id: string;
          imported_count: number;
          published_count: number;
          sanitized_error_code: string | null;
          started_at: string;
          status: Database["public"]["Enums"]["sync_status"];
          tenant_id: string;
          window_end: string;
          window_start: string;
        };
        Insert: {
          attempt_number?: number;
          checkpoint_after?: Json | null;
          checkpoint_before?: Json;
          completed_at?: string | null;
          connection_id: string;
          id?: string;
          imported_count?: number;
          published_count?: number;
          sanitized_error_code?: string | null;
          started_at?: string;
          status?: Database["public"]["Enums"]["sync_status"];
          tenant_id: string;
          window_end: string;
          window_start: string;
        };
        Update: {
          attempt_number?: number;
          checkpoint_after?: Json | null;
          checkpoint_before?: Json;
          completed_at?: string | null;
          connection_id?: string;
          id?: string;
          imported_count?: number;
          published_count?: number;
          sanitized_error_code?: string | null;
          started_at?: string;
          status?: Database["public"]["Enums"]["sync_status"];
          tenant_id?: string;
          window_end?: string;
          window_start?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sync_runs_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "connections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sync_runs_tenant_connection_fkey";
            columns: ["tenant_id", "connection_id"];
            isOneToOne: false;
            referencedRelation: "connections";
            referencedColumns: ["tenant_id", "id"];
          },
          {
            foreignKeyName: "sync_runs_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenants: {
        Row: {
          created_at: string;
          currency: string;
          display_name: string;
          id: string;
          lead_retention_months: number;
          slug: string;
          status: Database["public"]["Enums"]["tenant_status"];
          timezone: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          currency?: string;
          display_name: string;
          id?: string;
          lead_retention_months?: number;
          slug: string;
          status?: Database["public"]["Enums"]["tenant_status"];
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          currency?: string;
          display_name?: string;
          id?: string;
          lead_retention_months?: number;
          slug?: string;
          status?: Database["public"]["Enums"]["tenant_status"];
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_membership_invitation: {
        Args: {
          event_request_id: string;
          invitation_id: string;
          invited_email: string;
          invited_user_id: string;
          target_tenant: string;
        };
        Returns: boolean;
      };
      brand_contrast_ratio: {
        Args: { first_color: string; second_color: string };
        Returns: number;
      };
      can_access_tenant: { Args: { target_tenant: string }; Returns: boolean };
      current_support_session_id: { Args: never; Returns: string | null };
      end_support_session: {
        Args: {
          event_request_id: string;
          target_admin_user: string;
          target_session: string;
        };
        Returns: string;
      };
      has_active_support_session: {
        Args: { target_tenant: string };
        Returns: boolean;
      };
      is_allowlisted_click_ids: {
        Args: { input_value: Json };
        Returns: boolean;
      };
      is_client_owner: { Args: { target_tenant: string }; Returns: boolean };
      is_sanitized_audit_metadata: {
        Args: { input_value: Json };
        Returns: boolean;
      };
      prepare_membership_invitation: {
        Args: {
          event_request_id: string;
          invitation_email: string;
          invitation_expires_at: string;
          invitation_token_hash: string;
          inviter_user_id: string;
          target_tenant: string;
        };
        Returns: string;
      };
      publish_metric_window: {
        Args: {
          completed_at: string;
          rows_payload: Json;
          target_connection: string;
          target_tenant: string;
          window_end: string;
          window_start: string;
        };
        Returns: number;
      };
      restrict_privacy_subject: {
        Args: {
          event_request_id: string;
          requested_type: string;
          requester_user_id: string;
          subject_lookup_hmac: string;
          target_tenant: string;
        };
        Returns: string;
      };
      run_retention_cleanup: {
        Args: { cleanup_at?: string; target_tenant: string };
        Returns: Json;
      };
      start_support_session: {
        Args: {
          requested_expires_at: string;
          session_reason: string;
          target_admin_user: string;
          target_tenant: string;
        };
        Returns: string;
      };
      update_tenant_brand: {
        Args: {
          brand_accent_color: string;
          brand_display_name: string;
          brand_logo_url: string;
          brand_on_primary_color: string;
          brand_primary_color: string;
          brand_report_name: string;
          event_request_id: string;
          target_tenant: string;
        };
        Returns: Json;
      };
      write_audit_event: {
        Args: {
          event_action: Database["public"]["Enums"]["audit_action"];
          event_actor_user_id?: string | null;
          event_metadata: Json;
          event_request_id: string;
          event_target_id: string | null;
          event_target_type: string;
          target_tenant: string;
        };
        Returns: string;
      };
    };
    Enums: {
      attribution_confidence: "high" | "medium" | "low";
      attribution_touch_type: "unresolved" | "first" | "last" | "manual";
      audit_action:
        | "auth.login"
        | "auth.logout"
        | "membership.invited"
        | "membership.changed"
        | "brand.updated"
        | "support.started"
        | "support.ended"
        | "cross_tenant_access_denied"
        | "lead.created"
        | "lead.status_changed"
        | "lead.reopened"
        | "revenue.recorded"
        | "attribution.recomputed"
        | "attribution.corrected"
        | "connector.authorized"
        | "connector.synced"
        | "connector.refresh_failed"
        | "connector.revoked"
        | "privacy.requested"
        | "privacy.exported"
        | "privacy.restricted"
        | "privacy.deleted"
        | "retention.completed";
      connection_health: "healthy" | "degraded" | "action_required" | "revoked";
      lead_status: "new" | "qualified" | "booked" | "won" | "lost";
      membership_role: "client_owner";
      privacy_request_state:
        | "pending"
        | "verified"
        | "restricted"
        | "processing"
        | "completed"
        | "failed";
      provider: "google_analytics" | "google_ads" | "meta_ads";
      sync_status: "pending" | "running" | "succeeded" | "partial" | "failed";
      tenant_status: "active" | "suspended" | "closed";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      attribution_confidence: ["high", "medium", "low"],
      attribution_touch_type: ["unresolved", "first", "last", "manual"],
      audit_action: [
        "auth.login",
        "auth.logout",
        "membership.invited",
        "membership.changed",
        "brand.updated",
        "support.started",
        "support.ended",
        "cross_tenant_access_denied",
        "lead.created",
        "lead.status_changed",
        "lead.reopened",
        "revenue.recorded",
        "attribution.recomputed",
        "attribution.corrected",
        "connector.authorized",
        "connector.synced",
        "connector.refresh_failed",
        "connector.revoked",
        "privacy.requested",
        "privacy.exported",
        "privacy.restricted",
        "privacy.deleted",
        "retention.completed",
      ],
      connection_health: ["healthy", "degraded", "action_required", "revoked"],
      lead_status: ["new", "qualified", "booked", "won", "lost"],
      membership_role: ["client_owner"],
      privacy_request_state: [
        "pending",
        "verified",
        "restricted",
        "processing",
        "completed",
        "failed",
      ],
      provider: ["google_analytics", "google_ads", "meta_ads"],
      sync_status: ["pending", "running", "succeeded", "partial", "failed"],
      tenant_status: ["active", "suspended", "closed"],
    },
  },
} as const;
