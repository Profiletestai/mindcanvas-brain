// apps/web/lib/links/schema.ts
// Validation shared by the test-link write routes. The client forms apply the
// same rules, but this is the guarantee: a link may never be stored without a
// next-steps URL, and never with hidden results and nowhere to send the taker.
import { z } from "zod";
import { isValidUrl } from "@/lib/isValidUrl";

const reportVariantSchema = z.enum(["lite", "full"]);

const optionalText = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => (typeof v === "string" ? v.trim() : v));

const urlText = z
  .string({ required_error: "nextStepsUrl is required" })
  .trim()
  .refine(isValidUrl, "Must be a full URL, including https://");

const maxUsesInput = z
  .union([z.number(), z.string(), z.null()])
  .optional();

const reportCurrencySchema = z.enum(["GBP", "USD", "EUR", "ZAR"]);

export const createLinkSchema = z
  .object({
    orgId: z.string().trim().min(1, "Missing orgId"),
    testId: z.string().trim().min(1, "Missing testId"),

    testDisplayName: optionalText,
    contactOwner: optionalText,

    showResults: z.boolean().optional().default(true),
    emailReport: z.boolean().optional().default(true),

    hiddenResultsMessage: optionalText,
    redirectUrl: optionalText,
    nextStepsUrl: urlText,

    expiresAt: optionalText,

    recipientEmail: optionalText,
    recipientName: optionalText,

    reportVariant: reportVariantSchema.nullish(),
    report_variant: reportVariantSchema.nullish(),
    reportPaywallEnabled: z.boolean().optional().default(false),
    reportPriceCents: z.number().int().min(100).max(1000000).nullable().optional(),
    reportCurrency: reportCurrencySchema.optional().default("GBP"),

    max_uses: maxUsesInput,
  })
  .superRefine((value, ctx) => {
    // Hidden results with no redirect strands the test taker on a dead end.
    if (!value.showResults && !isValidUrl(value.redirectUrl ?? "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["redirectUrl"],
        message: "Redirect URL is required when results are hidden",
      });
    }
    if (value.reportPaywallEnabled && !value.reportPriceCents) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reportPriceCents"],
        message: "A report price is required when charging for the full report",
      });
    }
  });

export type CreateLinkInput = z.infer<typeof createLinkSchema>;

// Edit accepts any subset of the mutable fields; the same coupling rule is
// applied against the resulting row inside the PATCH handler.
export const patchLinkSchema = z.object({
  orgId: z.string().trim().min(1, "Missing orgId"),

  name: optionalText,
  contactOwner: optionalText,

  showResults: z.boolean().optional(),
  emailReport: z.boolean().optional(),
  isActive: z.boolean().optional(),

  hiddenResultsMessage: optionalText,
  redirectUrl: optionalText,
  nextStepsUrl: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => (typeof v === "string" ? v.trim() : v)),

  expiresAt: optionalText,

  reportVariant: reportVariantSchema.nullish(),
  report_variant: reportVariantSchema.nullish(),
  reportPaywallEnabled: z.boolean().optional(),
  reportPriceCents: z.number().int().min(100).max(1000000).nullable().optional(),
  reportCurrency: reportCurrencySchema.optional(),

  max_uses: maxUsesInput,
});

export type PatchLinkInput = z.infer<typeof patchLinkSchema>;

// Flatten a ZodError into a single human-readable message for the API reply.
export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((i) => {
      const path = i.path.join(".");
      return path ? `${path}: ${i.message}` : i.message;
    })
    .join("; ");
}
