import { NextResponse } from "next/server";

import { suggestFrameworkNames } from "@/app/_lib/ai";
import { supabaseAdmin } from "@/app/_lib/supabase/server";
import { requireSuperadminApi } from "@/lib/server/adminApiAuth";

export const runtime = "nodejs";

type Body = {
  orgId: string;
  orgName?: string;
  industry?: string;
  sector?: string;
  primaryGoal?: string;
  brandTone?: string;
  ownerId?: string | null;
};

const normalizeId = (s?: string) =>
  (s || "").trim().replace(/^:/, "");

const isUUID = (s?: string) =>
  !!s &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s
  );

export async function POST(req: Request) {
  try {
    const auth = await requireSuperadminApi();

    if (!auth.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: auth.error,
        },
        {
          status: auth.status,
        }
      );
    }

    const body = (await req.json()) as Body;

    const orgId = normalizeId(body.orgId);

    if (!isUUID(orgId)) {
      return NextResponse.json(
        { error: "Invalid orgId" },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();

    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("id", orgId)
      .single();

    if (orgErr || !org) {
      return NextResponse.json(
        {
          error: "Organization not found for orgId",
          details: orgErr?.message,
        },
        {
          status: 400,
        }
      );
    }

    const proposal = await suggestFrameworkNames({
      industry: body.industry || "General",
      sector: body.sector || "General",
      brandTone:
        body.brandTone || "confident, modern, human",
      primaryGoal:
        body.primaryGoal || "Improve team performance",
    });

    const frequency_meta = {
      frequencies: proposal.frequencies,
      profiles: proposal.profiles,
      imagePrompts: proposal.imagePrompts,

      A: {
        name: proposal.frequencies.A,
        color: "red",
        image_prompt: proposal.imagePrompts.A,
        image_url: null,
      },

      B: {
        name: proposal.frequencies.B,
        color: "yellow",
        image_prompt: proposal.imagePrompts.B,
        image_url: null,
      },

      C: {
        name: proposal.frequencies.C,
        color: "green",
        image_prompt: proposal.imagePrompts.C,
        image_url: null,
      },

      D: {
        name: proposal.frequencies.D,
        color: "blue",
        image_prompt: proposal.imagePrompts.D,
        image_url: null,
      },
    };

    const name =
      `${body.orgName || org.name} — Core Framework`;

    const { data, error } = await supabase
      .from("frameworks")
      .insert({
        org_id: orgId,
        name,
        version: "1",
        owner_id: body.ownerId ?? null,
        frequency_meta,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        framework: data,
      },
      {
        status: 201,
      }
    );
  } catch (e: any) {
    return NextResponse.json(
      {
        error: e?.message ?? "Unknown error",
      },
      {
        status: 400,
      }
    );
  }
}
