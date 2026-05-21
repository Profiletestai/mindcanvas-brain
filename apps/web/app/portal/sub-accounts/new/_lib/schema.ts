import { z } from "zod";
import {
  nonEmptyTrimmed,
  emailSchema,
  httpUrlSchema,
  phoneSchema,
} from "@/app/(v2)/onboarding/v2/_lib/schema";

const blankToUndef = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const optionalTrimmed = z.preprocess(blankToUndef, nonEmptyTrimmed.optional());
const optionalPhone = z.preprocess(blankToUndef, phoneSchema.optional());
const optionalHttpUrl = z.preprocess(blankToUndef, httpUrlSchema.optional());

export const subOrgSchema = z.object({
  org_name: nonEmptyTrimmed.max(200, { message: "Max 200 characters" }),
  country_code: nonEmptyTrimmed,
  website: optionalHttpUrl,
  industry: optionalTrimmed,
});

export const subOwnerSchema = z.object({
  owner_first_name: nonEmptyTrimmed,
  owner_last_name: nonEmptyTrimmed,
  owner_email: emailSchema,
  owner_phone: optionalPhone,
});

export const subPayerSchema = z.object({
  payer_mode: z.enum(["parent_paid", "self_paid"], {
    errorMap: () => ({ message: "Select a payer mode" }),
  }),
  tier: z.literal(1).default(1),
});

export type SubOrgInput = z.input<typeof subOrgSchema>;
export type SubOrgOutput = z.output<typeof subOrgSchema>;
export type SubOwnerInput = z.input<typeof subOwnerSchema>;
export type SubOwnerOutput = z.output<typeof subOwnerSchema>;
export type SubPayerInput = z.input<typeof subPayerSchema>;
export type SubPayerOutput = z.output<typeof subPayerSchema>;
