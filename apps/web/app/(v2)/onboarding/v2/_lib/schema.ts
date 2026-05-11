import { z } from "zod";
import { isValidPhoneNumber } from "libphonenumber-js";

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const OTP_RE = /^\d{6}$/;

const blankToUndef = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const optional = <T extends z.ZodTypeAny>(s: T) =>
  z.preprocess(blankToUndef, s.optional());

export const nonEmptyTrimmed = z
  .string()
  .trim()
  .min(1, { message: "Required" });

export const emailSchema = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
  z.email({ message: "Invalid email format" })
);

export const httpUrlSchema = z.url({
  protocol: /^https?$/,
  message: "Must be an http(s) URL.",
});

export const hexColorSchema = z
  .string()
  .trim()
  .regex(HEX_RE, { message: "Invalid hex colour" });

export const otpSchema = z
  .string()
  .trim()
  .regex(OTP_RE, { message: "Enter the 6-digit code." });

export const tierSchema = z
  .int()
  .min(1, { message: "tier must be an integer between 1 and 4" })
  .max(4, { message: "tier must be an integer between 1 and 4" });

export const phoneSchema = z
  .string()
  .trim()
  .refine((v) => isValidPhoneNumber(v), { message: "Invalid phone number" });

const optionalEmail = optional(emailSchema);
const optionalPhone = optional(phoneSchema);
const optionalHttpUrl = optional(httpUrlSchema);
const optionalHex = optional(hexColorSchema);
const optionalTrimmed = optional(nonEmptyTrimmed);

export const signupSchema = z.object({
  first_name: nonEmptyTrimmed,
  last_name: nonEmptyTrimmed,
  email: emailSchema,
});

export const verifyOtpSchema = z.object({
  email: emailSchema,
  token: otpSchema,
});

export const orgSchema = z.object({
  name: nonEmptyTrimmed,
  country: nonEmptyTrimmed,
  address: optionalTrimmed,
  website_url: optionalHttpUrl,
  industry: optionalTrimmed,
  logo_url: optionalTrimmed,
});

export const contactSchema = z.object({
  contact_first_name: nonEmptyTrimmed,
  contact_last_name: nonEmptyTrimmed,
  contact_email: emailSchema,
  phone_number: optionalPhone,
  support_email: optionalEmail,
  notification_email: optionalEmail,
});

export const planSchema = z.object({
  tier: tierSchema,
  terms_accepted: z.literal(true, {
    message: "Please accept the Terms and Privacy Policy.",
  }),
  privacy_accepted: z.literal(true, {
    message: "Please accept the Terms and Privacy Policy.",
  }),
});

export const brandingSchema = z.object({
  primary_colour: optionalHex,
  secondary_colour: optionalHex,
  background_colour: optionalHex,
  text_colour: optionalHex,
  surface_colour: optionalHex,
  accent_colour: optionalHex,
});

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const LOGO_MIMES = ["image/png", "image/jpeg", "image/webp"] as const;

export const uploadLogoSchema = z.object({
  type: z.enum(LOGO_MIMES, {
    message: "unsupported file type (allowed: png, jpeg, webp)",
  }),
  size: z.int().max(LOGO_MAX_BYTES, {
    message: `file exceeds ${LOGO_MAX_BYTES} bytes`,
  }),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type OrgInput = z.infer<typeof orgSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export type PlanInput = z.infer<typeof planSchema>;
export type BrandingInput = z.infer<typeof brandingSchema>;
export type UploadLogoInput = z.infer<typeof uploadLogoSchema>;

export function firstError<T extends z.ZodTypeAny>(
  schema: T,
  input: unknown
): string | null {
  const r = schema.safeParse(input);
  return r.success ? null : r.error.issues[0]?.message ?? "Invalid input";
}
