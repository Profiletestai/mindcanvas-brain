// apps/web/app/api/admin/links/[linkId]/route.ts
// PATCH a single test link (edit fields, activate/deactivate).
// Every write is scoped by org_id as well as id, mirroring how
// DELETE /api/portal/links scopes its deletes.
import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/server/supabaseAdmin";
import {
  normalizeMaxUses,
  normalizeReportVariant,
} from "@/lib/links/normalize";
import { formatZodError, patchLinkSchema } from "@/lib/links/schema";
import { isValidUrl } from "@/lib/isValidUrl";
import { requireOrgAccess } from "@/lib/server/orgAccess";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  ctx: { params: { linkId: string } | Promise<{ linkId: string }> },
) {
  try {
    const { linkId } = await ctx.params;

    if (!linkId) {
      return NextResponse.json(
        { ok: false, error: "Missing linkId" },
        { status: 400 },
      );
    }

    const raw = await req.json().catch(() => null);
    const parsed = patchLinkSchema.safeParse(raw ?? {});

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: formatZodError(parsed.error) },
        { status: 400 },
      );
    }

    const body = parsed.data;

    // The service-role client below ignores RLS, so the caller has to be a
    // member of the org they claim to be writing to.
    const access = await requireOrgAccess(body.orgId);
    if (!access.ok) {
      return NextResponse.json(
        { ok: false, error: access.error },
        { status: access.status },
      );
    }

    const sb = createClient().schema("portal");

    const { data: existing, error: readErr } = await sb
      .from("test_links")
      .select(
        "id, org_id, show_results, redirect_url, next_steps_url, hidden_results_message, meta",
      )
      .eq("id", linkId)
      .eq("org_id", body.orgId)
      .maybeSingle();

    if (readErr) {
      return NextResponse.json(
        { ok: false, error: readErr.message },
        { status: 500 },
      );
    }

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Link not found" },
        { status: 404 },
      );
    }

    const update: Record<string, any> = {};

    // Results visibility and the two URLs move together, so they are validated
    // as a group — and only when the request actually touches one of them.
    // A plain deactivate must not be rejected because an older row predates
    // the required next-steps URL.
    const touchesDelivery =
      body.showResults !== undefined ||
      body.nextStepsUrl !== undefined ||
      body.redirectUrl !== undefined ||
      body.hiddenResultsMessage !== undefined;

    if (touchesDelivery) {
      // Resolve the post-update state so the rules apply to the row as it
      // will actually be stored, not just to the fields that changed.
      const showResults =
        body.showResults === undefined
          ? !!existing.show_results
          : body.showResults;

      const nextStepsUrl =
        body.nextStepsUrl === undefined
          ? (existing.next_steps_url ?? "")
          : (body.nextStepsUrl ?? "");

      const redirectUrl =
        body.redirectUrl === undefined
          ? (existing.redirect_url ?? "")
          : (body.redirectUrl ?? "");

      if (!isValidUrl(nextStepsUrl)) {
        return NextResponse.json(
          { ok: false, error: "nextStepsUrl: a full URL is required" },
          { status: 400 },
        );
      }

      if (!showResults && !isValidUrl(redirectUrl)) {
        return NextResponse.json(
          { ok: false, error: "redirectUrl: required when results are hidden" },
          { status: 400 },
        );
      }

      update.show_results = showResults;
      update.next_steps_url = nextStepsUrl;
      // Same coupling the create route applies: shown results means there is
      // nothing to redirect to and no stand-in message.
      update.redirect_url = showResults ? null : redirectUrl;
      update.hidden_results_message = showResults
        ? null
        : body.hiddenResultsMessage === undefined
          ? (existing.hidden_results_message ?? null)
          : body.hiddenResultsMessage || null;
    }

    if (body.name !== undefined) update.name = body.name || null;
    if (body.contactOwner !== undefined) {
      update.contact_owner = body.contactOwner || null;
    }
    if (body.emailReport !== undefined) update.email_report = body.emailReport;
    if (body.isActive !== undefined) update.is_active = body.isActive;
    if (body.max_uses !== undefined) {
      update.max_uses = normalizeMaxUses(body.max_uses);
    }
    if (body.expiresAt !== undefined) {
      update.expires_at = body.expiresAt
        ? new Date(body.expiresAt).toISOString()
        : null;
    }

    const variantInput = body.report_variant ?? body.reportVariant;
    if (variantInput !== undefined && variantInput !== null) {
      update.meta = {
        ...((existing.meta as Record<string, any> | null) ?? {}),
        report_variant: normalizeReportVariant(variantInput),
      };
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { ok: false, error: "Nothing to update" },
        { status: 400 },
      );
    }

    const { data: updated, error: updErr } = await sb
      .from("test_links")
      .update(update)
      .eq("id", linkId)
      .eq("org_id", body.orgId)
      .select("id, token, is_active")
      .maybeSingle();

    if (updErr) {
      return NextResponse.json(
        { ok: false, error: updErr.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, link: updated });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unexpected error" },
      { status: 500 },
    );
  }
}
