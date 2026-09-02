// apps/web/app/api/admin/inevitable-standard/seed/route.ts
//
// Superadmin-only. Creates (or refreshes) the single Inevitable Standard
// Diagnostic test in a chosen org, seeds its 32 stored questions from the
// canonical question bank, grants the org access, and optionally mints a public
// test link — the missing "create a new Inevitable Standard test" mechanism.
//
// This is the seed-base pattern (app/api/admin/tests/seed-base/route.ts) applied
// to the Inevitable Standard bank: one endpoint that puts the test + questions
// into portal.* so the normal public flow (/t/<token>) works end to end.
//
// It runs against whatever Supabase project the *invoking deployment* is
// configured for (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY). GET
// reports that target so it can be confirmed before POSTing.
import "server-only";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/server/supabaseAdmin";
import { getServerSupabase } from "@/app/_lib/portal";
import {
  INEVITABLE_STANDARD_TEST,
  toInevitableStandardDatabaseQuestions,
} from "@/lib/inevitable-standard/questions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEST_SLUG = INEVITABLE_STANDARD_TEST.slug; // "inevitable-standard"
const TEST_NAME = INEVITABLE_STANDARD_TEST.name; // "The Inevitable Standard Diagnostic"
const DEFAULT_CURRENCY = "AUD";

function supabaseTarget() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  let host = "";
  let projectRef = "";
  try {
    host = new URL(url).host;
    projectRef = host.split(".")[0] || "";
  } catch {
    /* malformed or missing URL */
  }
  return { url, host, projectRef };
}

function siteOrigin(req: Request) {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.APP_ORIGIN ||
    "";
  if (configured) return configured.replace(/\/+$/, "");
  try {
    const u = new URL(req.url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "";
  }
}

async function requireSuperadmin() {
  let userId: string | null = null;
  try {
    const sb = await getServerSupabase();
    const { data } = await sb.auth.getUser();
    userId = data?.user?.id ?? null;
  } catch {
    userId = null;
  }

  if (!userId) {
    return { ok: false as const, status: 401, error: "Not signed in" };
  }

  const portal = createClient().schema("portal");
  const { data: superRow, error } = await portal
    .from("superadmin")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return { ok: false as const, status: 500, error: error.message };
  }
  if (!superRow?.user_id) {
    return {
      ok: false as const,
      status: 403,
      error: "This action is restricted to platform administrators.",
    };
  }

  return { ok: true as const, userId };
}

type SeededTest = {
  id: string;
  slug: string | null;
  name: string | null;
  org_id: string | null;
  status: string | null;
};

async function findExistingTest(portal: any): Promise<SeededTest | null> {
  const { data, error } = await portal
    .from("tests")
    .select("id, slug, name, org_id, status, meta")
    .eq("slug", TEST_SLUG)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`tests lookup failed: ${error.message}`);
  return (data as SeededTest) || null;
}

export async function GET(req: Request) {
  const auth = await requireSuperadmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const portal = createClient().schema("portal");
  const target = supabaseTarget();

  let test: SeededTest | null = null;
  let questionCount = 0;
  let links: Array<{ token: string; name: string | null; is_active: boolean; url: string }> = [];

  try {
    test = await findExistingTest(portal);

    if (test?.id) {
      const { count } = await portal
        .from("test_questions")
        .select("id", { count: "exact", head: true })
        .eq("test_id", test.id);
      questionCount = count ?? 0;

      const { data: linkRows } = await portal
        .from("test_links")
        .select("token, name, is_active, created_at")
        .eq("test_id", test.id)
        .order("created_at", { ascending: false })
        .limit(10);

      const origin = siteOrigin(req);
      links = (linkRows || []).map((row: any) => ({
        token: row.token,
        name: row.name ?? null,
        is_active: !!row.is_active,
        url: origin ? `${origin}/t/${row.token}` : `/t/${row.token}`,
      }));
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "lookup failed" }, { status: 500 });
  }

  const { data: orgs } = await portal
    .from("orgs")
    .select("id, slug, name")
    .order("name");

  return NextResponse.json({
    ok: true,
    supabase: target,
    site_origin: siteOrigin(req),
    expected_question_count: toInevitableStandardDatabaseQuestions().length,
    test: test
      ? {
          id: test.id,
          slug: test.slug,
          name: test.name,
          org_id: test.org_id,
          status: test.status,
          question_count: questionCount,
        }
      : null,
    links,
    orgs: orgs ?? [],
  });
}

