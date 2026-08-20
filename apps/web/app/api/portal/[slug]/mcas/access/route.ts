// apps/web/app/api/portal/[slug]/mcas/access/route.ts
// GET — does the caller's organisation have MCAS? Drives the sidebar entry.
//
// Always 200 with a boolean rather than 403, so the sidebar can render without
// treating a normal "no MCAS on this plan" as a failed request.

import { NextResponse } from "next/server";

import { MCAS_TEST_SLUG, requirePortalOrgAccess } from "@/lib/portal/authz";

import { serverError } from "../_lib/respond";

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

    return NextResponse.json({
      ok: true,
      hasAccess: guard.ok,
      reason: guard.ok ? null : guard.code,
    });
  } catch (caught) {
    return serverError("access GET", caught);
  }
}
