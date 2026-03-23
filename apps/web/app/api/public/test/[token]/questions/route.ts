// apps/web/app/api/public/test/[token]/questions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LinkRow = { token: string; test_id: string; org_id?: string };
type TestRow = { id: string; slug: string | null; meta: any | null };

type ProfileMapEntry = {
  points?: number;
  profile?: string;
};

type TestQuestionRow = {
  id: string;
  idx?: number | null;
  order?: number | null;
  type?: string | null;
  text?: string | null;
  options?: string[] | null;
  category?: string | null;
  profile_map?: ProfileMapEntry[] | string | null;
  weights?: any | null;
};

function getPortalClient(): any {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRole =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE!;
  if (!url || !serviceRole) throw new Error("Missing Supabase env vars");
  return createClient(url, serviceRole, {
    auth: { persistSession: false },
    db: { schema: "portal" },
  }) as any;
}

function getVisibilityClient(): any {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRole =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE!;
  if (!url || !serviceRole) throw new Error("Missing Supabase env vars");
  return createClient(url, serviceRole, {
    auth: { persistSession: false },
    db: { schema: "visibility" },
  }) as any;
}

function isUuidLike(s: string) {
  return /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(
    String(s || "").trim()
  );
}

function normSlug(v: any) {
  return String(v || "").trim().toLowerCase();
}

function parseMaybeJson<T = any>(value: any): T | null {
  if (value == null) return null;
  if (Array.isArray(value) || typeof value === "object") return value as T;
  if (typeof value !== "string") return null;

  const s = value.trim();
  if (!s) return null;
  if (!(s.startsWith("{") || s.startsWith("["))) return null;

  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function coerceProfileMapEntries(value: any): ProfileMapEntry[] {
  const parsed = parseMaybeJson<any>(value);

  const arr = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.profile_map)
      ? parsed.profile_map
      : Array.isArray(parsed?.weights)
        ? parsed.weights
        : Array.isArray(parsed?.map)
          ? parsed.map
          : [];

  return arr
    .map((entry: any) => ({
      points: Number(entry?.points ?? 0),
      profile: String(entry?.profile || "").trim(),
    }))
    .filter((entry: ProfileMapEntry) => Number.isFinite(Number(entry.points)) && !!entry.profile);
}

function buildSyntheticOptionsFromQuestion(q: TestQuestionRow): string[] | null {
  if (Array.isArray(q.options) && q.options.length > 0) {
    return q.options;
  }

  const mapEntries = coerceProfileMapEntries(q.profile_map);
  if (mapEntries.length > 0) {
    return Array.from({ length: mapEntries.length }, (_, i) => String(i + 1));
  }

  const weightEntries = coerceProfileMapEntries(q.weights);
  if (weightEntries.length > 0) {
    return Array.from({ length: weightEntries.length }, (_, i) => String(i + 1));
  }

  return null;
}

/**
 * Resolve the canonical test that actually owns the questions.
 *
 * Supported cases:
 * 1) Normal direct tests -> use self
 * 2) Shared-source cloned tests -> use meta.source_test_id / base_test_id / parent_test_id
 * 3) QSC-style wrappers -> use source_tests / default_source_test logic
 */
async function resolveEffectiveTestId(args: {
  sb: any;
  wrapperTest: TestRow;
}): Promise<{ effectiveTestId: string; resolvedBy: string }> {
  const { sb, wrapperTest } = args;

  const meta = wrapperTest?.meta ?? {};

  const genericSource =
    typeof meta?.source_test_id === "string"
      ? meta.source_test_id
      : typeof meta?.base_test_id === "string"
        ? meta.base_test_id
        : typeof meta?.parent_test_id === "string"
          ? meta.parent_test_id
          : null;

  if (genericSource && isUuidLike(genericSource)) {
    return {
      effectiveTestId: genericSource,
      resolvedBy: "meta.source_test_id|base_test_id|parent_test_id",
    };
  }

  const isWrapper = meta?.wrapper === true;

  if (!isWrapper) {
    return { effectiveTestId: wrapperTest.id, resolvedBy: "not_wrapper" };
  }

  const sourceTests: string[] = Array.isArray(meta?.source_tests)
    ? meta.source_tests
    : [];

  const defaultSource: string | null =
    typeof meta?.default_source_test === "string"
      ? meta.default_source_test
      : null;

  if (sourceTests.length) {
    const clean = sourceTests.filter((id) => isUuidLike(id));
    if (clean.length) {
      const { data: candidates } = await sb
        .from("tests")
        .select("id, slug, meta")
        .in("id", clean);

      const list = (candidates ?? []) as TestRow[];

      const leaders = list.find((t) => normSlug(t.slug) === "qsc-leaders");
      if (leaders?.id) {
        return {
          effectiveTestId: leaders.id,
          resolvedBy: "meta.source_tests.slug=qsc-leaders",
        };
      }

      const core = list.find((t) => normSlug(t.slug) === "qsc-core");
      if (core?.id) {
        return {
          effectiveTestId: core.id,
          resolvedBy: "meta.source_tests.slug=qsc-core",
        };
      }
    }
  }

  if (defaultSource && isUuidLike(defaultSource)) {
    return {
      effectiveTestId: defaultSource,
      resolvedBy: "meta.default_source_test",
    };
  }

  if (sourceTests.length && isUuidLike(sourceTests[0])) {
    return {
      effectiveTestId: sourceTests[0],
      resolvedBy: "meta.source_tests[0]",
    };
  }

  return { effectiveTestId: wrapperTest.id, resolvedBy: "wrapper_no_sources" };
}

function optionOrder(code: string) {
  const c = String(code || "").trim().toUpperCase();
  return c === "A" ? 1 : c === "B" ? 2 : c === "C" ? 3 : c === "D" ? 4 : 99;
}