export async function POST(req: Request) {
  const auth = await requireSuperadmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const orgId = String(body?.orgId || body?.org_id || "").trim();
  const createLink = body?.createLink !== false; // default: also mint a link
  const linkName =
    typeof body?.linkName === "string" && body.linkName.trim()
      ? body.linkName.trim()
      : "Inevitable Standard — test run";
  const currency =
    typeof body?.currency === "string" && body.currency.trim()
      ? body.currency.trim().toUpperCase()
      : DEFAULT_CURRENCY;
  const maxUses =
    Number.isFinite(Number(body?.maxUses)) && Number(body?.maxUses) > 0
      ? Math.floor(Number(body.maxUses))
      : 0; // 0 = unlimited

  if (!orgId) {
    return NextResponse.json({ ok: false, error: "orgId is required" }, { status: 400 });
  }

  const portal = createClient().schema("portal");
  const steps: string[] = [];

  // 1) Org must exist in portal.orgs (test_links.org_id references it).
  const { data: org, error: orgErr } = await portal
    .from("orgs")
    .select("id, slug, name")
    .eq("id", orgId)
    .maybeSingle();

  if (orgErr) {
    return NextResponse.json({ ok: false, error: orgErr.message }, { status: 500 });
  }
  if (!org) {
    return NextResponse.json(
      { ok: false, error: "No portal org with that id" },
      { status: 404 },
    );
  }

  // 2) Upsert the single Inevitable Standard test row (matched by slug).
  let test: SeededTest | null;
  try {
    test = await findExistingTest(portal);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }

  const meta = {
    is_inevitable_standard: true,
    engine_key: "inevitable_standard",
    default_currency: currency,
    model_version: INEVITABLE_STANDARD_TEST.model_version,
    scoring_version: INEVITABLE_STANDARD_TEST.scoring_version,
    question_bank_version: INEVITABLE_STANDARD_TEST.question_bank_version,
  };

  if (!test) {
    const { data: inserted, error: insErr } = await portal
      .from("tests")
      .insert({
        org_id: orgId,
        name: TEST_NAME,
        slug: TEST_SLUG,
        mode: "full",
        status: "active",
        meta,
      })
      .select("id, slug, name, org_id, status")
      .single();

    if (insErr || !inserted) {
      return NextResponse.json(
        { ok: false, error: insErr?.message || "test insert failed" },
        { status: 500 },
      );
    }
    test = inserted as SeededTest;
    steps.push(`Created test ${test.id} in org ${org.name || orgId}.`);
  } else {
    const { data: updated, error: updErr } = await portal
      .from("tests")
      .update({ org_id: orgId, name: TEST_NAME, status: "active", meta })
      .eq("id", test.id)
      .select("id, slug, name, org_id, status")
      .single();

    if (updErr || !updated) {
      return NextResponse.json(
        { ok: false, error: updErr?.message || "test update failed" },
        { status: 500 },
      );
    }
    test = updated as SeededTest;
    steps.push(`Reused existing test ${test.id}; re-pointed to org ${org.name || orgId}.`);
  }

  // 3) Replace the stored questions with the canonical 32-item bank.
  const { error: delErr } = await portal
    .from("test_questions")
    .delete()
    .eq("test_id", test.id);

  if (delErr) {
    return NextResponse.json(
      { ok: false, error: `clearing questions failed: ${delErr.message}` },
      { status: 500 },
    );
  }

  const questionRows = toInevitableStandardDatabaseQuestions().map((q) => ({
    org_id: orgId,
    test_id: test!.id,
    idx: q.idx,
    order: q.order,
    type: q.type,
    text: q.text,
    options: q.options,
    category: q.category,
    weights: q.weights,
    profile_map: q.profile_map,
  }));

  const { error: qErr } = await portal.from("test_questions").insert(questionRows);
  if (qErr) {
    return NextResponse.json(
      { ok: false, error: `seeding questions failed: ${qErr.message}` },
      { status: 500 },
    );
  }
  steps.push(`Seeded ${questionRows.length} questions.`);

  // 4) Grant the org explicit access (owned already implies access, this is belt
  //    and braces so it shows in every test picker / access check).
  const { error: accessErr } = await portal
    .from("org_test_access")
    .upsert(
      {
        org_id: orgId,
        test_id: test.id,
        status: "active",
        source: "manual",
        revoked_at: null,
      },
      { onConflict: "org_id,test_id" },
    );

  if (accessErr) {
    steps.push(`Warning: org_test_access upsert failed (${accessErr.message}).`);
  } else {
    steps.push("Granted org_test_access (manual).");
  }

  // 5) Optionally mint a public link.
  let link: { token: string; url: string } | null = null;
  if (createLink) {
    const token = crypto.randomUUID().replace(/-/g, "");
    const { data: linkRow, error: linkErr } = await portal
      .from("test_links")
      .insert({
        token,
        org_id: orgId,
        test_id: test.id,
        name: linkName,
        show_results: true,
        email_report: false,
        is_active: true,
        max_uses: maxUses,
        meta: { report_variant: "full" },
      })
      .select("token")
      .single();

    if (linkErr || !linkRow) {
      return NextResponse.json(
        {
          ok: false,
          error: `test created but link creation failed: ${linkErr?.message || "unknown"}`,
          test_id: test.id,
          steps,
        },
        { status: 500 },
      );
    }

    const origin = siteOrigin(req);
    link = {
      token: linkRow.token,
      url: origin ? `${origin}/t/${linkRow.token}` : `/t/${linkRow.token}`,
    };
    steps.push(`Created link ${linkRow.token}.`);
  }

  return NextResponse.json({
    ok: true,
    supabase: supabaseTarget(),
    org: { id: org.id, slug: org.slug, name: org.name },
    test: {
      id: test.id,
      slug: test.slug,
      name: test.name,
      status: test.status,
      question_count: questionRows.length,
    },
    link,
    steps,
  });
}
