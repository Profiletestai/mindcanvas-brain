// apps/web/app/api/portal/[slug]/mcas/links/route.ts
// GET  — list the organisation's MCAS assessment links
// POST — create one and return its public URL

import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createPortalMcasLink,
  listPortalMcasLinks,
} from "@/lib/mcas/mcasPortalData";
import { MCAS_TEST_SLUG, requirePortalOrgAccess } from "@/lib/portal/authz";

import { accessDenied, badRequest, serverError } from "../_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const { slug } = await ctx.params;

    const guard = await requirePortalOrgAccess({
      slug,
      permission: "read",
      testSlug: MCAS_TEST_SLUG,
    });

    if (!guard.ok) return accessDenied(guard);

    const links = await listPortalMcasLinks(guard.access.org.id);

    return NextResponse.json({ ok: true, links });
  } catch (caught) {
    return serverError("links GET", caught);
  }
}

// Mirrors the invariants already enforced in createMcasReusableTestLink so a
// bad request fails before any row is written.
const createLinkSchema = z
  .object({
    name: z.string().trim().min(1, "Test name is required.").max(200),
    contactOwnerName: z.string().trim().max(200).nullish(),
    recipientEmail: z.string().trim().email("Enter a valid email.").nullish(),
    sendEmail: z.boolean().default(false),
    reportVersion: z.enum(["lite", "full"]).default("full"),
    showResults: z.boolean().default(false),
    emailReport: z.boolean().default(false),
    nextStepsUrl: z.string().trim().url("Enter a valid URL.").nullish(),
    usageLimitType: z.enum(["unlimited", "limited"]).default("unlimited"),
    usageLimitCount: z.number().int().positive().nullish(),
  })
  .superRefine((value, ctx) => {
    if (value.sendEmail && !value.recipientEmail) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recipientEmail"],
        message: "Recipient email is required when send email is selected.",
      });
    }

    if (value.showResults && !value.nextStepsUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nextStepsUrl"],
        message: "Next steps URL is required when results are shown.",
      });
    }

    if (value.usageLimitType === "limited" && !value.usageLimitCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["usageLimitCount"],
        message: "Usage limit must be at least 1 when Limited is selected.",
      });
    }
  });

export async function POST(req: Request, ctx: RouteContext) {
  try {
    const { slug } = await ctx.params;

    const guard = await requirePortalOrgAccess({
      slug,
      permission: "write",
      testSlug: MCAS_TEST_SLUG,
    });

    if (!guard.ok) return accessDenied(guard);

    const body = await req.json().catch(() => null);

    if (!body) return badRequest("Request body must be JSON.");

    const parsed = createLinkSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest(
        parsed.error.issues[0]?.message ?? "Invalid request.",
        "validation_failed",
      );
    }

    const input = parsed.data;

    const link = await createPortalMcasLink({
      portalOrg: guard.access.org,
      name: input.name,
      contactOwnerName: input.contactOwnerName ?? null,
      recipientEmail: input.recipientEmail ?? null,
      sendEmail: input.sendEmail,
      reportVersion: input.reportVersion,
      showResults: input.showResults,
      emailReport: input.emailReport,
      nextStepsUrl: input.nextStepsUrl ?? null,
      usageLimitType: input.usageLimitType,
      usageLimitCount: input.usageLimitCount ?? null,
    });

    return NextResponse.json({ ok: true, link }, { status: 201 });
  } catch (caught) {
    return serverError("links POST", caught);
  }
}
