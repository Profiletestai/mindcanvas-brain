//apps/web/app/api/partners/mcas/applications/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePartnerAuth } from "../_lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function supa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { db: { schema: "mcas" } });
}

function portalSupa() {
  // for looking up org_id by org_slug (portal schema)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { db: { schema: "portal" } });
}

export async function POST(req: Request) {
  try {
    const auth = await requirePartnerAuth(req);
    const body = await req.json();

    const application_id = String(body.application_id || "").trim();
    const org_slug = String(body.org_slug || "").trim();
    const framework_slug = String(body.framework_slug || "mcas-core-alignment").trim();
    const framework_version = String(body.framework_version || "v1").trim();

    const candidate = body.candidate || {};
    const candidate_email = candidate.email ? String(candidate.email).trim() : null;
    const candidate_first_name = candidate.first_name ? String(candidate.first_name).trim() : null;
    const candidate_last_name = candidate.last_name ? String(candidate.last_name).trim() : null;

    if (!application_id) {
      return NextResponse.json({ error: "application_id is required" }, { status: 400 });
    }
    if (!org_slug) {
      return NextResponse.json({ error: "org_slug is required" }, { status: 400 });
    }

    // Resolve org_id from portal.orgs
    const portal = portalSupa();
    const { data: orgRow, error: orgErr } = await portal
      .from("orgs")
      .select("id, slug")
      .eq("slug", org_slug)
      .maybeSingle();

    if (orgErr || !orgRow) {
      return NextResponse.json({ error: "org not found" }, { status: 404 });
    }

    if (auth.allowed_org_id && auth.allowed_org_id !== orgRow.id) {
      return NextResponse.json({ error: "partner not allowed for this org" }, { status: 403 });
    }

    const sb = supa();

    // Upsert application (idempotent)
    const { data: existing, error: exErr } = await sb
      .from("partner_applications")
      .select("id, public_token, status")
      .eq("partner_key", auth.partner_key)
      .eq("application_id", application_id)
      .maybeSingle();

    if (exErr) {
      return NextResponse.json({ error: "db error" }, { status: 500 });
    }

    let app = existing;

    if (!app) {
      const { data: created, error: crErr } = await sb
        .from("partner_applications")
        .insert({
          partner_key: auth.partner_key,
          application_id,
          org_id: orgRow.id,
          framework_slug,
          framework_version,
          candidate_email,
          candidate_first_name,
          candidate_last_name,
        })
        .select("id, public_token, status")
        .single();

      if (crErr) return NextResponse.json({ error: "failed to create application" }, { status: 500 });
      app = created;
    }

    // Start URL (you will build this route next)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const test_url = `${baseUrl}/mcas/t/${app.public_token}`;

    return NextResponse.json({
      partner_key: auth.partner_key,
      application_id,
      status: app.status,
      test_url,
    });
  } catch (e: any) {
    const msg = String(e?.message || "");
    const status =
      msg.startsWith("AUTH_") ? 401 :
      500;

    return NextResponse.json({ error: msg || "unknown error" }, { status });
  }
}