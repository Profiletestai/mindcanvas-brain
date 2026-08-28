// apps/web/app/api/portal/[slug]/mcas/links/[linkId]/route.ts
// PATCH — rename, pause/reactivate or archive one of the org's MCAS links

import { NextResponse } from "next/server";
import { z } from "zod";

import { updatePortalMcasLink } from "@/lib/mcas/mcasPortalData";
import { MCAS_TEST_SLUG, requirePortalOrgAccess } from "@/lib/portal/authz";

import { accessDenied, badRequest, notFound, serverError } from "../../_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string; linkId: string }> };

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    status: z.enum(["active", "paused", "archived"]).optional(),
  })
  .refine((value) => value.name !== undefined || value.status !== undefined, {
    message: "Provide a name or a status to update.",
  });

export async function PATCH(req: Request, ctx: RouteContext) {
  try {
    const { slug, linkId } = await ctx.params;

    const guard = await requirePortalOrgAccess({
      slug,
      permission: "write",
      testSlug: MCAS_TEST_SLUG,
    });

    if (!guard.ok) return accessDenied(guard);

    const body = await req.json().catch(() => null);

    if (!body) return badRequest("Request body must be JSON.");

    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest(
        parsed.error.issues[0]?.message ?? "Invalid request.",
        "validation_failed",
      );
    }

    const link = await updatePortalMcasLink(
      guard.access.org.id,
      linkId,
      parsed.data,
    );

    // Null means the UPDATE matched no row: the link does not exist, or belongs
    // to another organisation. Both answer the same way — confirming it exists
    // would leak another tenant's data.
    if (!link) return notFound("Test link not found.");

    return NextResponse.json({ ok: true, link });
  } catch (caught) {
    return serverError("links PATCH", caught);
  }
}
