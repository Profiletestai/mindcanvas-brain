// apps/web/lib/mcas/reportTypes.ts

export type McasReportType =
  | "snapshot"
  | "full_career_growth"
  | "internal_decision";

export type McasOperatingStyleCode =
  | "OS1"
  | "OS2"
  | "OS3"
  | "OS4"
  | "OS5"
  | "OS6"
  | "OS7"
  | "OS8";

export type McasCoreCode =
  | "CREATE"
  | "ORGANISE"
  | "RESOLVE"
  | "EXAMINE";

export type McasCareerVerticalCode =
  | "V1"
  | "V2"
  | "V3"
  | "V4"
  | "V5"
  | "V6";

export type McasConfidenceLevel = "low" | "moderate" | "high";

export type McasAlignmentStatus =
  | "aligned"
  | "stretched"
  | "misaligned"
  | "insufficient_role_data";

export type McasDistributionItem<TCode extends string = string> = {
  code: TCode;
  label: string;
  shortLabel?: string;
  percentage: number;
  rank: number;
  band?: "dominant" | "secondary" | "tertiary" | "minimal" | "low";
  description?: string;
};

export type McasCandidateSummary = {
  applicationId: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  email: string | null;
  phone?: string | null;
};

export type McasOrganisationSummary = {
  id: string;
  name: string;
  slug?: string | null;
  branding?: {
    logoUrl?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
    accentColor?: string | null;
  };
};

export type McasAssessmentSummary = {
  assessmentId: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
};

export type McasOperatingStyleResult = {
  primary: McasDistributionItem<McasOperatingStyleCode>;
  secondary?: McasDistributionItem<McasOperatingStyleCode>;
  distribution: McasDistributionItem<McasOperatingStyleCode>[];
};

export type McasCoreResult = {
  strongest: McasDistributionItem<McasCoreCode>;
  weakest?: McasDistributionItem<McasCoreCode>;
  distribution: McasDistributionItem<McasCoreCode>[];
};

export type McasCareerVerticalResult = {
  primary: McasDistributionItem<McasCareerVerticalCode>;
  next?: McasDistributionItem<McasCareerVerticalCode>;
  distribution: McasDistributionItem<McasCareerVerticalCode>[];
  readinessLabel?: string;
  readinessPercentage?: number;
};

export type McasConfidenceSummary = {
  level: McasConfidenceLevel;
  score?: number;
  notes: string[];
};

export type McasRoleRecommendation = {
  category: string;
  title: string;
  description: string;
};

export type McasEnvironmentFit = {
  pace: string;
  autonomy: string;
  structure: string;
  workStyle: string;
};

export type McasStrength = {
  title: string;
  description: string;
  icon?: string;
};

export type McasBlindSpot = {
  title: string;
  description: string;
  managementStrategy: string;
};

export type McasSuccessGuideItem = {
  period: "days_1_30" | "days_31_60" | "days_61_90";
  title: string;
  description: string;
};

export type McasRoleBlueprintSummary = {
  id: string;
  title: string;
  department?: string | null;
  roleFamily?: string | null;
  careerVerticalMin?: number | null;
  careerVerticalMax?: number | null;
};

export type McasRoleFitSummary = {
  alignmentStatus: McasAlignmentStatus;
  fitScore?: number;
  alignmentPoints: string[];
  mismatchPoints: string[];
  sustainabilityNotes: string[];
  interviewFocusAreas: {
    title: string;
    question: string;
  }[];
};

export type McasReportAccess = {
  snapshotUnlocked: boolean;
  fullUnlocked: boolean;
  internalUnlocked: boolean;
  fullPurchaseEnabled: boolean;
};

export type McasReportPayload = {
  reportType: McasReportType;
  reportVersion: string;

  organisation: McasOrganisationSummary;
  candidate: McasCandidateSummary;
  assessment: McasAssessmentSummary;

  result: {
    scoringModel: string;
    operatingStyle: McasOperatingStyleResult;
    core: McasCoreResult;
    careerVertical: McasCareerVerticalResult;
    confidence: McasConfidenceSummary;
    flags: string[];
  };

  candidateFacing: {
    workPatternSummary: string;
    operatingStyleNarrative: string;
    strengths: McasStrength[];
    environmentFit: McasEnvironmentFit;
    roleRecommendations: McasRoleRecommendation[];
    blindSpots?: McasBlindSpot[];
    successGuide?: McasSuccessGuideItem[];
    nextStepPathway?: {
      current: string;
      next: string;
      future: string;
      developmentFocus: string[];
    };
  };

  internal?: {
    roleBlueprint?: McasRoleBlueprintSummary;
    roleFit?: McasRoleFitSummary;
    riskLevel?: "low" | "moderate" | "high";
    riskNotes?: string[];
    recommendationSummary?: string;
  };

  access: McasReportAccess;
};