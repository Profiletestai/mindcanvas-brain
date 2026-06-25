// Pilot onboarding client API — mirrors the v2 client but targets the pilot
// route group (/api/onboarding/pilot/*) and adds the pilot activation call.
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
} from "@/app/api/onboarding/v2/_lib/types";

export type {
  SignupRequestBody,
  VerifyOtpRequestBody,
  CreateOrgRequestBody,
  ContactRequestBody,
  BrandingRequestBody,
  ProgressResponse,
};

export type ActivateResponse = {
  ok: true;
  redirect: string;
  pilot_end_date: string;
};

const BASE = "/api/onboarding/pilot";

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
  createOrg: (body: CreateOrgRequestBody) =>
    send<CreateOrgRequestBody, CreateOrgResponse>("/org", "POST", body),
  getOrg: () => send<undefined, GetOrgResponse>("/org", "GET"),
  patchContact: (body: ContactRequestBody) =>
    send<ContactRequestBody, ContactResponse>("/contact", "PATCH", body),
  patchBranding: (body: BrandingRequestBody) =>
    send<BrandingRequestBody, BrandingResponse>("/branding", "PATCH", body),
  progress: () => send<undefined, ProgressResponse>("/progress", "GET"),
  activate: () => send<undefined, ActivateResponse>("/activate", "POST"),
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
