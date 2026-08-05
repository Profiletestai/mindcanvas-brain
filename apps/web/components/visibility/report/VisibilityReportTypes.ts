// apps/web/components/visibility/report/VisibilityReportTypes.ts

export type Tier = "Invisible" | "Emerging" | "Established" | "Magnetic";
export type Readiness = "stabilise" | "ready_to_progress";

export type Signals = {
  tier?: Tier;
  level?: number;
  style?: string;
  readiness?: Readiness;
  pillar_scores?: Record<string, number>;
  pillar_band?: Record<string, string>;
  pillar_bands?: Record<string, string>;
  weakest_pillar?: string | null;
  strongest_pillar?: string | null;
  pattern_tags?: string[];
  overall_pct?: number | null;
};

export type Graphs = {
  tier_counts?: Record<string, number>;
  personality_points?: Record<string, number> | null;
  ladder?: { tier?: Tier; level?: number };
  pillars?: Record<string, number>;
  pillar_band?: Record<string, string>;
  pillar_bands?: Record<string, string>;
  pillar_model?: string;
};

export type ContentBlock = {
  title?: string;
  short_summary?: string;
  paragraphs?: string[];
  bullets?: string[];
  transition?: string;
};

export type Section = {
  key: string;
  title?: string;
  blocks?: ContentBlock[];
};

export type AiInsights = {
  executive_summary: string;
  what_this_means: string;
  strengths: string[];
  friction: string[];
  strategic_opportunity: string;
  plan_7_days: string[];
  plan_30_days: string[];
  closing_note: string;
};

export type VisibilityKbReport = {
  token: string;
  tid: string | null;
  sid?: string | null;
  submission_id?: string | null;
  engine_key?: string;
  version?: number;
  audience?: string;
  meta?: {
    org_name?: string | null;
    org_logo_url?: string | null;
    test_name?: string | null;
    generated_at?: string | null;
    mode?: "deterministic" | "ai" | string;
    ai_error?: string;
    scoring_mode?: string;
  };
  signals?: Signals;
  graphs?: Graphs;
  sections?: Section[];
  ai?: AiInsights | null;
  ai_meta?: any;
};

export type VisibilityKbApiResponse = {
  ok: boolean;
  data?: VisibilityKbReport;
  error?: string;
  __meta?: any;
};

export type PortalReportResponse = {
  ok: boolean;
  data?: {
    org_slug?: string;
    org_name?: string | null;
    org_logo_url?: string | null;
    test_name?: string;
    taker?: {
      id: string;
      first_name?: string | null;
      last_name?: string | null;
      email?: string | null;
    };
    link?: {
      next_steps_url?: string | null;
      show_results?: boolean | null;
      redirect_url?: string | null;
      hidden_results_message?: string | null;
      email_report?: boolean | null;
      meta?: any;
    };
  };
  error?: string;
};

export type PillarItem = {
  key: string;
  label: string;
  value: number;
  band: string;
  color: string;
};

export type ReportIndexItem = {
  id: string;
  label: string;
};