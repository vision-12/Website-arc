export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
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
      activity_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          actor_label: string | null;
          diff: Json | null;
          entity_id: string | null;
          entity_type: string | null;
          id: number;
          ip_hash: string | null;
          metadata: Json | null;
          occurred_at: string;
          source: Database['public']['Enums']['log_source'];
          summary: string | null;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          actor_label?: string | null;
          diff?: Json | null;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: never;
          ip_hash?: string | null;
          metadata?: Json | null;
          occurred_at?: string;
          source: Database['public']['Enums']['log_source'];
          summary?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          actor_label?: string | null;
          diff?: Json | null;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: never;
          ip_hash?: string | null;
          metadata?: Json | null;
          occurred_at?: string;
          source?: Database['public']['Enums']['log_source'];
          summary?: string | null;
        };
        Relationships: [];
      };
      admission_form_versions: {
        Row: {
          created_at: string;
          definition: NonNullable<Json>;
          form_id: string;
          id: string;
          published_at: string | null;
          published_by: string | null;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          definition: NonNullable<Json>;
          form_id: string;
          id?: string;
          published_at?: string | null;
          published_by?: string | null;
          version: number;
        };
        Update: {
          created_at?: string;
          definition?: NonNullable<Json>;
          form_id?: string;
          id?: string;
          published_at?: string | null;
          published_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'admission_form_versions_form_id_fkey';
            columns: ['form_id'];
            isOneToOne: false;
            referencedRelation: 'admission_forms';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'admission_form_versions_published_by_fkey';
            columns: ['published_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      admission_forms: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          is_default: boolean;
          name: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_default?: boolean;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_default?: boolean;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'admission_forms_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      admission_info_requests: {
        Row: {
          application_id: string;
          created_at: string;
          created_by: string | null;
          expires_at: string;
          id: string;
          message: string | null;
          requested_items: NonNullable<Json>;
          token_hash: string;
          used_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          application_id: string;
          created_at?: string;
          created_by?: string | null;
          expires_at: string;
          id?: string;
          message?: string | null;
          requested_items?: NonNullable<Json>;
          token_hash: string;
          used_at?: string | null;
        };
        Update: {
          application_id?: string;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string;
          id?: string;
          message?: string | null;
          requested_items?: NonNullable<Json>;
          token_hash?: string;
          used_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'admission_info_requests_application_id_fkey';
            columns: ['application_id'];
            isOneToOne: false;
            referencedRelation: 'applications';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'admission_info_requests_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      admission_intake_classes: {
        Row: {
          id: string;
          intake_id: string;
          label: string;
          level_id: string | null;
          sort_order: number;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          intake_id: string;
          label: string;
          level_id?: string | null;
          sort_order?: number;
        };
        Update: {
          id?: string;
          intake_id?: string;
          label?: string;
          level_id?: string | null;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'admission_intake_classes_intake_id_fkey';
            columns: ['intake_id'];
            isOneToOne: false;
            referencedRelation: 'admission_intakes';
            referencedColumns: ['id'];
          },
        ];
      };
      admission_intakes: {
        Row: {
          academic_year: number;
          capacity: number | null;
          closes_at: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          description: Json | null;
          form_version_id: string;
          id: string;
          name: string;
          opens_at: string;
          publish_at: string | null;
          published_at: string | null;
          required_documents: NonNullable<Json>;
          resource_ids: string[];
          slug: string;
          status: Database['public']['Enums']['content_status'];
          term: string | null;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          academic_year: number;
          capacity?: number | null;
          closes_at: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          description?: Json | null;
          form_version_id: string;
          id?: string;
          name: string;
          opens_at: string;
          publish_at?: string | null;
          published_at?: string | null;
          required_documents?: NonNullable<Json>;
          resource_ids?: string[];
          slug: string;
          status?: Database['public']['Enums']['content_status'];
          term?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          academic_year?: number;
          capacity?: number | null;
          closes_at?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          description?: Json | null;
          form_version_id?: string;
          id?: string;
          name?: string;
          opens_at?: string;
          publish_at?: string | null;
          published_at?: string | null;
          required_documents?: NonNullable<Json>;
          resource_ids?: string[];
          slug?: string;
          status?: Database['public']['Enums']['content_status'];
          term?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'admission_intakes_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'admission_intakes_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'admission_intakes_form_version_id_fkey';
            columns: ['form_version_id'];
            isOneToOne: false;
            referencedRelation: 'admission_form_versions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'admission_intakes_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      admission_notes: {
        Row: {
          application_id: string;
          author_id: string | null;
          body: string;
          created_at: string;
          id: string;
          status_history_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          application_id: string;
          author_id?: string | null;
          body: string;
          created_at?: string;
          id?: string;
          status_history_id?: string | null;
        };
        Update: {
          application_id?: string;
          author_id?: string | null;
          body?: string;
          created_at?: string;
          id?: string;
          status_history_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'admission_notes_application_id_fkey';
            columns: ['application_id'];
            isOneToOne: false;
            referencedRelation: 'applications';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'admission_notes_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'admission_notes_status_history_id_fkey';
            columns: ['status_history_id'];
            isOneToOne: false;
            referencedRelation: 'admission_status_history';
            referencedColumns: ['id'];
          },
        ];
      };
      admission_status_history: {
        Row: {
          application_id: string;
          changed_at: string;
          changed_by: string | null;
          from_status_id: string | null;
          id: string;
          public_message: string | null;
          to_status_id: string;
        };
        ComputedFields: never;
        Insert: {
          application_id: string;
          changed_at?: string;
          changed_by?: string | null;
          from_status_id?: string | null;
          id?: string;
          public_message?: string | null;
          to_status_id: string;
        };
        Update: {
          application_id?: string;
          changed_at?: string;
          changed_by?: string | null;
          from_status_id?: string | null;
          id?: string;
          public_message?: string | null;
          to_status_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'admission_status_history_application_id_fkey';
            columns: ['application_id'];
            isOneToOne: false;
            referencedRelation: 'applications';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'admission_status_history_changed_by_fkey';
            columns: ['changed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'admission_status_history_from_status_id_fkey';
            columns: ['from_status_id'];
            isOneToOne: false;
            referencedRelation: 'admission_statuses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'admission_status_history_to_status_id_fkey';
            columns: ['to_status_id'];
            isOneToOne: false;
            referencedRelation: 'admission_statuses';
            referencedColumns: ['id'];
          },
        ];
      };
      admission_statuses: {
        Row: {
          colour: string;
          deleted_at: string | null;
          email_template_key: string | null;
          id: string;
          is_initial: boolean;
          is_terminal: boolean;
          key: string;
          name: string;
          notify_applicant: boolean;
          outcome: string;
          public_label: string;
          sort_order: number;
        };
        ComputedFields: never;
        Insert: {
          colour: string;
          deleted_at?: string | null;
          email_template_key?: string | null;
          id?: string;
          is_initial?: boolean;
          is_terminal?: boolean;
          key: string;
          name: string;
          notify_applicant?: boolean;
          outcome: string;
          public_label: string;
          sort_order?: number;
        };
        Update: {
          colour?: string;
          deleted_at?: string | null;
          email_template_key?: string | null;
          id?: string;
          is_initial?: boolean;
          is_terminal?: boolean;
          key?: string;
          name?: string;
          notify_applicant?: boolean;
          outcome?: string;
          public_label?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      application_documents: {
        Row: {
          application_id: string;
          created_at: string;
          expires_at: string | null;
          id: string;
          info_request_id: string | null;
          mime_type: string | null;
          path: string;
          requirement_key: string;
          review: Database['public']['Enums']['document_review'];
          reviewed_at: string | null;
          reviewed_by: string | null;
          sha256: string | null;
          size_bytes: number | null;
          state: Database['public']['Enums']['upload_state'];
        };
        ComputedFields: never;
        Insert: {
          application_id: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          info_request_id?: string | null;
          mime_type?: string | null;
          path: string;
          requirement_key: string;
          review?: Database['public']['Enums']['document_review'];
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          sha256?: string | null;
          size_bytes?: number | null;
          state?: Database['public']['Enums']['upload_state'];
        };
        Update: {
          application_id?: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          info_request_id?: string | null;
          mime_type?: string | null;
          path?: string;
          requirement_key?: string;
          review?: Database['public']['Enums']['document_review'];
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          sha256?: string | null;
          size_bytes?: number | null;
          state?: Database['public']['Enums']['upload_state'];
        };
        Relationships: [
          {
            foreignKeyName: 'application_documents_info_request_id_fkey';
            columns: ['info_request_id'];
            isOneToOne: false;
            referencedRelation: 'admission_info_requests';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'application_documents_reviewed_by_fkey';
            columns: ['reviewed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      application_medical: {
        Row: {
          answers: NonNullable<Json>;
          application_id: string;
          created_at: string;
        };
        ComputedFields: never;
        Insert: {
          answers: NonNullable<Json>;
          application_id: string;
          created_at?: string;
        };
        Update: {
          answers?: NonNullable<Json>;
          application_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'application_medical_application_id_fkey';
            columns: ['application_id'];
            isOneToOne: true;
            referencedRelation: 'applications';
            referencedColumns: ['id'];
          },
        ];
      };
      application_upload_sessions: {
        Row: {
          application_id: string;
          created_at: string;
          expires_at: string;
          intake_id: string;
          ip_hash: string | null;
          submitted_at: string | null;
          token_hash: string;
        };
        ComputedFields: never;
        Insert: {
          application_id: string;
          created_at?: string;
          expires_at: string;
          intake_id: string;
          ip_hash?: string | null;
          submitted_at?: string | null;
          token_hash: string;
        };
        Update: {
          application_id?: string;
          created_at?: string;
          expires_at?: string;
          intake_id?: string;
          ip_hash?: string | null;
          submitted_at?: string | null;
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'application_upload_sessions_intake_id_fkey';
            columns: ['intake_id'];
            isOneToOne: false;
            referencedRelation: 'admission_intakes';
            referencedColumns: ['id'];
          },
        ];
      };
      applications: {
        Row: {
          anonymised_at: string | null;
          answers: NonNullable<Json>;
          applicant_dob: string;
          applicant_first_name: string;
          applicant_gender: string | null;
          applicant_last_name: string;
          applicant_other_names: string | null;
          assigned_to: string | null;
          consent_ip_hash: string;
          consent_text_version: string;
          consented_at: string;
          created_at: string;
          deleted_at: string | null;
          form_version_id: string;
          guardian_email: string;
          guardian_name: string;
          guardian_phone_e164: string;
          guardian_relationship: string;
          id: string;
          intake_class_id: string;
          intake_id: string;
          reference: string;
          status_changed_at: string;
          status_id: string;
          submitted_at: string;
          updated_at: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          anonymised_at?: string | null;
          answers?: NonNullable<Json>;
          applicant_dob: string;
          applicant_first_name: string;
          applicant_gender?: string | null;
          applicant_last_name: string;
          applicant_other_names?: string | null;
          assigned_to?: string | null;
          consent_ip_hash: string;
          consent_text_version: string;
          consented_at: string;
          created_at?: string;
          deleted_at?: string | null;
          form_version_id: string;
          guardian_email: string;
          guardian_name: string;
          guardian_phone_e164: string;
          guardian_relationship: string;
          id?: string;
          intake_class_id: string;
          intake_id: string;
          reference: string;
          status_changed_at: string;
          status_id: string;
          submitted_at: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          anonymised_at?: string | null;
          answers?: NonNullable<Json>;
          applicant_dob?: string;
          applicant_first_name?: string;
          applicant_gender?: string | null;
          applicant_last_name?: string;
          applicant_other_names?: string | null;
          assigned_to?: string | null;
          consent_ip_hash?: string;
          consent_text_version?: string;
          consented_at?: string;
          created_at?: string;
          deleted_at?: string | null;
          form_version_id?: string;
          guardian_email?: string;
          guardian_name?: string;
          guardian_phone_e164?: string;
          guardian_relationship?: string;
          id?: string;
          intake_class_id?: string;
          intake_id?: string;
          reference?: string;
          status_changed_at?: string;
          status_id?: string;
          submitted_at?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'applications_assigned_to_fkey';
            columns: ['assigned_to'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'applications_form_version_id_fkey';
            columns: ['form_version_id'];
            isOneToOne: false;
            referencedRelation: 'admission_form_versions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'applications_intake_class_id_fkey';
            columns: ['intake_class_id'];
            isOneToOne: false;
            referencedRelation: 'admission_intake_classes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'applications_intake_id_fkey';
            columns: ['intake_id'];
            isOneToOne: false;
            referencedRelation: 'admission_intakes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'applications_status_id_fkey';
            columns: ['status_id'];
            isOneToOne: false;
            referencedRelation: 'admission_statuses';
            referencedColumns: ['id'];
          },
        ];
      };
      auth_admin_jobs: {
        Row: {
          completed_at: string | null;
          created_at: string;
          error: string | null;
          id: string;
          op: string;
          payload: NonNullable<Json>;
          requested_by: string | null;
          state: string;
          target_user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          error?: string | null;
          id?: string;
          op: string;
          payload?: NonNullable<Json>;
          requested_by?: string | null;
          state?: string;
          target_user_id?: string | null;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          error?: string | null;
          id?: string;
          op?: string;
          payload?: NonNullable<Json>;
          requested_by?: string | null;
          state?: string;
          target_user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'auth_admin_jobs_requested_by_fkey';
            columns: ['requested_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'auth_admin_jobs_target_user_id_fkey';
            columns: ['target_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      contact_messages: {
        Row: {
          assigned_to: string | null;
          consent_text_version: string;
          consented_at: string;
          created_at: string;
          deleted_at: string | null;
          email: string;
          id: string;
          ip_hash: string | null;
          message: string;
          name: string;
          phone_e164: string | null;
          read_at: string | null;
          replied_at: string | null;
          status: Database['public']['Enums']['enquiry_status'];
          subject: string;
          updated_at: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          assigned_to?: string | null;
          consent_text_version: string;
          consented_at: string;
          created_at?: string;
          deleted_at?: string | null;
          email: string;
          id?: string;
          ip_hash?: string | null;
          message: string;
          name: string;
          phone_e164?: string | null;
          read_at?: string | null;
          replied_at?: string | null;
          status?: Database['public']['Enums']['enquiry_status'];
          subject: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          assigned_to?: string | null;
          consent_text_version?: string;
          consented_at?: string;
          created_at?: string;
          deleted_at?: string | null;
          email?: string;
          id?: string;
          ip_hash?: string | null;
          message?: string;
          name?: string;
          phone_e164?: string | null;
          read_at?: string | null;
          replied_at?: string | null;
          status?: Database['public']['Enums']['enquiry_status'];
          subject?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'contact_messages_assigned_to_fkey';
            columns: ['assigned_to'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      content_drafts: {
        Row: {
          base_version: number;
          data: NonNullable<Json>;
          entity_id: string;
          entity_type: string;
          updated_at: string;
          updated_by: string;
        };
        ComputedFields: never;
        Insert: {
          base_version: number;
          data: NonNullable<Json>;
          entity_id: string;
          entity_type: string;
          updated_at?: string;
          updated_by: string;
        };
        Update: {
          base_version?: number;
          data?: NonNullable<Json>;
          entity_id?: string;
          entity_type?: string;
          updated_at?: string;
          updated_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'content_drafts_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      email_messages: {
        Row: {
          attempts: number;
          created_at: string;
          delivered_at: string | null;
          entity_id: string | null;
          entity_type: string | null;
          id: string;
          last_error: string | null;
          next_attempt_at: string;
          payload: NonNullable<Json>;
          resend_id: string | null;
          sent_at: string | null;
          status: Database['public']['Enums']['email_status'];
          template_key: string;
          to_email: string;
        };
        ComputedFields: never;
        Insert: {
          attempts?: number;
          created_at?: string;
          delivered_at?: string | null;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          last_error?: string | null;
          next_attempt_at?: string;
          payload?: NonNullable<Json>;
          resend_id?: string | null;
          sent_at?: string | null;
          status?: Database['public']['Enums']['email_status'];
          template_key: string;
          to_email: string;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          delivered_at?: string | null;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          last_error?: string | null;
          next_attempt_at?: string;
          payload?: NonNullable<Json>;
          resend_id?: string | null;
          sent_at?: string | null;
          status?: Database['public']['Enums']['email_status'];
          template_key?: string;
          to_email?: string;
        };
        Relationships: [];
      };
      email_suppressions: {
        Row: {
          created_at: string;
          email_hash: string;
          reason: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          email_hash: string;
          reason: string;
        };
        Update: {
          created_at?: string;
          email_hash?: string;
          reason?: string;
        };
        Relationships: [];
      };
      enquiry_notes: {
        Row: {
          author_id: string | null;
          body: string;
          created_at: string;
          id: string;
          message_id: string;
        };
        ComputedFields: never;
        Insert: {
          author_id?: string | null;
          body: string;
          created_at?: string;
          id?: string;
          message_id: string;
        };
        Update: {
          author_id?: string | null;
          body?: string;
          created_at?: string;
          id?: string;
          message_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'enquiry_notes_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'enquiry_notes_message_id_fkey';
            columns: ['message_id'];
            isOneToOne: false;
            referencedRelation: 'contact_messages';
            referencedColumns: ['id'];
          },
        ];
      };
      media_assets: {
        Row: {
          alt_text: string | null;
          blurhash: string | null;
          bucket: string;
          caption: string | null;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          height: number | null;
          id: string;
          kind: Database['public']['Enums']['media_kind'];
          lqip: string | null;
          mime_type: string;
          original_filename: string | null;
          path: string;
          replaced_at: string | null;
          size_bytes: number;
          updated_at: string;
          uploaded_by: string | null;
          version: number;
          width: number | null;
        };
        ComputedFields: never;
        Insert: {
          alt_text?: string | null;
          blurhash?: string | null;
          bucket: string;
          caption?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          height?: number | null;
          id?: string;
          kind: Database['public']['Enums']['media_kind'];
          lqip?: string | null;
          mime_type: string;
          original_filename?: string | null;
          path: string;
          replaced_at?: string | null;
          size_bytes: number;
          updated_at?: string;
          uploaded_by?: string | null;
          version?: number;
          width?: number | null;
        };
        Update: {
          alt_text?: string | null;
          blurhash?: string | null;
          bucket?: string;
          caption?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          height?: number | null;
          id?: string;
          kind?: Database['public']['Enums']['media_kind'];
          lqip?: string | null;
          mime_type?: string;
          original_filename?: string | null;
          path?: string;
          replaced_at?: string | null;
          size_bytes?: number;
          updated_at?: string;
          uploaded_by?: string | null;
          version?: number;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'media_assets_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'media_assets_uploaded_by_fkey';
            columns: ['uploaded_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      media_usages: {
        Row: {
          entity_id: string;
          entity_type: string;
          field: string;
          media_id: string;
        };
        ComputedFields: never;
        Insert: {
          entity_id: string;
          entity_type: string;
          field: string;
          media_id: string;
        };
        Update: {
          entity_id?: string;
          entity_type?: string;
          field?: string;
          media_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'media_usages_media_id_fkey';
            columns: ['media_id'];
            isOneToOne: false;
            referencedRelation: 'media_assets';
            referencedColumns: ['id'];
          },
        ];
      };
      pages: {
        Row: {
          body: NonNullable<Json>;
          body_text: string;
          cover_media_id: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          excerpt: string | null;
          id: string;
          layout: Database['public']['Enums']['page_layout'];
          nav_order: number;
          parent_id: string | null;
          path: string;
          publish_at: string | null;
          published_at: string | null;
          search: unknown;
          seo: NonNullable<Json>;
          show_in_nav: boolean;
          slug: string;
          status: Database['public']['Enums']['content_status'];
          system_key: string | null;
          title: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          body?: NonNullable<Json>;
          body_text?: string;
          cover_media_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          excerpt?: string | null;
          id?: string;
          layout?: Database['public']['Enums']['page_layout'];
          nav_order?: number;
          parent_id?: string | null;
          path?: string;
          publish_at?: string | null;
          published_at?: string | null;
          search?: never;
          seo?: NonNullable<Json>;
          show_in_nav?: boolean;
          slug: string;
          status?: Database['public']['Enums']['content_status'];
          system_key?: string | null;
          title: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          body?: NonNullable<Json>;
          body_text?: string;
          cover_media_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          excerpt?: string | null;
          id?: string;
          layout?: Database['public']['Enums']['page_layout'];
          nav_order?: number;
          parent_id?: string | null;
          path?: string;
          publish_at?: string | null;
          published_at?: string | null;
          search?: never;
          seo?: NonNullable<Json>;
          show_in_nav?: boolean;
          slug?: string;
          status?: Database['public']['Enums']['content_status'];
          system_key?: string | null;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'pages_cover_media_id_fkey';
            columns: ['cover_media_id'];
            isOneToOne: false;
            referencedRelation: 'media_assets';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pages_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pages_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pages_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'pages';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pages_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      permissions: {
        Row: {
          action: string;
          description: string;
          is_sensitive: boolean;
          key: string;
          module: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          description: string;
          is_sensitive?: boolean;
          key: string;
          module: string;
        };
        Update: {
          action?: string;
          description?: string;
          is_sensitive?: boolean;
          key?: string;
          module?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          deactivated_at: string | null;
          deactivated_by: string | null;
          email: string;
          full_name: string;
          id: string;
          last_login_at: string | null;
          mfa_enrolled: boolean;
          status: Database['public']['Enums']['profile_status'];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          deactivated_at?: string | null;
          deactivated_by?: string | null;
          email: string;
          full_name: string;
          id: string;
          last_login_at?: string | null;
          mfa_enrolled?: boolean;
          status?: Database['public']['Enums']['profile_status'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deactivated_at?: string | null;
          deactivated_by?: string | null;
          email?: string;
          full_name?: string;
          id?: string;
          last_login_at?: string | null;
          mfa_enrolled?: boolean;
          status?: Database['public']['Enums']['profile_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_deactivated_by_fkey';
            columns: ['deactivated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      redirects: {
        Row: {
          created_at: string;
          created_by: string | null;
          from_path: string;
          id: string;
          source: Database['public']['Enums']['redirect_source'];
          status_code: number;
          to_path: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          from_path: string;
          id?: string;
          source: Database['public']['Enums']['redirect_source'];
          status_code?: number;
          to_path: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          from_path?: string;
          id?: string;
          source?: Database['public']['Enums']['redirect_source'];
          status_code?: number;
          to_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'redirects_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      retention_runs: {
        Row: {
          finished_at: string | null;
          id: string;
          job: string;
          started_at: string;
          summary: Json | null;
        };
        ComputedFields: never;
        Insert: {
          finished_at?: string | null;
          id?: string;
          job: string;
          started_at?: string;
          summary?: Json | null;
        };
        Update: {
          finished_at?: string | null;
          id?: string;
          job?: string;
          started_at?: string;
          summary?: Json | null;
        };
        Relationships: [];
      };
      role_permissions: {
        Row: {
          permission_key: string;
          role_id: string;
        };
        ComputedFields: never;
        Insert: {
          permission_key: string;
          role_id: string;
        };
        Update: {
          permission_key?: string;
          role_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'role_permissions_permission_key_fkey';
            columns: ['permission_key'];
            isOneToOne: false;
            referencedRelation: 'permissions';
            referencedColumns: ['key'];
          },
          {
            foreignKeyName: 'role_permissions_role_id_fkey';
            columns: ['role_id'];
            isOneToOne: false;
            referencedRelation: 'roles';
            referencedColumns: ['id'];
          },
        ];
      };
      roles: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          is_system: boolean;
          key: string;
          name: string;
          requires_mfa: boolean;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_system?: boolean;
          key: string;
          name: string;
          requires_mfa?: boolean;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_system?: boolean;
          key?: string;
          name?: string;
          requires_mfa?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'roles_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      site_settings: {
        Row: {
          data: NonNullable<Json>;
          id: number;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          data?: NonNullable<Json>;
          id?: number;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          data?: NonNullable<Json>;
          id?: number;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'site_settings_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      site_settings_private: {
        Row: {
          data: NonNullable<Json>;
          id: number;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          data?: NonNullable<Json>;
          id?: number;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          data?: NonNullable<Json>;
          id?: number;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'site_settings_private_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      support_access_grants: {
        Row: {
          created_at: string;
          expires_at: string;
          granted_by: string | null;
          grantee_id: string;
          id: string;
          permission_keys: string[];
          reason: string;
          revoked_at: string | null;
          revoked_by: string | null;
          starts_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          expires_at: string;
          granted_by?: string | null;
          grantee_id: string;
          id?: string;
          permission_keys: string[];
          reason: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          starts_at?: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          granted_by?: string | null;
          grantee_id?: string;
          id?: string;
          permission_keys?: string[];
          reason?: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          starts_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'support_access_grants_granted_by_fkey';
            columns: ['granted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'support_access_grants_grantee_id_fkey';
            columns: ['grantee_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'support_access_grants_revoked_by_fkey';
            columns: ['revoked_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      user_roles: {
        Row: {
          granted_at: string;
          granted_by: string | null;
          role_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          granted_at?: string;
          granted_by?: string | null;
          role_id: string;
          user_id: string;
        };
        Update: {
          granted_at?: string;
          granted_by?: string | null;
          role_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_roles_granted_by_fkey';
            columns: ['granted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_roles_role_id_fkey';
            columns: ['role_id'];
            isOneToOne: false;
            referencedRelation: 'roles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_roles_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_invite: { Args: { p_full_name: string }; Returns: undefined };
      has_permission: { Args: { p: string }; Returns: boolean };
      housekeeping: { Args: Record<PropertyKey, never>; Returns: Json };
      log_activity: {
        Args: {
          p_action: string;
          p_diff?: Json;
          p_entity_id?: string;
          p_entity_type?: string;
          p_ip_hash?: string;
          p_metadata?: Json;
          p_summary: string;
        };
        Returns: number;
      };
      my_access: { Args: Record<PropertyKey, never>; Returns: Json };
      rate_limit_check_auth: { Args: { p_payload: string; p_ticket: Json }; Returns: boolean };
      record_login: { Args: Record<PropertyKey, never>; Returns: undefined };
      revoke_user_sessions: { Args: { p_user: string }; Returns: number };
      update_private_settings: { Args: { p_value: Json; p_version: number }; Returns: number };
      update_site_settings: {
        Args: { p_section: string; p_value: Json; p_version: number };
        Returns: number;
      };
      user_has_permission: { Args: { p: string; p_user: string }; Returns: boolean };
    };
    Enums: {
      content_status: 'draft' | 'in_review' | 'scheduled' | 'published' | 'archived';
      curriculum: 'UNEB' | 'Cambridge' | 'IB' | 'Other';
      document_review: 'unreviewed' | 'accepted' | 'rejected';
      email_status:
        | 'queued'
        | 'sending'
        | 'sent'
        | 'delivered'
        | 'bounced'
        | 'complained'
        | 'failed'
        | 'suppressed';
      enquiry_status: 'new' | 'read' | 'replied' | 'archived';
      gallery_item_kind: 'image' | 'video';
      log_source: 'app' | 'db' | 'cron';
      media_kind: 'image' | 'document';
      page_layout: 'default' | 'wide' | 'with_sidebar';
      profile_status: 'invited' | 'active' | 'deactivated';
      redirect_source: 'slug_change' | 'import' | 'manual';
      upload_state: 'pending' | 'uploaded' | 'rejected' | 'expired';
      video_provider: 'youtube' | 'vimeo';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      content_status: ['draft', 'in_review', 'scheduled', 'published', 'archived'],
      curriculum: ['UNEB', 'Cambridge', 'IB', 'Other'],
      document_review: ['unreviewed', 'accepted', 'rejected'],
      email_status: [
        'queued',
        'sending',
        'sent',
        'delivered',
        'bounced',
        'complained',
        'failed',
        'suppressed',
      ],
      enquiry_status: ['new', 'read', 'replied', 'archived'],
      gallery_item_kind: ['image', 'video'],
      log_source: ['app', 'db', 'cron'],
      media_kind: ['image', 'document'],
      page_layout: ['default', 'wide', 'with_sidebar'],
      profile_status: ['invited', 'active', 'deactivated'],
      redirect_source: ['slug_change', 'import', 'manual'],
      upload_state: ['pending', 'uploaded', 'rejected', 'expired'],
      video_provider: ['youtube', 'vimeo'],
    },
  },
} as const;
