// apps/web/app/api/portal/[slug]/mcas/candidates/[candidateId]/route.ts
// GET — one candidate's MCAS details and result

import { NextResponse } from "next/server";

import { getPortalMcasCandidate } from "@/lib/mcas/mcasPortalData";
import { MCAS_TEST_SLUG, requirePortalOrgAccess } from "@/lib/portal/authz";

import { accessDenied, notFound, serverError } from "../../_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ slug: string; candidateId: string }>;
};

export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const { slug, candidateId } = await ctx.params;

    const guard = await requirePortalOrgAccess({
      slug,
      permission: "read",
      testSlug: MCAS_TEST_SLUG,
    });

    if (!guard.ok) return accessDenied(guard);

    const candidate = await getPortalMcasCandidate(
      guard.access.org.id,
      candidateId,
    );

    // Ownership is part of the query, so a candidate belonging to another org
    // is indistinguishable from one that does not exist.
    if (!candidate) return notFound("Candidate not found.");

    return NextResponse.json({ ok: true, candidate });
  } catch (caught) {
    return serverError("candidate GET", caught);
  }
}
