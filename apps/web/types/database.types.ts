export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  portal: {
    Tables: {
      orgs: {
        Row: {
          id: string;
          slug: string;
          name: string;
          created_at: string;
          status: string;
          last_completed_step: number;
          brand_primary: string | null;
          brand_secondary: string | null;
          brand_surface: string | null;
          brand_background: string | null;
          brand_accent: string | null;
          brand_text: string | null;
          logo_url: string | null;
          email_logo_path: string | null;
          industry: string | null;
          short_bio: string | null;
          time_zone: string | null;
          primary_contact_name: string | null;
          primary_contact_first_name: string | null;
          primary_contact_last_name: string | null;
          primary_contact_email: string | null;
          support_email: string | null;
          notification_email: string | null;
          website_url: string | null;
          website: string | null;
          phone_number: string | null;
          address: string | null;
          country: string | null;
          billing_region: string | null;
          report_from_name: string | null;
          report_from_email: string | null;
          report_signoff_line: string | null;
          report_footer_notes: string | null;
          terms_accepted_at: string | null;
          privacy_accepted_at: string | null;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          created_at?: string;
          status?: string;
          last_completed_step?: number;
          brand_primary?: string | null;
          brand_secondary?: string | null;
          brand_surface?: string | null;
          brand_background?: string | null;
          brand_accent?: string | null;
          brand_text?: string | null;
          logo_url?: string | null;
          email_logo_path?: string | null;
          industry?: string | null;
          short_bio?: string | null;
          time_zone?: string | null;
          primary_contact_name?: string | null;
          primary_contact_first_name?: string | null;
          primary_contact_last_name?: string | null;
          primary_contact_email?: string | null;
          support_email?: string | null;
          notification_email?: string | null;
          website_url?: string | null;
          website?: string | null;
          phone_number?: string | null;
          address?: string | null;
          country?: string | null;
          billing_region?: string | null;
          report_from_name?: string | null;
          report_from_email?: string | null;
          report_signoff_line?: string | null;
          report_footer_notes?: string | null;
          terms_accepted_at?: string | null;
          privacy_accepted_at?: string | null;
        };
        Update: {
          slug?: string;
          name?: string;
          status?: string;
          last_completed_step?: number;
          brand_primary?: string | null;
          brand_secondary?: string | null;
          brand_surface?: string | null;
          brand_background?: string | null;
          brand_accent?: string | null;
          brand_text?: string | null;
          logo_url?: string | null;
          email_logo_path?: string | null;
          industry?: string | null;
          short_bio?: string | null;
          time_zone?: string | null;
          primary_contact_name?: string | null;
          primary_contact_first_name?: string | null;
          primary_contact_last_name?: string | null;
          primary_contact_email?: string | null;
          support_email?: string | null;
          notification_email?: string | null;
          website_url?: string | null;
          website?: string | null;
          phone_number?: string | null;
          address?: string | null;
          country?: string | null;
          billing_region?: string | null;
          report_from_name?: string | null;
          report_from_email?: string | null;
          report_signoff_line?: string | null;
          report_footer_notes?: string | null;
          terms_accepted_at?: string | null;
          privacy_accepted_at?: string | null;
        };
        Relationships: [];
      };

      user_orgs: {
        Row: {
          user_id: string;
          org_id: string;
        };
        Insert: {
          user_id: string;
          org_id: string;
        };
        Update: {
          user_id?: string;
          org_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_orgs_org_id_fkey";
            columns: ["org_id"];
            referencedRelation: "orgs";
            referencedColumns: ["id"];
          }
        ];
      };

      billing_accounts: {
        Row: {
          id: string;
          org_id: string;
          billing_type: string;
          tier: number | null;
          stripe_status: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          billing_type: string;
          tier?: number | null;
          stripe_status?: string | null;
        };
        Update: {
          billing_type?: string;
          tier?: number | null;
          stripe_status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "billing_accounts_org_id_fkey";
            columns: ["org_id"];
            referencedRelation: "orgs";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {};
    Functions: {
      fn_create_onboarding_org: {
        Args: {
          p_user_id: string;
          p_name: string;
          p_slug: string;
          p_address: string | null;
          p_country: string;
          p_billing_region: string;
          p_website_url: string | null;
          p_industry: string | null;
          p_logo_url: string | null;
        };
        Returns: string;
      };
    };
    Enums: {};
    CompositeTypes: {};
  };
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string | null;
          created_at: string | null;
          owner_user_id: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          slug?: string | null;
          owner_user_id?: string | null;
        };
        Update: {
          name?: string;
          slug?: string | null;
          owner_user_id?: string | null;
        };
        Relationships: [];
      };

      frameworks: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          version: string | null;
          created_at: string | null;
          owner_id: string | null;
          frequency_meta: Json | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          version?: string | null;
          owner_id?: string | null;
          frequency_meta?: Json | null;
        };
        Update: {
          name?: string;
          version?: string | null;
          owner_id?: string | null;
          frequency_meta?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "frameworks_org_id_fkey";
            columns: ["org_id"];
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
}

export type PortalOrg = Database["portal"]["Tables"]["orgs"]["Row"];
export type PortalOrgInsert = Database["portal"]["Tables"]["orgs"]["Insert"];
export type PortalOrgUpdate = Database["portal"]["Tables"]["orgs"]["Update"];
export type PortalUserOrg = Database["portal"]["Tables"]["user_orgs"]["Row"];
export type PortalBillingAccount = Database["portal"]["Tables"]["billing_accounts"]["Row"];
