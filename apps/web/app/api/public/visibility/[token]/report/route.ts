//apps/web/app/api/public/visibility/[token]/report/route.ts
// apps/web/app/api/public/visibility/[token]/report/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AB = "A" | "B" | "C" | "D";
type Tier = "Invisible" | "Emerging" | "Established" | "Magnetic";
type Readiness = "stabilise" | "ready_to_progress";

function getKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_ANON_KEY ||
    ""
  );
}

function portal() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = getKey();
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, { db: { schema: "portal" }, auth: { persistSession: false } });
}

function visibility() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = getKey();
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, { db: { schema: "visibility" }, auth: { persistSession: false } });
}

export async function GET(req: NextRequest, ctx: { params: { token: string } }) {
  try {
    const token = String(ctx.params.token || "").trim();
    const tid = String(req.nextUrl.searchParams.get("tid") || "").trim();

    if (!token) return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });
    if (!tid) return NextResponse.json({ ok: false, error: "Missing tid" }, { status: 400 });

    const sb = portal();
    const vis = visibility();

    // 1) Validate taker belongs to this token
    const { data: taker, error: takerErr } = await sb
      .from("test_takers")
      .select("id, org_id, test_id, link_token, first_name, last_name, email")
      .eq("id", tid)
      .eq("link_token", token)
      .maybeSingle();

    if (takerErr) {
      return NextResponse.json({ ok: false, error: takerErr.message }, { status: 500 });
    }
    if (!taker) {
      return NextResponse.json({ ok: false, error: "Taker not found for this token" }, { status: 404 });
    }

    // 2) Look up visibility engine test for this portal test
    const { data: vTest, error: vTestErr } = await vis
      .from("tests")
      .select("id")
      .eq("portal_test_id", taker.test_id)
      .maybeSingle();

    if (vTestErr) {
      return NextResponse.json({ ok: false, error: vTestErr.message }, { status: 500 });
    }
    if (!vTest?.id) {
      return NextResponse.json({ ok: false, error: "This token is not linked to a visibility engine test." }, { status: 400 });
    }

    // 3) Fetch latest submission for this token (we filter in code using metadata.taker_id)
    const { data: subs, error: subsErr } = await vis
      .from("submissions")
      .select("id, created_at, token, metadata, taker_name, taker_email, answers")
      .eq("token", token)
      .order("created_at", { ascending: false })
      .limit(25);

    if (subsErr) {
      return NextResponse.json({ ok: false, error: subsErr.message }, { status: 500 });
    }

    const match = (subs || []).find((s: any) => String(s?.metadata?.taker_id || "") === String(tid));
    if (!match?.id) {
      return NextResponse.json(
        { ok: false, error: "No visibility submission found for this taker+token yet." },
        { status: 404 }
      );
    }

    // 4) Fetch corresponding results
    const { data: res, error: resErr } = await vis
      .from("results")
      .select("id, created_at, tier, level, readiness, personality_type, personality_points, tier_counts")
      .eq("submission_id", match.id)
      .order("created_at", { ascending: false })
      .maybeSingle();

    if (resErr) {
      return NextResponse.json({ ok: false, error: resErr.message }, { status: 500 });
    }
    if (!res) {
      return NextResponse.json({ ok: false, error: "Visibility results not found for submission." }, { status: 404 });
    }

    // 5) Org + test meta for header
    const { data: orgRow } = await sb
      .from("orgs")
      .select("id, slug, name, logo_url")
      .eq("id", taker.org_id)
      .maybeSingle();

    const { data: testRow } = await sb
      .from("tests")
      .select("id, name, slug")
      .eq("id", taker.test_id)
      .maybeSingle();

    const totals = {
      tier: res.tier as Tier,
      level: Number(res.level ?? 0),
      readiness: res.readiness as Readiness,
      personality_type: res.personality_type as AB,
      personality_points: (res.personality_points || { A: 0, B: 0, C: 0, D: 0 }) as Record<AB, number>,
      tier_counts: (res.tier_counts || {
        Invisible: 0,
        Emerging: 0,
        Established: 0,
        Magnetic: 0,
      }) as Record<Tier, number>,
    };

    return NextResponse.json(
      {
        ok: true,
        data: {
          org_slug: (orgRow as any)?.slug ?? null,
          org_name: (orgRow as any)?.name ?? null,
          org_logo_url: (orgRow as any)?.logo_url ?? null,
          test_name: (testRow as any)?.name ?? "Visibility Ladder",
          taker: {
            id: taker.id,
            first_name: (taker as any)?.first_name ?? null,
            last_name: (taker as any)?.last_name ?? null,
            email: (taker as any)?.email ?? null,
          },
          totals,
          debug: {
            visibility_test_id: vTest.id,
            submission_id: match.id,
            result_id: res.id,
          },
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}