export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      agent_capabilities: {
        Row: {
          agent_role: string;
          capability: string;
          enabled: boolean;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          agent_role: string;
          capability: string;
          enabled?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          agent_role?: string;
          capability?: string;
          enabled?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      agent_log: {
        Row: {
          client_id: string | null;
          created_at: string;
          escalated: boolean;
          id: number;
          lead_id: string | null;
          operator: string;
          outcome: string | null;
          payload: Json;
          sop: string | null;
          step: string | null;
          synthetic: boolean;
          trigger: string | null;
        };
        Insert: {
          client_id?: string | null;
          created_at?: string;
          escalated?: boolean;
          id?: never;
          lead_id?: string | null;
          operator: string;
          outcome?: string | null;
          payload?: Json;
          sop?: string | null;
          step?: string | null;
          synthetic?: boolean;
          trigger?: string | null;
        };
        Update: {
          client_id?: string | null;
          created_at?: string;
          escalated?: boolean;
          id?: never;
          lead_id?: string | null;
          operator?: string;
          outcome?: string | null;
          payload?: Json;
          sop?: string | null;
          step?: string | null;
          synthetic?: boolean;
          trigger?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "agent_log_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_log_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };
      approval_queue: {
        Row: {
          action_type: string;
          agent_name: string;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          decision_reason: string | null;
          execution_result: Json | null;
          expires_at: string | null;
          id: string;
          proposed_payload: Json;
          requested_at: string;
          risk_level: string;
          status: string;
          summary: string;
          synthetic: boolean;
          target_id: string | null;
          target_type: string | null;
        };
        Insert: {
          action_type: string;
          agent_name: string;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_reason?: string | null;
          execution_result?: Json | null;
          expires_at?: string | null;
          id?: string;
          proposed_payload?: Json;
          requested_at?: string;
          risk_level?: string;
          status?: string;
          summary: string;
          synthetic?: boolean;
          target_id?: string | null;
          target_type?: string | null;
        };
        Update: {
          action_type?: string;
          agent_name?: string;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_reason?: string | null;
          execution_result?: Json | null;
          expires_at?: string | null;
          id?: string;
          proposed_payload?: Json;
          requested_at?: string;
          risk_level?: string;
          status?: string;
          summary?: string;
          synthetic?: boolean;
          target_id?: string | null;
          target_type?: string | null;
        };
        Relationships: [];
      };
      approved_recipients: {
        Row: {
          approved_at: string;
          approved_by: string;
          created_at: string;
          domain: string | null;
          expires_at: string | null;
          id: string;
          normalized_address: string | null;
          notes: string | null;
          sop: string;
        };
        Insert: {
          approved_at?: string;
          approved_by: string;
          created_at?: string;
          domain?: string | null;
          expires_at?: string | null;
          id?: string;
          normalized_address?: string | null;
          notes?: string | null;
          sop: string;
        };
        Update: {
          approved_at?: string;
          approved_by?: string;
          created_at?: string;
          domain?: string | null;
          expires_at?: string | null;
          id?: string;
          normalized_address?: string | null;
          notes?: string | null;
          sop?: string;
        };
        Relationships: [];
      };
      campaign_enrollments: {
        Row: {
          campaign_id: string;
          created_at: string;
          current_step: number;
          id: string;
          last_advanced_at: string;
          lead_id: string;
          status: string;
          synthetic: boolean;
          updated_at: string;
        };
        Insert: {
          campaign_id: string;
          created_at?: string;
          current_step?: number;
          id?: string;
          last_advanced_at?: string;
          lead_id: string;
          status?: string;
          synthetic?: boolean;
          updated_at?: string;
        };
        Update: {
          campaign_id?: string;
          created_at?: string;
          current_step?: number;
          id?: string;
          last_advanced_at?: string;
          lead_id?: string;
          status?: string;
          synthetic?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_enrollments_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_enrollments_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_events: {
        Row: {
          created_at: string;
          details: Json;
          enrollment_id: string;
          event_type: string;
          id: number;
        };
        Insert: {
          created_at?: string;
          details?: Json;
          enrollment_id: string;
          event_type: string;
          id?: never;
        };
        Update: {
          created_at?: string;
          details?: Json;
          enrollment_id?: string;
          event_type?: string;
          id?: never;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_events_enrollment_id_fkey";
            columns: ["enrollment_id"];
            isOneToOne: false;
            referencedRelation: "campaign_enrollments";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_sends: {
        Row: {
          attempts: number;
          claimed_at: string;
          created_at: string;
          enrollment_id: string;
          error: string | null;
          id: string;
          provider_message_id: string | null;
          sent_at: string | null;
          status: string;
          step_order: number;
        };
        Insert: {
          attempts?: number;
          claimed_at?: string;
          created_at?: string;
          enrollment_id: string;
          error?: string | null;
          id?: string;
          provider_message_id?: string | null;
          sent_at?: string | null;
          status?: string;
          step_order: number;
        };
        Update: {
          attempts?: number;
          claimed_at?: string;
          created_at?: string;
          enrollment_id?: string;
          error?: string | null;
          id?: string;
          provider_message_id?: string | null;
          sent_at?: string | null;
          status?: string;
          step_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_sends_enrollment_id_fkey";
            columns: ["enrollment_id"];
            isOneToOne: false;
            referencedRelation: "campaign_enrollments";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_steps: {
        Row: {
          campaign_id: string;
          channel: string;
          created_at: string;
          delay_hours: number;
          id: string;
          step_order: number;
          synthetic: boolean;
          template: Json;
        };
        Insert: {
          campaign_id: string;
          channel?: string;
          created_at?: string;
          delay_hours?: number;
          id?: string;
          step_order: number;
          synthetic?: boolean;
          template?: Json;
        };
        Update: {
          campaign_id?: string;
          channel?: string;
          created_at?: string;
          delay_hours?: number;
          id?: string;
          step_order?: number;
          synthetic?: boolean;
          template?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_steps_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
        ];
      };
      campaigns: {
        Row: {
          audience: Json;
          channel: string;
          created_at: string;
          goal: string | null;
          id: string;
          name: string;
          owner: string | null;
          sop: string | null;
          status: string;
          synthetic: boolean;
          updated_at: string;
        };
        Insert: {
          audience?: Json;
          channel?: string;
          created_at?: string;
          goal?: string | null;
          id?: string;
          name: string;
          owner?: string | null;
          sop?: string | null;
          status?: string;
          synthetic?: boolean;
          updated_at?: string;
        };
        Update: {
          audience?: Json;
          channel?: string;
          created_at?: string;
          goal?: string | null;
          id?: string;
          name?: string;
          owner?: string | null;
          sop?: string | null;
          status?: string;
          synthetic?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      channel_auth_log: {
        Row: {
          client_ip: string | null;
          created_at: string;
          hour_bucket: string;
          id: string;
          outcome: string;
          presented_via: string;
          surface: string;
          user_agent: string | null;
        };
        Insert: {
          client_ip?: string | null;
          created_at?: string;
          hour_bucket: string;
          id?: string;
          outcome: string;
          presented_via: string;
          surface: string;
          user_agent?: string | null;
        };
        Update: {
          client_ip?: string | null;
          created_at?: string;
          hour_bucket?: string;
          id?: string;
          outcome?: string;
          presented_via?: string;
          surface?: string;
          user_agent?: string | null;
        };
        Relationships: [];
      };
      clients: {
        Row: {
          ai_processing_allowed: boolean;
          created_at: string;
          deal_id: string | null;
          id: string;
          lead_id: string | null;
          name: string;
          owner_id: string | null;
          synthetic: boolean;
        };
        Insert: {
          ai_processing_allowed?: boolean;
          created_at?: string;
          deal_id?: string | null;
          id?: string;
          lead_id?: string | null;
          name: string;
          owner_id?: string | null;
          synthetic?: boolean;
        };
        Update: {
          ai_processing_allowed?: boolean;
          created_at?: string;
          deal_id?: string | null;
          id?: string;
          lead_id?: string | null;
          name?: string;
          owner_id?: string | null;
          synthetic?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "clients_deal_id_fkey";
            columns: ["deal_id"];
            isOneToOne: false;
            referencedRelation: "deals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clients_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };
      companies: {
        Row: {
          categories: Json;
          created_at: string;
          description: string | null;
          domain: string | null;
          employee_range: string | null;
          id: string;
          location: string | null;
          metadata: Json;
          name: string;
          owner_id: string | null;
          socials: Json;
          source: string;
          source_record_id: string | null;
          synthetic: boolean;
          updated_at: string;
        };
        Insert: {
          categories?: Json;
          created_at?: string;
          description?: string | null;
          domain?: string | null;
          employee_range?: string | null;
          id?: string;
          location?: string | null;
          metadata?: Json;
          name: string;
          owner_id?: string | null;
          socials?: Json;
          source?: string;
          source_record_id?: string | null;
          synthetic?: boolean;
          updated_at?: string;
        };
        Update: {
          categories?: Json;
          created_at?: string;
          description?: string | null;
          domain?: string | null;
          employee_range?: string | null;
          id?: string;
          location?: string | null;
          metadata?: Json;
          name?: string;
          owner_id?: string | null;
          socials?: Json;
          source?: string;
          source_record_id?: string | null;
          synthetic?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      contacts: {
        Row: {
          assigned_to: string | null;
          budget: string | null;
          company_id: string | null;
          consent_at: string | null;
          consent_given: boolean | null;
          consent_text: string | null;
          created_at: string;
          email: string | null;
          id: string;
          job_title: string | null;
          lead_status: string | null;
          lifecycle_stage: string;
          metadata: Json;
          name: string | null;
          next_action: string | null;
          next_action_due: string | null;
          owner_id: string | null;
          phone: string | null;
          socials: Json;
          source: string;
          source_record_id: string | null;
          synthetic: boolean;
          timeline: string | null;
          updated_at: string;
        };
        Insert: {
          assigned_to?: string | null;
          budget?: string | null;
          company_id?: string | null;
          consent_at?: string | null;
          consent_given?: boolean | null;
          consent_text?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          job_title?: string | null;
          lead_status?: string | null;
          lifecycle_stage?: string;
          metadata?: Json;
          name?: string | null;
          next_action?: string | null;
          next_action_due?: string | null;
          owner_id?: string | null;
          phone?: string | null;
          socials?: Json;
          source?: string;
          source_record_id?: string | null;
          synthetic?: boolean;
          timeline?: string | null;
          updated_at?: string;
        };
        Update: {
          assigned_to?: string | null;
          budget?: string | null;
          company_id?: string | null;
          consent_at?: string | null;
          consent_given?: boolean | null;
          consent_text?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          job_title?: string | null;
          lead_status?: string | null;
          lifecycle_stage?: string;
          metadata?: Json;
          name?: string | null;
          next_action?: string | null;
          next_action_due?: string | null;
          owner_id?: string | null;
          phone?: string | null;
          socials?: Json;
          source?: string;
          source_record_id?: string | null;
          synthetic?: boolean;
          timeline?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      deal_stage_events: {
        Row: {
          actor: string;
          created_at: string;
          deal_id: string;
          from_stage: string | null;
          id: string;
          note: string;
          to_stage: string;
        };
        Insert: {
          actor: string;
          created_at?: string;
          deal_id: string;
          from_stage?: string | null;
          id?: string;
          note: string;
          to_stage: string;
        };
        Update: {
          actor?: string;
          created_at?: string;
          deal_id?: string;
          from_stage?: string | null;
          id?: string;
          note?: string;
          to_stage?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deal_stage_events_deal_id_fkey";
            columns: ["deal_id"];
            isOneToOne: false;
            referencedRelation: "deals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deal_stage_events_to_stage_fkey";
            columns: ["to_stage"];
            isOneToOne: false;
            referencedRelation: "pipeline_stages";
            referencedColumns: ["name"];
          },
        ];
      };
      deals: {
        Row: {
          assigned_to: string | null;
          closed_at: string | null;
          company_id: string | null;
          contact_id: string | null;
          created_at: string;
          id: string;
          lead_id: string | null;
          lost_reason: string | null;
          metadata: Json;
          name: string | null;
          owner_id: string | null;
          source: string;
          source_record_id: string | null;
          stage: string | null;
          synthetic: boolean;
          updated_at: string;
          value_usd: number | null;
        };
        Insert: {
          assigned_to?: string | null;
          closed_at?: string | null;
          company_id?: string | null;
          contact_id?: string | null;
          created_at?: string;
          id?: string;
          lead_id?: string | null;
          lost_reason?: string | null;
          metadata?: Json;
          name?: string | null;
          owner_id?: string | null;
          source?: string;
          source_record_id?: string | null;
          stage?: string | null;
          synthetic?: boolean;
          updated_at?: string;
          value_usd?: number | null;
        };
        Update: {
          assigned_to?: string | null;
          closed_at?: string | null;
          company_id?: string | null;
          contact_id?: string | null;
          created_at?: string;
          id?: string;
          lead_id?: string | null;
          lost_reason?: string | null;
          metadata?: Json;
          name?: string | null;
          owner_id?: string | null;
          source?: string;
          source_record_id?: string | null;
          stage?: string | null;
          synthetic?: boolean;
          updated_at?: string;
          value_usd?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deals_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deals_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deals_stage_fkey";
            columns: ["stage"];
            isOneToOne: false;
            referencedRelation: "pipeline_stages";
            referencedColumns: ["name"];
          },
        ];
      };
      demo_sites: {
        Row: {
          address: string | null;
          business_name: string;
          company_id: string | null;
          created_at: string;
          deal_id: string | null;
          error: string | null;
          id: string;
          requested_by: string | null;
          status: string;
          updated_at: string;
          url: string | null;
          vertical: string | null;
        };
        Insert: {
          address?: string | null;
          business_name: string;
          company_id?: string | null;
          created_at?: string;
          deal_id?: string | null;
          error?: string | null;
          id?: string;
          requested_by?: string | null;
          status?: string;
          updated_at?: string;
          url?: string | null;
          vertical?: string | null;
        };
        Update: {
          address?: string | null;
          business_name?: string;
          company_id?: string | null;
          created_at?: string;
          deal_id?: string | null;
          error?: string | null;
          id?: string;
          requested_by?: string | null;
          status?: string;
          updated_at?: string;
          url?: string | null;
          vertical?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "demo_sites_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "demo_sites_deal_id_fkey";
            columns: ["deal_id"];
            isOneToOne: false;
            referencedRelation: "deals";
            referencedColumns: ["id"];
          },
        ];
      };
      do_not_contact: {
        Row: {
          created_at: string;
          id: string;
          normalized_address: string;
          reason: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          normalized_address: string;
          reason: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          normalized_address?: string;
          reason?: string;
        };
        Relationships: [];
      };
      document_signatures: {
        Row: {
          consent_text: string | null;
          created_at: string;
          declined_reason: string | null;
          document_hash: string;
          document_id: string;
          expires_at: string;
          id: string;
          recipient_email: string;
          recipient_name: string;
          recipient_role: string | null;
          sent_at: string;
          sent_by: string | null;
          signature_ip: string | null;
          signature_user_agent: string | null;
          signed_at: string | null;
          signed_body: string;
          signed_name: string | null;
          signing_token: string;
          status: string;
          synthetic: boolean;
          viewed_at: string | null;
        };
        Insert: {
          consent_text?: string | null;
          created_at?: string;
          declined_reason?: string | null;
          document_hash: string;
          document_id: string;
          expires_at?: string;
          id?: string;
          recipient_email: string;
          recipient_name: string;
          recipient_role?: string | null;
          sent_at?: string;
          sent_by?: string | null;
          signature_ip?: string | null;
          signature_user_agent?: string | null;
          signed_at?: string | null;
          signed_body: string;
          signed_name?: string | null;
          signing_token?: string;
          status?: string;
          synthetic?: boolean;
          viewed_at?: string | null;
        };
        Update: {
          consent_text?: string | null;
          created_at?: string;
          declined_reason?: string | null;
          document_hash?: string;
          document_id?: string;
          expires_at?: string;
          id?: string;
          recipient_email?: string;
          recipient_name?: string;
          recipient_role?: string | null;
          sent_at?: string;
          sent_by?: string | null;
          signature_ip?: string | null;
          signature_user_agent?: string | null;
          signed_at?: string | null;
          signed_body?: string;
          signed_name?: string | null;
          signing_token?: string;
          status?: string;
          synthetic?: boolean;
          viewed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "document_signatures_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: {
          body: string;
          body_hash: string;
          created_at: string;
          deal_id: string | null;
          doc_type: string;
          id: string;
          owner_id: string | null;
          project_id: string | null;
          stage_number: number | null;
          status: string;
          synthetic: boolean;
          template_id: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          body: string;
          body_hash: string;
          created_at?: string;
          deal_id?: string | null;
          doc_type: string;
          id?: string;
          owner_id?: string | null;
          project_id?: string | null;
          stage_number?: number | null;
          status?: string;
          synthetic?: boolean;
          template_id?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          body_hash?: string;
          created_at?: string;
          deal_id?: string | null;
          doc_type?: string;
          id?: string;
          owner_id?: string | null;
          project_id?: string | null;
          stage_number?: number | null;
          status?: string;
          synthetic?: boolean;
          template_id?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "documents_deal_id_fkey";
            columns: ["deal_id"];
            isOneToOne: false;
            referencedRelation: "deals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      giveaway_entries: {
        Row: {
          about: string | null;
          agreed_rules: boolean;
          business_name: string;
          city: string | null;
          consent_at: string;
          consent_text_version: string | null;
          contact_name: string;
          created_at: string;
          email: string;
          email_marketing_consent: boolean;
          id: string;
          ip: string | null;
          phone: string | null;
          sms_consent: boolean;
          source: string;
          user_agent: string | null;
        };
        Insert: {
          about?: string | null;
          agreed_rules?: boolean;
          business_name: string;
          city?: string | null;
          consent_at?: string;
          consent_text_version?: string | null;
          contact_name: string;
          created_at?: string;
          email: string;
          email_marketing_consent?: boolean;
          id?: string;
          ip?: string | null;
          phone?: string | null;
          sms_consent?: boolean;
          source?: string;
          user_agent?: string | null;
        };
        Update: {
          about?: string | null;
          agreed_rules?: boolean;
          business_name?: string;
          city?: string | null;
          consent_at?: string;
          consent_text_version?: string | null;
          contact_name?: string;
          created_at?: string;
          email?: string;
          email_marketing_consent?: boolean;
          id?: string;
          ip?: string | null;
          phone?: string | null;
          sms_consent?: boolean;
          source?: string;
          user_agent?: string | null;
        };
        Relationships: [];
      };
      invoices: {
        Row: {
          amount_cents: number | null;
          created_at: string;
          currency: string;
          due_at: string | null;
          id: string;
          issued_at: string | null;
          owner_id: string | null;
          paid_at: string | null;
          project_id: string | null;
          source_deal_id: string | null;
          status: string;
          stripe_id: string | null;
          synthetic: boolean;
        };
        Insert: {
          amount_cents?: number | null;
          created_at?: string;
          currency?: string;
          due_at?: string | null;
          id?: string;
          issued_at?: string | null;
          owner_id?: string | null;
          paid_at?: string | null;
          project_id?: string | null;
          source_deal_id?: string | null;
          status?: string;
          stripe_id?: string | null;
          synthetic?: boolean;
        };
        Update: {
          amount_cents?: number | null;
          created_at?: string;
          currency?: string;
          due_at?: string | null;
          id?: string;
          issued_at?: string | null;
          owner_id?: string | null;
          paid_at?: string | null;
          project_id?: string | null;
          source_deal_id?: string | null;
          status?: string;
          stripe_id?: string | null;
          synthetic?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_source_deal_id_fkey";
            columns: ["source_deal_id"];
            isOneToOne: false;
            referencedRelation: "deals";
            referencedColumns: ["id"];
          },
        ];
      };
      job_applications: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          links: string | null;
          message: string | null;
          name: string;
          phone: string | null;
          role: string | null;
          status: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          links?: string | null;
          message?: string | null;
          name: string;
          phone?: string | null;
          role?: string | null;
          status?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          links?: string | null;
          message?: string | null;
          name?: string;
          phone?: string | null;
          role?: string | null;
          status?: string;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          assigned_to: string | null;
          attribution: Json;
          budget: string | null;
          captured_at: string;
          company: string | null;
          consent_at: string | null;
          consent_given: boolean | null;
          consent_text: string | null;
          created_at: string;
          description: string | null;
          email: string;
          id: string;
          last_touch_at: string | null;
          name: string | null;
          owner_id: string | null;
          qualification: Json | null;
          qualified_at: string | null;
          source: string | null;
          source_detail: string | null;
          status: string;
          synthetic: boolean;
          timeline: string | null;
        };
        Insert: {
          assigned_to?: string | null;
          attribution?: Json;
          budget?: string | null;
          captured_at?: string;
          company?: string | null;
          consent_at?: string | null;
          consent_given?: boolean | null;
          consent_text?: string | null;
          created_at?: string;
          description?: string | null;
          email: string;
          id?: string;
          last_touch_at?: string | null;
          name?: string | null;
          owner_id?: string | null;
          qualification?: Json | null;
          qualified_at?: string | null;
          source?: string | null;
          source_detail?: string | null;
          status?: string;
          synthetic?: boolean;
          timeline?: string | null;
        };
        Update: {
          assigned_to?: string | null;
          attribution?: Json;
          budget?: string | null;
          captured_at?: string;
          company?: string | null;
          consent_at?: string | null;
          consent_given?: boolean | null;
          consent_text?: string | null;
          created_at?: string;
          description?: string | null;
          email?: string;
          id?: string;
          last_touch_at?: string | null;
          name?: string | null;
          owner_id?: string | null;
          qualification?: Json | null;
          qualified_at?: string | null;
          source?: string | null;
          source_detail?: string | null;
          status?: string;
          synthetic?: boolean;
          timeline?: string | null;
        };
        Relationships: [];
      };
      mail_accounts: {
        Row: {
          access_token_enc: string | null;
          connected_by: string | null;
          created_at: string;
          email: string;
          google_sub: string | null;
          history_id: string | null;
          id: string;
          provider: string;
          refresh_token_enc: string | null;
          signature_html: string | null;
          status: string;
          token_expires_at: string | null;
          updated_at: string;
        };
        Insert: {
          access_token_enc?: string | null;
          connected_by?: string | null;
          created_at?: string;
          email: string;
          google_sub?: string | null;
          history_id?: string | null;
          id?: string;
          provider?: string;
          refresh_token_enc?: string | null;
          signature_html?: string | null;
          status?: string;
          token_expires_at?: string | null;
          updated_at?: string;
        };
        Update: {
          access_token_enc?: string | null;
          connected_by?: string | null;
          created_at?: string;
          email?: string;
          google_sub?: string | null;
          history_id?: string | null;
          id?: string;
          provider?: string;
          refresh_token_enc?: string | null;
          signature_html?: string | null;
          status?: string;
          token_expires_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      mail_messages: {
        Row: {
          cc_emails: string[];
          created_at: string;
          direction: string;
          from_email: string | null;
          from_name: string | null;
          gmail_message_id: string;
          has_attachments: boolean;
          id: string;
          sent_at: string | null;
          snippet: string | null;
          thread_id: string;
          to_emails: string[];
        };
        Insert: {
          cc_emails?: string[];
          created_at?: string;
          direction: string;
          from_email?: string | null;
          from_name?: string | null;
          gmail_message_id: string;
          has_attachments?: boolean;
          id?: string;
          sent_at?: string | null;
          snippet?: string | null;
          thread_id: string;
          to_emails?: string[];
        };
        Update: {
          cc_emails?: string[];
          created_at?: string;
          direction?: string;
          from_email?: string | null;
          from_name?: string | null;
          gmail_message_id?: string;
          has_attachments?: boolean;
          id?: string;
          sent_at?: string | null;
          snippet?: string | null;
          thread_id?: string;
          to_emails?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "mail_messages_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "mail_threads";
            referencedColumns: ["id"];
          },
        ];
      };
      mail_threads: {
        Row: {
          account_id: string;
          company_id: string | null;
          contact_id: string | null;
          created_at: string;
          deal_id: string | null;
          gmail_thread_id: string;
          id: string;
          labels: string[];
          last_message_at: string | null;
          message_count: number;
          participants: string[];
          snippet: string | null;
          subject: string | null;
          unread: boolean;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          company_id?: string | null;
          contact_id?: string | null;
          created_at?: string;
          deal_id?: string | null;
          gmail_thread_id: string;
          id?: string;
          labels?: string[];
          last_message_at?: string | null;
          message_count?: number;
          participants?: string[];
          snippet?: string | null;
          subject?: string | null;
          unread?: boolean;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          company_id?: string | null;
          contact_id?: string | null;
          created_at?: string;
          deal_id?: string | null;
          gmail_thread_id?: string;
          id?: string;
          labels?: string[];
          last_message_at?: string | null;
          message_count?: number;
          participants?: string[];
          snippet?: string | null;
          subject?: string | null;
          unread?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mail_threads_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "mail_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mail_threads_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mail_threads_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mail_threads_deal_id_fkey";
            columns: ["deal_id"];
            isOneToOne: false;
            referencedRelation: "deals";
            referencedColumns: ["id"];
          },
        ];
      };
      newsletter_issues: {
        Row: {
          body: Json;
          created_at: string;
          id: string;
          scheduled_at: string | null;
          sent_at: string | null;
          status: string;
          synthetic: boolean;
          title: string;
          updated_at: string;
        };
        Insert: {
          body?: Json;
          created_at?: string;
          id?: string;
          scheduled_at?: string | null;
          sent_at?: string | null;
          status?: string;
          synthetic?: boolean;
          title: string;
          updated_at?: string;
        };
        Update: {
          body?: Json;
          created_at?: string;
          id?: string;
          scheduled_at?: string | null;
          sent_at?: string | null;
          status?: string;
          synthetic?: boolean;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      newsletter_sends: {
        Row: {
          created_at: string;
          id: number;
          issue_id: string;
          status: string;
          subscriber_id: string;
        };
        Insert: {
          created_at?: string;
          id?: never;
          issue_id: string;
          status?: string;
          subscriber_id: string;
        };
        Update: {
          created_at?: string;
          id?: never;
          issue_id?: string;
          status?: string;
          subscriber_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "newsletter_sends_issue_id_fkey";
            columns: ["issue_id"];
            isOneToOne: false;
            referencedRelation: "newsletter_issues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "newsletter_sends_subscriber_id_fkey";
            columns: ["subscriber_id"];
            isOneToOne: false;
            referencedRelation: "newsletter_subscribers";
            referencedColumns: ["id"];
          },
        ];
      };
      newsletter_subscribers: {
        Row: {
          confirm_token: string | null;
          confirm_token_issued_at: string | null;
          consent_at: string | null;
          consent_source: string | null;
          created_at: string;
          email: string;
          id: string;
          status: string;
          synthetic: boolean;
          updated_at: string;
        };
        Insert: {
          confirm_token?: string | null;
          confirm_token_issued_at?: string | null;
          consent_at?: string | null;
          consent_source?: string | null;
          created_at?: string;
          email: string;
          id?: string;
          status?: string;
          synthetic?: boolean;
          updated_at?: string;
        };
        Update: {
          confirm_token?: string | null;
          confirm_token_issued_at?: string | null;
          consent_at?: string | null;
          consent_source?: string | null;
          created_at?: string;
          email?: string;
          id?: string;
          status?: string;
          synthetic?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      notes: {
        Row: {
          company_id: string | null;
          content: string | null;
          created_at: string;
          id: string;
          lead_id: string | null;
          metadata: Json;
          owner_id: string | null;
          source: string;
          source_record_id: string | null;
          synthetic: boolean;
          title: string | null;
          updated_at: string;
        };
        Insert: {
          company_id?: string | null;
          content?: string | null;
          created_at?: string;
          id?: string;
          lead_id?: string | null;
          metadata?: Json;
          owner_id?: string | null;
          source?: string;
          source_record_id?: string | null;
          synthetic?: boolean;
          title?: string | null;
          updated_at?: string;
        };
        Update: {
          company_id?: string | null;
          content?: string | null;
          created_at?: string;
          id?: string;
          lead_id?: string | null;
          metadata?: Json;
          owner_id?: string | null;
          source?: string;
          source_record_id?: string | null;
          synthetic?: boolean;
          title?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notes_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notes_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };
      operator_approvals: {
        Row: {
          action: string;
          approved_at: string | null;
          consumed_at: string | null;
          decided_by: string | null;
          decision_reason: string | null;
          expires_at: string;
          id: string;
          payload: Json;
          payload_hash: string;
          rejected_at: string | null;
          requested_at: string;
          revoked_at: string | null;
          run_id: string;
        };
        Insert: {
          action: string;
          approved_at?: string | null;
          consumed_at?: string | null;
          decided_by?: string | null;
          decision_reason?: string | null;
          expires_at: string;
          id?: string;
          payload: Json;
          payload_hash: string;
          rejected_at?: string | null;
          requested_at?: string;
          revoked_at?: string | null;
          run_id: string;
        };
        Update: {
          action?: string;
          approved_at?: string | null;
          consumed_at?: string | null;
          decided_by?: string | null;
          decision_reason?: string | null;
          expires_at?: string;
          id?: string;
          payload?: Json;
          payload_hash?: string;
          rejected_at?: string | null;
          requested_at?: string;
          revoked_at?: string | null;
          run_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "operator_approvals_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "operator_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      operator_audit_events: {
        Row: {
          created_at: string;
          details: Json;
          event_type: string;
          id: number;
          operator_key: string;
          run_id: string | null;
        };
        Insert: {
          created_at?: string;
          details?: Json;
          event_type: string;
          id?: never;
          operator_key: string;
          run_id?: string | null;
        };
        Update: {
          created_at?: string;
          details?: Json;
          event_type?: string;
          id?: never;
          operator_key?: string;
          run_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "operator_audit_events_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "operator_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      operator_controls: {
        Row: {
          allowed_modes: Database["public"]["Enums"]["operator_mode"][];
          enabled: boolean;
          operator_key: string;
          updated_at: string;
        };
        Insert: {
          allowed_modes?: Database["public"]["Enums"]["operator_mode"][];
          enabled?: boolean;
          operator_key: string;
          updated_at?: string;
        };
        Update: {
          allowed_modes?: Database["public"]["Enums"]["operator_mode"][];
          enabled?: boolean;
          operator_key?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      operator_idempotency: {
        Row: {
          claimed_at: string;
          key: string;
        };
        Insert: {
          claimed_at?: string;
          key: string;
        };
        Update: {
          claimed_at?: string;
          key?: string;
        };
        Relationships: [];
      };
      operator_runs: {
        Row: {
          compliance_result: Json | null;
          dataset_id: string | null;
          draft_result: Json | null;
          finished_at: string | null;
          id: string;
          idempotency_key: string;
          lead_id: string | null;
          mode: Database["public"]["Enums"]["operator_mode"];
          operator_key: string;
          started_at: string;
          status: Database["public"]["Enums"]["operator_run_status"];
        };
        Insert: {
          compliance_result?: Json | null;
          dataset_id?: string | null;
          draft_result?: Json | null;
          finished_at?: string | null;
          id?: string;
          idempotency_key: string;
          lead_id?: string | null;
          mode: Database["public"]["Enums"]["operator_mode"];
          operator_key: string;
          started_at?: string;
          status?: Database["public"]["Enums"]["operator_run_status"];
        };
        Update: {
          compliance_result?: Json | null;
          dataset_id?: string | null;
          draft_result?: Json | null;
          finished_at?: string | null;
          id?: string;
          idempotency_key?: string;
          lead_id?: string | null;
          mode?: Database["public"]["Enums"]["operator_mode"];
          operator_key?: string;
          started_at?: string;
          status?: Database["public"]["Enums"]["operator_run_status"];
        };
        Relationships: [
          {
            foreignKeyName: "operator_runs_dataset_id_fkey";
            columns: ["dataset_id"];
            isOneToOne: false;
            referencedRelation: "synthetic_datasets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "operator_runs_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "operator_runs_operator_key_fkey";
            columns: ["operator_key"];
            isOneToOne: false;
            referencedRelation: "operator_controls";
            referencedColumns: ["operator_key"];
          },
        ];
      };
      operator_system_control: {
        Row: {
          id: string;
          operators_enabled: boolean;
          outbound_enabled: boolean;
          reason: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          operators_enabled?: boolean;
          outbound_enabled?: boolean;
          reason?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          operators_enabled?: boolean;
          outbound_enabled?: boolean;
          reason?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pipeline_stages: {
        Row: {
          artifact: string;
          detail: string | null;
          gate: string;
          name: string;
          sort_order: number;
          stage_number: number;
        };
        Insert: {
          artifact: string;
          detail?: string | null;
          gate: string;
          name: string;
          sort_order: number;
          stage_number: number;
        };
        Update: {
          artifact?: string;
          detail?: string | null;
          gate?: string;
          name?: string;
          sort_order?: number;
          stage_number?: number;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          client_id: string;
          created_at: string;
          deal_id: string | null;
          id: string;
          name: string;
          owner_id: string | null;
          synthetic: boolean;
        };
        Insert: {
          client_id: string;
          created_at?: string;
          deal_id?: string | null;
          id?: string;
          name: string;
          owner_id?: string | null;
          synthetic?: boolean;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          deal_id?: string | null;
          id?: string;
          name?: string;
          owner_id?: string | null;
          synthetic?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_deal_id_fkey";
            columns: ["deal_id"];
            isOneToOne: false;
            referencedRelation: "deals";
            referencedColumns: ["id"];
          },
        ];
      };
      referral_partners: {
        Row: {
          contact_email: string | null;
          created_at: string;
          id: string;
          kind: string;
          name: string;
          notes: string | null;
          synthetic: boolean;
          updated_at: string;
        };
        Insert: {
          contact_email?: string | null;
          created_at?: string;
          id?: string;
          kind?: string;
          name: string;
          notes?: string | null;
          synthetic?: boolean;
          updated_at?: string;
        };
        Update: {
          contact_email?: string | null;
          created_at?: string;
          id?: string;
          kind?: string;
          name?: string;
          notes?: string | null;
          synthetic?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      referrals: {
        Row: {
          amount: number | null;
          company_name: string | null;
          created_at: string;
          id: string;
          invoice_id: string | null;
          lead_id: string | null;
          owner_id: string | null;
          paid_at: string | null;
          partner_id: string | null;
          reward_note: string | null;
          status: string;
          synthetic: boolean;
          updated_at: string;
        };
        Insert: {
          amount?: number | null;
          company_name?: string | null;
          created_at?: string;
          id?: string;
          invoice_id?: string | null;
          lead_id?: string | null;
          owner_id?: string | null;
          paid_at?: string | null;
          partner_id?: string | null;
          reward_note?: string | null;
          status?: string;
          synthetic?: boolean;
          updated_at?: string;
        };
        Update: {
          amount?: number | null;
          company_name?: string | null;
          created_at?: string;
          id?: string;
          invoice_id?: string | null;
          lead_id?: string | null;
          owner_id?: string | null;
          paid_at?: string | null;
          partner_id?: string | null;
          reward_note?: string | null;
          status?: string;
          synthetic?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "referrals_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "referrals_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "referrals_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "referral_partners";
            referencedColumns: ["id"];
          },
        ];
      };
      review_requests: {
        Row: {
          created_at: string;
          id: string;
          status: string;
          subject_ref: string | null;
          subject_type: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          status?: string;
          subject_ref?: string | null;
          subject_type?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          status?: string;
          subject_ref?: string | null;
          subject_type?: string | null;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          author_name: string | null;
          created_at: string;
          id: string;
          permission_obtained: boolean;
          quote: string | null;
          rating: number | null;
          source: string | null;
          status: string;
          subject: string | null;
          synthetic: boolean;
          updated_at: string;
        };
        Insert: {
          author_name?: string | null;
          created_at?: string;
          id?: string;
          permission_obtained?: boolean;
          quote?: string | null;
          rating?: number | null;
          source?: string | null;
          status?: string;
          subject?: string | null;
          synthetic?: boolean;
          updated_at?: string;
        };
        Update: {
          author_name?: string | null;
          created_at?: string;
          id?: string;
          permission_obtained?: boolean;
          quote?: string | null;
          rating?: number | null;
          source?: string | null;
          status?: string;
          subject?: string | null;
          synthetic?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      synthetic_datasets: {
        Row: {
          created_at: string;
          data: Json;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          data?: Json;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          data?: Json;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          assigned_to: string | null;
          company_id: string | null;
          content: string | null;
          created_at: string;
          deadline_at: string | null;
          id: string;
          is_completed: boolean;
          metadata: Json;
          owner_id: string | null;
          source: string;
          source_record_id: string | null;
          synthetic: boolean;
          updated_at: string;
        };
        Insert: {
          assigned_to?: string | null;
          company_id?: string | null;
          content?: string | null;
          created_at?: string;
          deadline_at?: string | null;
          id?: string;
          is_completed?: boolean;
          metadata?: Json;
          owner_id?: string | null;
          source?: string;
          source_record_id?: string | null;
          synthetic?: boolean;
          updated_at?: string;
        };
        Update: {
          assigned_to?: string | null;
          company_id?: string | null;
          content?: string | null;
          created_at?: string;
          deadline_at?: string | null;
          id?: string;
          is_completed?: boolean;
          metadata?: Json;
          owner_id?: string | null;
          source?: string;
          source_record_id?: string | null;
          synthetic?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      touchpoints: {
        Row: {
          client_id: string | null;
          content: Json;
          created_at: string;
          id: string;
          kind: string;
          lead_id: string | null;
          project_id: string | null;
          synthetic: boolean;
        };
        Insert: {
          client_id?: string | null;
          content?: Json;
          created_at?: string;
          id?: string;
          kind: string;
          lead_id?: string | null;
          project_id?: string | null;
          synthetic?: boolean;
        };
        Update: {
          client_id?: string | null;
          content?: Json;
          created_at?: string;
          id?: string;
          kind?: string;
          lead_id?: string | null;
          project_id?: string | null;
          synthetic?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "touchpoints_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "touchpoints_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "touchpoints_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      activity_snapshot: { Args: never; Returns: Json };
      agent_require: { Args: { p_capability: string }; Returns: undefined };
      append_operator_audit_event: {
        Args: {
          p_details: Json;
          p_event_type: string;
          p_operator_key: string;
          p_run_id: string;
        };
        Returns: number;
      };
      approval_decide: {
        Args: {
          p_decided_by: string;
          p_decision: string;
          p_id: string;
          p_reason: string;
        };
        Returns: boolean;
      };
      approval_mark_executed: {
        Args: { p_id: string; p_result: Json };
        Returns: boolean;
      };
      approval_queue_list: {
        Args: { p_status: string };
        Returns: {
          action_type: string;
          agent_name: string;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          decision_reason: string | null;
          execution_result: Json | null;
          expires_at: string | null;
          id: string;
          proposed_payload: Json;
          requested_at: string;
          risk_level: string;
          status: string;
          summary: string;
          synthetic: boolean;
          target_id: string | null;
          target_type: string | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "approval_queue";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      approval_request: {
        Args: {
          p_action_type: string;
          p_agent_name: string;
          p_expires_at: string;
          p_payload: Json;
          p_risk_level: string;
          p_summary: string;
          p_target_id: string;
          p_target_type: string;
        };
        Returns: string;
      };
      attribution_snapshot: { Args: never; Returns: Json };
      campaign_claim_due: {
        Args: { p_lease_seconds: number; p_limit: number };
        Returns: Json;
      };
      campaign_claim_step: {
        Args: {
          p_enrollment_id: string;
          p_max_attempts?: number;
          p_stale_seconds?: number;
          p_step_order: number;
        };
        Returns: string;
      };
      campaign_enroll_lead: {
        Args: { p_campaign_id: string; p_lead_id: string };
        Returns: string;
      };
      campaign_mark_by_message: {
        Args: {
          p_details?: Json;
          p_event_type?: string;
          p_provider_message_id: string;
          p_status: string;
        };
        Returns: undefined;
      };
      campaign_mark_status: {
        Args: {
          p_advance?: boolean;
          p_details?: Json;
          p_enrollment_id: string;
          p_event_type?: string;
          p_status: string;
        };
        Returns: undefined;
      };
      campaign_record_event: {
        Args: { p_details: Json; p_enrollment_id: string; p_event_type: string };
        Returns: number;
      };
      campaign_record_result: {
        Args: {
          p_enrollment_id: string;
          p_error?: string;
          p_provider_message_id?: string;
          p_status: string;
          p_step_order: number;
        };
        Returns: undefined;
      };
      campaign_snapshot: { Args: never; Returns: Json };
      campaign_upsert: {
        Args: {
          p_audience: Json;
          p_channel: string;
          p_goal: string;
          p_id: string;
          p_name: string;
          p_owner: string;
          p_status: string;
        };
        Returns: string;
      };
      capture_job_application: { Args: { p_payload: Json }; Returns: Json };
      capture_website_lead: { Args: { p_payload: Json }; Returns: Json };
      channel_auth_record: {
        Args: {
          p_client_ip: string;
          p_outcome: string;
          p_presented_via: string;
          p_surface: string;
          p_user_agent: string;
        };
        Returns: undefined;
      };
      channel_auth_too_many_failures: {
        Args: {
          p_client_ip: string;
          p_max?: number;
          p_surface: string;
          p_window_seconds?: number;
        };
        Returns: boolean;
      };
      check_operator_control: {
        Args: {
          p_mode: Database["public"]["Enums"]["operator_mode"];
          p_operator_key: string;
        };
        Returns: boolean;
      };
      client_create: {
        Args: {
          p_ai_processing_allowed: boolean;
          p_deal_id: string;
          p_lead_id: string;
          p_name: string;
          p_owner_id: string;
        };
        Returns: string;
      };
      company_upsert: {
        Args: {
          p_categories: Json;
          p_description: string;
          p_domain: string;
          p_employee_range: string;
          p_location: string;
          p_metadata: Json;
          p_name: string;
          p_socials: Json;
          p_source: string;
          p_source_record_id: string;
        };
        Returns: string;
      };
      contact_upsert: {
        Args: {
          p_company_id: string;
          p_email: string;
          p_job_title: string;
          p_metadata: Json;
          p_name: string;
          p_phone: string;
          p_socials: Json;
          p_source: string;
          p_source_record_id: string;
        };
        Returns: string;
      };
      convert_won_deal: { Args: { p_payload: Json }; Returns: Json };
      crm_assign: {
        Args: {
          p_column: string;
          p_id: string;
          p_table: string;
          p_user_id: string;
        };
        Returns: undefined;
      };
      deal_advance_stage: {
        Args: {
          p_actor: string;
          p_deal_id: string;
          p_note: string;
          p_to_stage: string;
        };
        Returns: Json;
      };
      deal_deposit_paid: { Args: { p_deal_id: string }; Returns: boolean };
      deal_has_signed_sow: { Args: { p_deal_id: string }; Returns: boolean };
      deal_link_lead: {
        Args: { p_deal_id: string; p_lead_id: string };
        Returns: undefined;
      };
      deal_upsert: {
        Args: {
          p_company_id: string;
          p_metadata: Json;
          p_name: string;
          p_source: string;
          p_source_record_id: string;
          p_stage: string;
          p_value_usd: number;
        };
        Returns: string;
      };
      demo_requests_pending: {
        Args: never;
        Returns: {
          address: string;
          business_name: string;
          id: string;
          vertical: string;
        }[];
      };
      demo_site_request: {
        Args: {
          p_address: string;
          p_business_name: string;
          p_company_id: string;
          p_deal_id: string;
          p_requested_by: string;
          p_vertical: string;
        };
        Returns: string;
      };
      demo_site_set_result: {
        Args: { p_error: string; p_id: string; p_status: string; p_url: string };
        Returns: undefined;
      };
      demo_sites_for_company: {
        Args: { p_company_id: string };
        Returns: {
          address: string | null;
          business_name: string;
          company_id: string | null;
          created_at: string;
          deal_id: string | null;
          error: string | null;
          id: string;
          requested_by: string | null;
          status: string;
          updated_at: string;
          url: string | null;
          vertical: string | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "demo_sites";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      demo_sites_for_deal: {
        Args: { p_deal_id: string };
        Returns: {
          address: string | null;
          business_name: string;
          company_id: string | null;
          created_at: string;
          deal_id: string | null;
          error: string | null;
          id: string;
          requested_by: string | null;
          status: string;
          updated_at: string;
          url: string | null;
          vertical: string | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "demo_sites";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      document_create: {
        Args: {
          p_body: string;
          p_body_hash: string;
          p_deal_id: string;
          p_doc_type: string;
          p_owner_id: string;
          p_project_id: string;
          p_stage_number: number;
          p_template_id: string;
          p_title: string;
        };
        Returns: string;
      };
      document_find_by_token: { Args: { p_token: string }; Returns: Json };
      document_list_for_deal: { Args: { p_deal_id: string }; Returns: Json };
      document_mark_signed: {
        Args: {
          p_consent_text: string;
          p_id: string;
          p_ip: string;
          p_signed_name: string;
          p_user_agent: string;
        };
        Returns: boolean;
      };
      document_mark_viewed: { Args: { p_id: string }; Returns: undefined };
      document_request_signature: {
        Args: {
          p_document_id: string;
          p_expected_hash: string;
          p_recipient_email: string;
          p_recipient_name: string;
          p_sent_by: string;
        };
        Returns: Json;
      };
      document_update_body: {
        Args: {
          p_body: string;
          p_body_hash: string;
          p_id: string;
          p_status: string;
        };
        Returns: undefined;
      };
      giveaway_entries_list: {
        Args: never;
        Returns: {
          about: string | null;
          agreed_rules: boolean;
          business_name: string;
          city: string | null;
          consent_at: string;
          consent_text_version: string | null;
          contact_name: string;
          created_at: string;
          email: string;
          email_marketing_consent: boolean;
          id: string;
          ip: string | null;
          phone: string | null;
          sms_consent: boolean;
          source: string;
          user_agent: string | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "giveaway_entries";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      giveaway_entry_create: {
        Args: {
          p_about: string;
          p_agreed_rules: boolean;
          p_business_name: string;
          p_city: string;
          p_consent_text_version: string;
          p_contact_name: string;
          p_email: string;
          p_email_marketing_consent: boolean;
          p_ip: string;
          p_phone: string;
          p_sms_consent: boolean;
          p_user_agent: string;
        };
        Returns: string;
      };
      invoice_create: {
        Args: {
          p_amount_cents: number;
          p_currency: string;
          p_due_at: string;
          p_project_id: string;
          p_status: string;
        };
        Returns: string;
      };
      is_approved_recipient: {
        Args: { p_address: string; p_sop: string };
        Returns: boolean;
      };
      lead_set_status: {
        Args: { p_lead_id: string; p_status: string };
        Returns: undefined;
      };
      leads_list: { Args: { p_limit?: number }; Returns: Json };
      mail_account_connect: {
        Args: {
          p_access_token_enc: string;
          p_connected_by: string;
          p_email: string;
          p_google_sub: string;
          p_refresh_token_enc: string;
          p_token_expires_at: string;
        };
        Returns: string;
      };
      mail_account_for_sync: {
        Args: never;
        Returns: {
          email: string;
          history_id: string;
          id: string;
          refresh_token_enc: string;
        }[];
      };
      mail_account_set_history_id: {
        Args: { p_account_id: string; p_history_id: string };
        Returns: undefined;
      };
      mail_account_set_status: {
        Args: { p_account_id: string; p_status: string };
        Returns: undefined;
      };
      mail_account_status: {
        Args: never;
        Returns: {
          email: string;
          status: string;
        }[];
      };
      mail_inbox_list: {
        Args: { p_limit: number; p_offset: number };
        Returns: {
          company_id: string;
          company_name: string;
          contact_id: string;
          contact_name: string;
          deal_id: string;
          deal_name: string;
          gmail_thread_id: string;
          id: string;
          last_message_at: string;
          message_count: number;
          participants: string[];
          snippet: string;
          subject: string;
          unread: boolean;
        }[];
      };
      mail_sync_upsert_messages: {
        Args: { p_messages: Json; p_thread_id: string };
        Returns: number;
      };
      mail_sync_upsert_thread: {
        Args: {
          p_account_id: string;
          p_gmail_thread_id: string;
          p_labels: string[];
          p_last_message_at: string;
          p_participants: string[];
          p_snippet: string;
          p_subject: string;
          p_unread: boolean;
        };
        Returns: string;
      };
      mail_threads_for_contact: {
        Args: { p_contact_id: string };
        Returns: {
          account_id: string;
          company_id: string | null;
          contact_id: string | null;
          created_at: string;
          deal_id: string | null;
          gmail_thread_id: string;
          id: string;
          labels: string[];
          last_message_at: string | null;
          message_count: number;
          participants: string[];
          snippet: string | null;
          subject: string | null;
          unread: boolean;
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "mail_threads";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      mail_threads_for_deal: {
        Args: { p_deal_id: string };
        Returns: {
          account_id: string;
          company_id: string | null;
          contact_id: string | null;
          created_at: string;
          deal_id: string | null;
          gmail_thread_id: string;
          id: string;
          labels: string[];
          last_message_at: string | null;
          message_count: number;
          participants: string[];
          snippet: string | null;
          subject: string | null;
          unread: boolean;
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "mail_threads";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      newsletter_confirm: {
        Args: { p_token: string; p_ttl_hours?: number };
        Returns: boolean;
      };
      newsletter_eligible_recipients: {
        Args: { p_issue_id: string };
        Returns: {
          email: string;
          subscriber_id: string;
        }[];
      };
      newsletter_snapshot: { Args: never; Returns: Json };
      newsletter_subscribe: {
        Args: { p_consent_source: string; p_email: string };
        Returns: Json;
      };
      newsletter_unsubscribe: { Args: { p_email: string }; Returns: boolean };
      note_upsert: {
        Args: {
          p_company_id: string;
          p_content: string;
          p_lead_id?: string;
          p_metadata: Json;
          p_source: string;
          p_source_record_id: string;
          p_title: string;
        };
        Returns: string;
      };
      operator_approve_synthetic_draft: {
        Args: {
          p_actor: string;
          p_expected_hash: string;
          p_id: string;
          p_reason: string;
        };
        Returns: boolean;
      };
      operator_claim_idempotency: { Args: { p_key: string }; Returns: boolean };
      operator_client_allows_ai: {
        Args: { p_client_id: string };
        Returns: boolean;
      };
      operator_consume_approval: {
        Args: { p_at: string; p_expected_hash: string; p_id: string };
        Returns: boolean;
      };
      operator_create_synthetic_lead_run: {
        Args: { p_idempotency_key: string; p_lead: Json };
        Returns: Json;
      };
      operator_dashboard_snapshot: { Args: never; Returns: Json };
      operator_decide_synthetic_draft: {
        Args: {
          p_actor: string;
          p_decision: string;
          p_expected_hash: string;
          p_id: string;
          p_reason: string;
        };
        Returns: boolean;
      };
      operator_get_approval: { Args: { p_id: string }; Returns: Json };
      operator_get_controls: { Args: { p_operator_key: string }; Returns: Json };
      operator_get_system_control: { Args: never; Returns: Json };
      operator_is_suppressed: { Args: { p_address: string }; Returns: boolean };
      operator_jsonb_exact_keys: {
        Args: { p_keys: string[]; p_value: Json };
        Returns: boolean;
      };
      operator_record_synthetic_cfo: {
        Args: { p_result: Json; p_run_id: string };
        Returns: Json;
      };
      operator_record_synthetic_draft_approval: {
        Args: { p_draft: Json; p_expires_at: string; p_run_id: string };
        Returns: Json;
      };
      operator_reject_synthetic_draft: {
        Args: {
          p_actor: string;
          p_expected_hash: string;
          p_id: string;
          p_reason: string;
        };
        Returns: boolean;
      };
      operator_safe_synthetic_text: {
        Args: { p_max: number; p_value: string };
        Returns: boolean;
      };
      pipeline_stages_list: { Args: never; Returns: Json };
      project_create: {
        Args: { p_client_id: string; p_name: string };
        Returns: string;
      };
      prospecting_snapshot: { Args: never; Returns: Json };
      referral_partner_upsert: {
        Args: {
          p_contact_email: string;
          p_id: string;
          p_kind: string;
          p_name: string;
          p_notes: string;
        };
        Returns: string;
      };
      referral_record: {
        Args: {
          p_company_name: string;
          p_lead_id: string;
          p_partner_id: string;
        };
        Returns: string;
      };
      referral_set_status: {
        Args: { p_id: string; p_status: string };
        Returns: boolean;
      };
      referral_snapshot: { Args: never; Returns: Json };
      reputation_snapshot: { Args: never; Returns: Json };
      request_operator_approval: {
        Args: {
          p_action: string;
          p_expires_at: string;
          p_payload: Json;
          p_payload_hash: string;
          p_run_id: string;
        };
        Returns: string;
      };
      review_request_record: {
        Args: { p_subject_ref: string; p_subject_type: string };
        Returns: string;
      };
      review_set_status: {
        Args: { p_id: string; p_status: string };
        Returns: boolean;
      };
      review_upsert: {
        Args: {
          p_author_name: string;
          p_id: string;
          p_permission_obtained: boolean;
          p_quote: string;
          p_rating: number;
          p_source: string;
          p_subject: string;
        };
        Returns: string;
      };
      start_operator_run: {
        Args: {
          p_dataset_id: string;
          p_idempotency_key: string;
          p_mode: Database["public"]["Enums"]["operator_mode"];
          p_operator_key: string;
        };
        Returns: string;
      };
      task_upsert: {
        Args: {
          p_company_id: string;
          p_content: string;
          p_deadline_at: string;
          p_is_completed: boolean;
          p_metadata: Json;
          p_source: string;
          p_source_record_id: string;
        };
        Returns: string;
      };
    };
    Enums: {
      operator_mode: "synthetic" | "shadow";
      operator_run_status: "running" | "awaiting_approval" | "completed" | "blocked" | "failed";
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      operator_mode: ["synthetic", "shadow"],
      operator_run_status: ["running", "awaiting_approval", "completed", "blocked", "failed"],
    },
  },
} as const;
