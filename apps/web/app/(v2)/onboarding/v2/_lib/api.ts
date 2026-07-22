import type {
  SignupRequestBody,
  SignupResponse,
  VerifyOtpRequestBody,
  VerifyOtpResponse,
  CreateOrgRequestBody,
  CreateOrgResponse,
  GetOrgResponse,
  ContactRequestBody,
  ContactResponse,
  BrandingRequestBody,
  BrandingResponse,
  ProgressResponse,
  UploadLogoResponse,
  ApiErrorResponse,
  PlanSelectionRequestBody,
  PlanSelectionResponse,
} from "@/app/api/onboarding/v2/_lib/types";

export type {
  SignupRequestBody,
  VerifyOtpRequestBody,
  CreateOrgRequestBody,
  ContactRequestBody,
  BrandingRequestBody,
  ProgressResponse,
  PlanSelectionRequestBody,
  PlanSelectionResponse,
};

const BASE = "/api/onboarding/v2";

async function send<TReq, TRes>(
  path: string,
  method: "POST" | "PATCH" | "GET",
  body?: TReq
): Promise<TRes | ApiErrorResponse> {
  const init: RequestInit = {
    method,
    credentials: "include",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  };
  const res = await fetch(`${BASE}${path}`, init);
  return res.json();
}

export const api = {
  signup: (body: SignupRequestBody) =>
    send<SignupRequestBody, SignupResponse>("/signup", "POST", body),
  verifyOtp: (body: VerifyOtpRequestBody) =>
    send<VerifyOtpRequestBody, VerifyOtpResponse>("/verify-otp", "POST", body),
  getPlanSelection: () => send<undefined, PlanSelectionResponse>("/plan", "GET"),
  savePlanSelection: (body: PlanSelectionRequestBody) =>
    send<PlanSelectionRequestBody, PlanSelectionResponse>("/plan", "POST", body),
  createOrg: (body: CreateOrgRequestBody) =>
    send<CreateOrgRequestBody, CreateOrgResponse>("/org", "POST", body),
  getOrg: () => send<undefined, GetOrgResponse>("/org", "GET"),
  patchContact: (body: ContactRequestBody) =>
    send<ContactRequestBody, ContactResponse>("/contact", "PATCH", body),
  patchBranding: (body: BrandingRequestBody) =>
    send<BrandingRequestBody, BrandingResponse>("/branding", "PATCH", body),
  progress: () => send<undefined, ProgressResponse>("/progress", "GET"),
  uploadLogo: async (file: File): Promise<UploadLogoResponse | ApiErrorResponse> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${BASE}/upload-logo`, {
      method: "POST",
      body: fd,
      credentials: "include",
      cache: "no-store",
    });
    return res.json();
  },
};

export function isErr<T extends { ok: true }>(
  r: T | ApiErrorResponse
): r is ApiErrorResponse {
  return r.ok === false;
}
