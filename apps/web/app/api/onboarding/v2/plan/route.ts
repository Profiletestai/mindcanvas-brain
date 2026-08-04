// GET  — current engine/tier selection for the signed-in user.
// POST — save the step-3 selection (engines + subscription tier).
//
// The tier rule (minimum tier = number of engines) is enforced here and again
// in portal.fn_save_onboarding_selection, so a crafted request cannot buy a
// tier below the minimum. Trial quantities are never read from the request.

import { NextResponse } from "next/server";
import { portalAdmin } from "@/app/_lib/supabaseAdmin";
import { getAuthUser } from "../_lib/auth";
import { planSelectionSchema } from "@/app/(v2)/onboarding/v2/_lib/schema";
import {
  minimumTier,
  normalizeEngines,
  trialAllocation,
  type EngineKey,
} from "@/app/(v2)/onboarding/v2/_lib/engines";
import type { PlanSelectionResponse } from "../_lib/types";

export const dynamic = "force-dynamic";

type SelectionRow = {
  engines: string[] | null;
  selected_tier: number | null;
};

function jerr(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function GET() {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;

    const { data, error } = await portalAdmin()
      .from("onboarding_selections")
      .select("engines, selected_tier")
      .eq("user_id", user.id)
      .maybeSingle<SelectionRow>();
    if (error) return jerr(error.message, 500);

    const engines = normalizeEngines(data?.engines ?? []);
    const body: PlanSelectionResponse = {
      ok: true,
      selection: engines.length
        ? {
            engines,
            tier: data?.selected_tier ?? minimumTier(engines.length),
            minimum_tier: minimumTier(engines.length),
            trials: trialAllocation(engines),
          }
        : null,
    };
    return NextResponse.json(body);
  } catch (e: any) {
    return jerr(e?.message || "Unexpected error", 500);
  }
}

export async function POST(req: Request) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;

    const raw = await req.json().catch(() => ({}));
    const parsed = planSelectionSchema.safeParse(raw);
    if (!parsed.success) {
      return jerr(parsed.error.issues[0]?.message ?? "Invalid input", 400);
    }
    const engines = parsed.data.engines as EngineKey[];
    const tier = parsed.data.tier;

    const { error } = await portalAdmin().rpc("fn_save_onboarding_selection", {
      p_user_id: user.id,
      p_engines: engines,
      p_tier: tier,
    });
    if (error) {
      const msg = error.message || "";
      if (msg.includes("tier_below_minimum")) {
        return jerr(
          `Tier ${tier} does not support ${engines.length} engines.`,
          400
        );
      }
      if (msg.includes("no_engine_selected")) {
        return jerr("Select at least one engine.", 400);
      }
      if (msg.includes("invalid_tier")) {
        return jerr("Select a subscription tier.", 400);
      }
      return jerr(msg || "Could not save selection", 500);
    }

    const body: PlanSelectionResponse = {
      ok: true,
      selection: {
        engines,
        tier,
        minimum_tier: minimumTier(engines.length),
        trials: trialAllocation(engines),
      },
    };
    return NextResponse.json(body);
  } catch (e: any) {
    return jerr(e?.message || "Unexpected error", 500);
  }
}
