import { z } from "zod";
import { httpUrlSchema } from "@/app/(v2)/onboarding/v2/_lib/schema";

const blankToUndef = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const blankToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;

export const uuidWithMsg = (msg: string) =>
  z.string().uuid({ message: msg });

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{2,60}$/, {
    message: "org_slug must match /^[a-z0-9_]{2,60}$/",
  });

export const createSubAccountSchema = z.object({
  parent_org_id: uuidWithMsg("parent_org_id must be a UUID"),
  org_name: z
    .string()
    .trim()
    .min(1, { message: "org_name is required (1-200 chars)" })
    .max(200, { message: "org_name is required (1-200 chars)" }),
  org_slug: z.preprocess(blankToUndef, slugSchema.optional()),
  country_code: z
    .string()
    .trim()
    .min(1, { message: "country_code is required" }),
  website: z.preprocess(blankToNull, httpUrlSchema.nullable()),
  industry: z.preprocess(
    blankToNull,
    z.string().trim().min(1).nullable(),
  ),
  owner_first_name: z
    .string()
    .trim()
    .min(1, { message: "owner_first_name is required" }),
  owner_last_name: z
    .string()
    .trim()
    .min(1, { message: "owner_last_name is required" }),
  owner_email: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {
      message: "owner_email must be a valid email",
    }),
  ),
  owner_phone: z.preprocess(
    blankToNull,
    z.string().trim().min(1).nullable(),
  ),
  payer_mode: z.enum(["parent_paid", "self_paid"], {
    errorMap: () => ({
      message: "payer_mode must be 'parent_paid' or 'self_paid'",
    }),
  }),
  tier: z.literal(1, {
    errorMap: () => ({ message: "tier must be 1 in v1" }),
  }),
});

export type CreateSubAccountInput = z.output<typeof createSubAccountSchema>;

export const patchSubAccountSchema = z.object({
  action: z.enum(["suspend", "reactivate", "archive"], {
    errorMap: () => ({
      message: "action must be 'suspend', 'reactivate', or 'archive'",
    }),
  }),
});

export type PatchSubAccountInput = z.output<typeof patchSubAccountSchema>;

export const listQuerySchema = z.object({
  parentOrgId: uuidWithMsg("parentOrgId must be a UUID"),
});
