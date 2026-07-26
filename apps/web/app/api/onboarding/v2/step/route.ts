//apps/web/app/api/onboarding/v2/step/route.ts
// POST — advance orgs.last_completed_step for the steps that have no payload
// of their own: 5 (organisation saved), 6 (organisation-created acknowledged),
// 7 (welcome video watched), 8 (booking step), 9 (booking confirmation) and
// 10 (first diagnostic choice — the final step).
//
// The write is monotonic (greatest(current, step)) so re-visiting a screen or
// a double submit can never send a client backwards.

import { NextResponse } from "next/server";
import { portalAdmin } from "@/app/_lib/supabaseAdmin";
import { getAuthUser } from "../_lib/auth";
import type { StepResponse } from "../_lib/types";

export const dynamic = "force-dynamic";

const ALLOWED_STEPS = new Set([5, 6, 7, 8, 9, 10]);

function jerr(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(req: Request) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;

    const raw = await req.json().catch(() => ({}));
    const step = Number((raw as { step?: unknown }).step);
    if (!ALLOWED_STEPS.has(step)) {
      return jerr("step must be one of 5, 6, 7, 8, 9, 10", 400);
    }

    const admin = portalAdmin();

    const { data: membership } = await admin
      .from("user_orgs")
      .select("org_id, orgs(slug, last_completed_step)")
      .eq("user_id", user.id)
      .maybeSingle<{
        org_id: string;
        orgs: { slug: string | null; last_completed_step: number | null } | null;
      }>();

    if (!membership?.org_id) {
      return jerr("No org found for user", 404);
    }

    const current = membership.orgs?.last_completed_step ?? 0;
    const next = Math.max(current, step);

    if (next !== current) {
      const { error } = await admin
        .from("orgs")
        .update({ last_completed_step: next })
        .eq("id", membership.org_id);
      if (error) return jerr(error.message, 500);
    }

    const body: StepResponse = {
      ok: true,
      last_completed_step: next,
      org_slug: membership.orgs?.slug ?? null,
    };
    return NextResponse.json(body);
  } catch (e: any) {
    return jerr(e?.message || "Unexpected error", 500);
  }
}
