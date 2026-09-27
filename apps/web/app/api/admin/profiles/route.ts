import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/app/_lib/supabase/server";
import { requireSuperadminApi } from "@/lib/server/adminApiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Body = {
  draftId?: string;
  orgId?: string | null;
  profileName: string;
  frequency: "A" | "B" | "C" | "D";
  content: any;
};

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
    const sb: any = supabaseAdmin();

    if (body.draftId) {
      const { data, error } = await sb
        .from("profiles_drafts")
        .update({
          content: body.content,
          status: "draft",
        })
        .eq("id", body.draftId)
        .select("id")
        .single();

      if (error) throw error;

      return NextResponse.json({
        ok: true,
        id: data.id,
      });
    }

    const { data, error } = await sb
      .from("profiles_drafts")
      .insert([
        {
          org_id: body.orgId ?? null,
          profile_name: body.profileName,
          frequency: body.frequency,
          content: body.content,
          status: "draft",
        },
      ])
      .select("id")
      .single();

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      id: data.id,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        error: e?.message ?? "Save failed",
      },
      {
        status: 400,
      }
    );
  }
}
