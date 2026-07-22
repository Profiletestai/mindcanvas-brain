import type {
  SignupInput,
  VerifyOtpInput,
  OrgInput,
  ContactInput,
  BrandingInput,
  PlanSelectionInput,
} from "@/app/(v2)/onboarding/v2/_lib/schema";
import type { EngineKey } from "@/app/(v2)/onboarding/v2/_lib/engines";

// POST /api/onboarding/v2/signup
export type SignupRequestBody = SignupInput;

export interface SignupResponse {
  ok: true;
  message: string;
}

// POST /api/onboarding/v2/verify-otp
export type VerifyOtpRequestBody = VerifyOtpInput;

export interface VerifyOtpResponse {
  ok: true;
  user_id: string;
}

// GET/POST /api/onboarding/v2/plan
export type PlanSelectionRequestBody = PlanSelectionInput;

export interface PlanSelection {
  engines: EngineKey[];
  tier: number;
  /** Minimum tier the engine count allows — recomputed server-side. */
  minimum_tier: number;
  trials: Array<{ engine: EngineKey; product: string; quantity: number }>;
}

export interface PlanSelectionResponse {
  ok: true;
  selection: PlanSelection | null;
}

// POST /api/onboarding/v2/org
export type CreateOrgRequestBody = OrgInput;

export interface OrgSummary {
  id: string;
  slug: string;
  name: string;
}

export interface CreateOrgResponse {
  ok: true;
  org: OrgSummary;
}

// GET /api/onboarding/v2/org
export interface GetOrgResponse {
  ok: true;
  org: import("@/types/database.types").PortalOrg | null;
}

// PATCH /api/onboarding/v2/branding
export type BrandingRequestBody = BrandingInput;

export interface BrandingResponse {
  ok: true;
  org: import("@/types/database.types").PortalOrg;
}

// PATCH /api/onboarding/v2/contact
export type ContactRequestBody = ContactInput;

export interface ContactResponse {
  ok: true;
  org: import("@/types/database.types").PortalOrg;
}

// GET /api/onboarding/v2/progress
export type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6 | "complete";

export interface ProgressResponse {
  ok: true;
  step: OnboardingStep;
  org_id?: string;
  org_slug?: string | null;
}

// POST /api/onboarding/v2/upload-logo
export interface UploadLogoResponse {
  ok: true;
  url: string;
}

// Generic error shape all routes return
export interface ApiErrorResponse {
  ok: false;
  error: string;
}
