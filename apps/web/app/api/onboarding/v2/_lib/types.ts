// POST /api/onboarding/v2/signup
export interface SignupRequestBody {
  first_name: string;
  last_name: string;
  email: string;
}

export interface SignupResponse {
  ok: true;
  message: string;
}

// POST /api/onboarding/v2/verify-otp
export interface VerifyOtpRequestBody {
  email: string;
  token: string;
}

export interface VerifyOtpResponse {
  ok: true;
  user_id: string;
}

// POST /api/onboarding/v2/org
export interface CreateOrgRequestBody {
  name: string;
  country: string;
  billing_region: string;
  address?: string;
  website_url?: string;
  industry?: string;
  logo_url?: string;
}

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
export interface BrandingRequestBody {
  primary_colour?: string;
  secondary_colour?: string;
  background_colour?: string;
  text_colour?: string;
}

export interface BrandingResponse {
  ok: true;
  org: import("@/types/database.types").PortalOrg;
}

// PATCH /api/onboarding/v2/contact
export interface ContactRequestBody {
  contact_first_name: string;
  contact_last_name: string;
  contact_email: string;
  phone_number?: string;
  support_email?: string;
  notification_email?: string;
}

export interface ContactResponse {
  ok: true;
  org: import("@/types/database.types").PortalOrg;
}

// PATCH /api/onboarding/v2/plan
export interface PlanRequestBody {
  tier: 1 | 2 | 3 | 4;
  terms_accepted: true;
  privacy_accepted: true;
}

export interface PlanResponse {
  ok: true;
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