export async function GET(_req: NextRequest, ctx: { params: { token?: string } }) {
  try {
    const token = String(ctx.params?.token || "").trim();
    if (!token) {
      return NextResponse.json({ ok: false, error: "missing token" }, { status: 400 });
    }

    const sb = getPortalClient();

    const { data: linkRow, error: linkErr } = (await sb
      .from("test_links")
      .select("token, test_id, org_id")
      .eq("token", token)
      .maybeSingle()) as { data: LinkRow | null; error: any };

    if (linkErr || !linkRow) {
      return NextResponse.json({ ok: false, error: "invalid link" }, { status: 404 });
    }

    const { data: testRow, error: testErr } = (await sb
      .from("tests")
      .select("id, slug, meta")
      .eq("id", linkRow.test_id)
      .maybeSingle()) as { data: TestRow | null; error: any };

    if (testErr || !testRow) {
      return NextResponse.json(
        { ok: false, error: testErr?.message || "test not found" },
        { status: 500 }
      );
    }

    const { effectiveTestId, resolvedBy } = await resolveEffectiveTestId({
      sb,
      wrapperTest: testRow,
    });

    const { data: rows, error: qErr } = (await sb
      .from("test_questions")
      .select("id, idx, order, type, text, options, category, profile_map, weights")
      .eq("test_id", effectiveTestId)
      .order("order", { ascending: true })
      .order("idx", { ascending: true })
      .order("created_at", { ascending: true })) as {
      data: TestQuestionRow[] | null;
      error: any;
    };

    if (qErr) {
      return NextResponse.json(
        { ok: false, error: `Questions load failed: ${qErr.message}` },
        { status: 500 }
      );
    }

    const portalQuestions = (rows ?? []).map((q) => {
      const safeOptions = buildSyntheticOptionsFromQuestion(q);
      const inferredType =
        q.type ??
        (safeOptions && safeOptions.length > 0 ? "single" : null);

      return {
        id: q.id,
        idx: q.idx ?? null,
        order: q.order ?? null,
        type: inferredType,
        text: q.text ?? null,
        options: safeOptions,
        category: q.category ?? null,
      };
    });

    if (portalQuestions.length > 0) {
      return NextResponse.json({
        ok: true,
        token: linkRow.token,
        test_id: linkRow.test_id,
        effective_test_id: effectiveTestId,
        questions: portalQuestions,
        __debug: {
          engine: "portal.test_questions",
          wrapper_slug: testRow.slug ?? null,
          wrapper_is_wrapper: (testRow.meta?.wrapper === true) || false,
          resolved_by: resolvedBy,
          question_count: portalQuestions.length,
          synthetic_options_applied: portalQuestions.some(
            (q, i) =>
              (!Array.isArray((rows ?? [])[i]?.options) || !(rows ?? [])[i]?.options?.length) &&
              Array.isArray(q.options) &&
              q.options.length > 0
          ),
        },
      });
    }

    const vis = getVisibilityClient();

    const { data: vTest, error: vTestErr } = await vis
      .from("tests")
      .select("id")
      .eq("portal_test_id", linkRow.test_id)
      .maybeSingle();

    if (vTestErr) {
      return NextResponse.json(
        { ok: false, error: `Visibility test lookup failed: ${vTestErr.message}` },
        { status: 500 }
      );
    }

    if (!vTest?.id) {
      return NextResponse.json({
        ok: true,
        token: linkRow.token,
        test_id: linkRow.test_id,
        effective_test_id: effectiveTestId,
        questions: [],
        __debug: {
          engine: "none",
          wrapper_slug: testRow.slug ?? null,
          resolved_by: resolvedBy,
          question_count: 0,
        },
      });
    }

    const { data: vQs, error: vqErr } = await vis
      .from("questions")
      .select("id, idx, code, pillar, question_text")
      .eq("test_id", vTest.id)
      .eq("is_active", true)
      .order("idx", { ascending: true });

    if (vqErr) {
      return NextResponse.json(
        { ok: false, error: `Visibility questions load failed: ${vqErr.message}` },
        { status: 500 }
      );
    }

    const qIds = (vQs ?? []).map((q: any) => q.id);

    const { data: vOpts, error: voErr } = await vis
      .from("options")
      .select("question_id, option_code, option_text")
      .in("question_id", qIds)
      .eq("is_active", true);

    if (voErr) {
      return NextResponse.json(
        { ok: false, error: `Visibility options load failed: ${voErr.message}` },
        { status: 500 }
      );
    }

    const optByQ: Record<string, { option_code: string; option_text: string }[]> = {};
    for (const o of vOpts ?? []) {
      optByQ[o.question_id] = optByQ[o.question_id] || [];
      optByQ[o.question_id].push({ option_code: o.option_code, option_text: o.option_text });
    }

    const visibilityQuestions: TestQuestionRow[] = (vQs ?? []).map((q: any) => {
      const opts = (optByQ[q.id] || []).sort(
        (a, b) => optionOrder(a.option_code) - optionOrder(b.option_code)
      );
      return {
        id: q.id,
        idx: q.idx ?? null,
        order: q.idx ?? null,
        type: "single",
        text: q.question_text ?? null,
        options: opts.map((x) => x.option_text),
        category: String(q.pillar ?? "") || "scored",
      };
    });

    return NextResponse.json({
      ok: true,
      token: linkRow.token,
      test_id: linkRow.test_id,
      effective_test_id: effectiveTestId,
      questions: visibilityQuestions,
      __debug: {
        engine: "visibility.questions/options",
        visibility_test_id: vTest.id,
        wrapper_slug: testRow.slug ?? null,
        resolved_by: resolvedBy,
        question_count: visibilityQuestions.length,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}