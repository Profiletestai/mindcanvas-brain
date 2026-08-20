//apps/web/app/(v2)/onboarding/v2/_lib/schema.ts
import { z } from "zod";
import { isValidPhoneNumber } from "libphonenumber-js";
import {
  ENGINE_KEYS,
  TIER_DISABLED_REASON,
  isTierAllowed,
  normalizeEngines,
} from "./engines";

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
  z.string().email({ message: "Invalid email format" })
);

export const passwordSchema = z
  .string()
  .min(8, { message: "Password must be at least 8 characters." })
  .max(72, { message: "Password must be 72 characters or fewer." });

export const httpUrlSchema = z
  .string()
  .url({ message: "Must be an http(s) URL." })
  .refine((v) => /^https?:/i.test(v), {
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

// export const passwordSchema = z
//   .string()
//   .min(8, { message: "Password must be at least 8 characters." })
//   .regex(/[a-z]/, { message: "Password must contain a lowercase letter." })
//   .regex(/[A-Z]/, { message: "Password must contain an uppercase letter." })
//   .regex(/\d/, { message: "Password must contain a number." });

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirm_password: z.string() })
  .refine((v) => v.password === v.confirm_password, {
    message: "Passwords do not match.",
    path: ["confirm_password"],
  });

export const tierSchema = z
  .number()
  .int()
  .min(1, { message: "tier must be an integer between 1 and 4" })
  .max(4, { message: "tier must be an integer between 1 and 4" });

export const phoneSchema = z
  .string()
  .trim()
  .refine((v) => isValidPhoneNumber(v), {
    message: "Invalid phone number",
  });

const optionalEmail = optional(emailSchema);
const optionalPhone = optional(phoneSchema);
const optionalHttpUrl = optional(httpUrlSchema);
const optionalHex = optional(hexColorSchema);
const optionalTrimmed = optional(nonEmptyTrimmed);

export const signupSchema = z
  .object({
    first_name: nonEmptyTrimmed,
    last_name: nonEmptyTrimmed,
    email: emailSchema,
    password: passwordSchema,
    confirm_password: z.string().min(1, {
      message: "Please confirm your password.",
    }),
    terms_accepted: z.boolean().refine((v) => v === true, {
      message: "Please accept the Terms and Conditions.",
    }),
    privacy_accepted: z.boolean().refine((v) => v === true, {
      message: "Please accept the Privacy Policy.",
    }),
  })
  .refine((values) => values.password === values.confirm_password, {
    message: "Passwords do not match.",
    path: ["confirm_password"],
  });

export const verifyOtpSchema = z.object({
  email: emailSchema,
  token: otpSchema,
});

// Engine and subscription selection. Tier 4 is not selectable during
// onboarding. The tier/engine-count rule is also checked server-side.
export const engineKeySchema = z.enum(ENGINE_KEYS);

export const planSelectionSchema = z
  .object({
    engines: z
      .array(engineKeySchema)
      .min(1, { message: "Select at least one engine." })
      .max(ENGINE_KEYS.length)
      .transform((v) => normalizeEngines(v)),
    tier: z
      .number()
      .int()
      .min(1, { message: "Select a subscription tier." })
      .max(3, {
        message: "Tier 4 is not available during onboarding.",
      }),
  })
  .refine((v) => isTierAllowed(v.tier, v.engines.length), {
    message: TIER_DISABLED_REASON,
    path: ["tier"],
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
    errorMap: () => ({
      message: "unsupported file type (allowed: png, jpeg, webp)",
    }),
  }),
  size: z
    .number()
    .int()
    .max(LOGO_MAX_BYTES, {
      message: `file exceeds ${LOGO_MAX_BYTES} bytes`,
    }),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type PlanSelectionInput = z.input<typeof planSelectionSchema>;
export type PlanSelectionOutput = z.output<typeof planSelectionSchema>;
export type OrgInput = z.infer<typeof orgSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export type BrandingInput = z.infer<typeof brandingSchema>;
export type UploadLogoInput = z.infer<typeof uploadLogoSchema>;

export function firstError<T extends z.ZodTypeAny>(
  schema: T,
  input: unknown
): string | null {
  const result = schema.safeParse(input);

  return result.success
    ? null
    : result.error.issues[0]?.message ?? "Invalid input";
}
