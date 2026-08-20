// apps/web/app/api/portal/[slug]/mcas/candidates/route.ts
// GET — paginated, searchable MCAS candidate list for the organisation

import { NextResponse } from "next/server";

import { listPortalMcasCandidates } from "@/lib/mcas/mcasPortalData";
import { MCAS_TEST_SLUG, requirePortalOrgAccess } from "@/lib/portal/authz";

import { accessDenied, serverError } from "../_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(req: Request, ctx: RouteContext) {
  try {
    const { slug } = await ctx.params;

    const guard = await requirePortalOrgAccess({
      slug,
      permission: "read",
      testSlug: MCAS_TEST_SLUG,
    });

    if (!guard.ok) return accessDenied(guard);

    const url = new URL(req.url);

    const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
    const pageSize = Number.parseInt(
      url.searchParams.get("pageSize") ?? "25",
      10,
    );

    const result = await listPortalMcasCandidates(guard.access.org.id, {
      query: url.searchParams.get("q"),
      status: url.searchParams.get("status"),
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 25,
    });

    return NextResponse.json({
      ok: true,
      candidates: result.rows,
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        hasMore: result.hasMore,
      },
    });
  } catch (caught) {
    return serverError("candidates GET", caught);
  }
}
