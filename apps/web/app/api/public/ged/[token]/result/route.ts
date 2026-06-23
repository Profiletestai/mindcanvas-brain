//apps/web/app/api/public/ged/[token]/result/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  scoreGedDiagnostic,
  type GedChoiceAnswer,
  type GedDiagnostics,
} from "@/lib/ged/scoreGedDiagnostic";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PersonalityKey = "FIRE" | "FLOW" | "FORM" | "FIELD";
type MindsetKey = "ORIGIN" | "MOMENTUM" | "VECTOR" | "ORBIT" | "QUANTUM";

type QscResultsRow = {
  id: string;
  test_id: string;
  token: string;
  taker_id: string | null;
  audience: "entrepreneur" | "leader" | null;
  personality_totals: Record<string, number> | null;
  personality_percentages: Record<string, number> | null;
  mindset_totals: Record<string, number> | null;
  mindset_percentages: Record<string, number> | null;
  primary_personality: PersonalityKey | null;
  secondary_personality: PersonalityKey | null;
  primary_mindset: MindsetKey | null;
  secondary_mindset: MindsetKey | null;
  combined_profile_code: string | null;
  qsc_profile_id: string | null;
  created_at: string;
};

type QscProfileRow = {
  id: string;
  personality_code: string | null;
  mindset_level: number | null;
  profile_code: string | null;
  profile_label: string | null;
  how_to_communicate: string | null;
  decision_style: string | null;
  business_challenges: string | null;
  trust_signals: string | null;
  offer_fit: string | null;
  sale_blockers: string | null;
};

type TestTakerRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company: string | null;
  role_title: string | null;
};

type LinkMeta = {
  show_results?: boolean | null;
  redirect_url?: string | null;
  hidden_results_message?: string | null;
  next_steps_url?: string | null;
  email_report?: boolean | null;
};

type SubmissionRow = {
  id: string;
  totals: unknown;
  created_at: string;
};

function supa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_ANON_KEY!;

  return createClient(url, key, { db: { schema: "portal" } });
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(
    String(value || "").trim()
  );
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseMaybeJson(value: unknown): Record<string, any> | null {
  if (isRecord(value)) return value;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function personalityToLetter(
  personality: string | null | undefined
): "A" | "B" | "C" | "D" | null {
  const value = String(personality || "").trim().toUpperCase();
  if (value === "A" || value === "B" || value === "C" || value === "D") {
    return value;
  }
  if (value === "FIRE") return "A";
  if (value === "FLOW") return "B";
  if (value === "FORM") return "C";
  if (value === "FIELD") return "D";
  return null;
}

function mindsetToLevel(mindset: string | null | undefined): number | null {
  const value = String(mindset || "").trim().toUpperCase();
  if (value === "ORIGIN") return 1;
  if (value === "MOMENTUM") return 2;
  if (value === "VECTOR") return 3;
  if (value === "ORBIT") return 4;
  if (value === "QUANTUM") return 5;
  return null;
}

function normalizeGedChoice(value: unknown): GedChoiceAnswer | null {
  if (!isRecord(value)) return null;

  const questionId = String(value.question_id || "").trim();
  const questionText = String(value.question_text || "").trim() || null;
  const optionValue = String(value.value || "").trim() || null;
  const label = String(value.label || "").trim() || null;

  if (!questionId && !optionValue && !label) return null;

  return {
    question_id: questionId,
    question_text: questionText,
    value: optionValue,
    label,
  };
}

function readGedDiagnostics(totals: unknown): GedDiagnostics | null {
  const parsed = parseMaybeJson(totals);
  const meta = isRecord(parsed?.meta) ? parsed?.meta : null;
  const ged = isRecord(meta?.ged) ? meta?.ged : null;

  if (!ged) return null;

  const selfDiagnosis =
    typeof ged.self_diagnosis === "string" && ged.self_diagnosis.trim()
      ? ged.self_diagnosis.trim()
      : null;

  const diagnostics: GedDiagnostics = {
    business_stage: normalizeGedChoice(ged.business_stage),
    core_constraint: normalizeGedChoice(ged.core_constraint),
    scale_readiness: normalizeGedChoice(ged.scale_readiness),
    self_diagnosis: selfDiagnosis,
  };

  const hasAnySignal = Boolean(
    diagnostics.business_stage ||
      diagnostics.core_constraint ||
      diagnostics.scale_readiness ||
      diagnostics.self_diagnosis
  );

  return hasAnySignal ? diagnostics : null;
}

async function loadLinkMeta(
  sb: ReturnType<typeof supa>,
  token: string
): Promise<LinkMeta | null> {
  const { data, error } = await sb
    .from("test_links")
    .select(
      "show_results, redirect_url, hidden_results_message, next_steps_url, email_report"
    )
    .eq("token", token)
    .maybeSingle();

  if (error || !data) return null;
  return data as LinkMeta;
}

async function resolveContentTestId(
  sb: ReturnType<typeof supa>,
  wrapperTestId: string
): Promise<string> {
  const { data, error } = await sb
    .from("tests")
    .select("id, meta")
    .eq("id", wrapperTestId)
    .maybeSingle();

  if (error || !data) return wrapperTestId;

  const meta = isRecord((data as any).meta) ? (data as any).meta : {};
  if (meta.wrapper !== true) return wrapperTestId;

  const defaultSource =
    typeof meta.default_source_test === "string"
      ? meta.default_source_test.trim()
      : "";

  if (defaultSource && isUuidLike(defaultSource)) return defaultSource;

  const sourceTests = Array.isArray(meta.source_tests)
    ? meta.source_tests.filter((value: unknown) =>
        isUuidLike(String(value || ""))
      )
    : [];

  return sourceTests[0] || wrapperTestId;
}

async function findResult(args: {
  sb: ReturnType<typeof supa>;
  token: string;
  tid: string;
}): Promise<{
  result: QscResultsRow | null;
  resolvedBy: "result_id" | "token+taker_id" | "token_unique" | "token_latest" | null;
  error: string | null;
}> {
  const { sb, token, tid } = args;
  const select = `
    id,
    test_id,
    token,
    taker_id,
    audience,
    personality_totals,
    personality_percentages,
    mindset_totals,
    mindset_percentages,
    primary_personality,
    secondary_personality,
    primary_mindset,
    secondary_mindset,
    combined_profile_code,
    qsc_profile_id,
    created_at
  `;

  const entrepreneurFilter = (query: any) =>
    query.or("audience.eq.entrepreneur,audience.is.null");

  if (isUuidLike(token)) {
    const { data, error } = await entrepreneurFilter(
      sb.from("qsc_results").select(select).eq("id", token)
    ).maybeSingle();

    if (error) {
      return { result: null, resolvedBy: null, error: error.message };
    }

    if (data) {
      return {
        result: data as QscResultsRow,
        resolvedBy: "result_id",
        error: null,
      };
    }
  }

  if (tid && isUuidLike(tid)) {
    const { data, error } = await entrepreneurFilter(
      sb
        .from("qsc_results")
        .select(select)
        .eq("token", token)
        .eq("taker_id", tid)
        .order("created_at", { ascending: false })
        .limit(1)
    ).maybeSingle();

    if (error) {
      return { result: null, resolvedBy: null, error: error.message };
    }

    if (data) {
      return {
        result: data as QscResultsRow,
        resolvedBy: "token+taker_id",
        error: null,
      };
    }
  }

  const countQuery = entrepreneurFilter(
    sb
      .from("qsc_results")
      .select("id", { count: "exact", head: true })
      .eq("token", token)
  );
  const { count, error: countError } = await countQuery;

  if (countError) {
    return { result: null, resolvedBy: null, error: countError.message };
  }

  const resultCount = Number(count || 0);
  if (!tid && resultCount > 1) {
    return {
      result: null,
      resolvedBy: null,
      error: "AMBIGUOUS_TOKEN_REQUIRES_TID",
    };
  }

  if (!resultCount) {
    return { result: null, resolvedBy: null, error: null };
  }

  const { data, error } = await entrepreneurFilter(
    sb
      .from("qsc_results")
      .select(select)
      .eq("token", token)
      .order("created_at", { ascending: false })
      .limit(1)
  ).maybeSingle();

  if (error) {
    return { result: null, resolvedBy: null, error: error.message };
  }

  return {
    result: (data as QscResultsRow | null) || null,
    resolvedBy: resultCount === 1 ? "token_unique" : "token_latest",
    error: null,
  };
}

export async function GET(
  req: Request,
  { params }: { params: { token: string } }
) {
  try {
    const token = String(params.token || "").trim();
    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Missing token in URL" },
        { status: 400 }
      );
    }

    const url = new URL(req.url);
    const tid = String(url.searchParams.get("tid") || "").trim();
    const sb = supa();

    const found = await findResult({ sb, token, tid });
    if (found.error === "AMBIGUOUS_TOKEN_REQUIRES_TID") {
      return NextResponse.json(
        {
          ok: false,
          error: found.error,
          hint: "Pass ?tid=<test_takers.id> when loading a shared GED link.",
        },
        { status: 409 }
      );
    }

    if (found.error) {
      return NextResponse.json(
        { ok: false, error: `Could not load GED result: ${found.error}` },
        { status: 500 }
      );
    }

    const result = found.result;
    if (!result) {
      return NextResponse.json(
        { ok: false, error: "RESULT_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (result.audience === "leader") {
      return NextResponse.json(
        { ok: false, error: "GED_ENTREPRENEUR_REPORT_REQUIRED" },
        { status: 400 }
      );
    }

    const contentTestId = await resolveContentTestId(sb, result.test_id);

    let taker: TestTakerRow | null = null;
    if (result.taker_id) {
      const { data } = await sb
        .from("test_takers")
        .select("id, first_name, last_name, email, company, role_title")
        .eq("id", result.taker_id)
        .maybeSingle();
      if (data) taker = data as TestTakerRow;
    }

    let profile: QscProfileRow | null = null;
    if (result.qsc_profile_id) {
      const { data } = await sb
        .from("qsc_profiles")
        .select(
          "id, personality_code, mindset_level, profile_code, profile_label, how_to_communicate, decision_style, business_challenges, trust_signals, offer_fit, sale_blockers"
        )
        .eq("id", result.qsc_profile_id)
        .maybeSingle();
      if (data) profile = data as QscProfileRow;
    }

    const personalityCode =
      personalityToLetter(profile?.personality_code) ||
      personalityToLetter(result.primary_personality);
    const mindsetLevel =
      typeof profile?.mindset_level === "number"
        ? profile.mindset_level
        : mindsetToLevel(result.primary_mindset);

    let persona: Record<string, any> | null = null;
    if (personalityCode && mindsetLevel) {
      const { data } = await sb
        .from("qsc_personas")
        .select("*")
        .eq("test_id", contentTestId)
        .eq("personality_code", personalityCode)
        .eq("mindset_level", mindsetLevel)
        .maybeSingle();
      if (data) persona = data as Record<string, any>;
    }

    if (!persona && result.combined_profile_code) {
      const { data } = await sb
        .from("qsc_personas")
        .select("*")
        .eq("profile_code", result.combined_profile_code)
        .limit(1)
        .maybeSingle();
      if (data) persona = data as Record<string, any>;
    }

    let submission: SubmissionRow | null = null;
    if (result.taker_id) {
      const { data } = await sb
        .from("test_submissions")
        .select("id, totals, created_at")
        .eq("taker_id", result.taker_id)
        .eq("test_id", result.test_id)
        .eq("link_token", result.token)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) submission = data as SubmissionRow;
    }

    const diagnostics = submission ? readGedDiagnostics(submission.totals) : null;
    const engineDiagnostic = scoreGedDiagnostic(diagnostics);
    const link = await loadLinkMeta(sb, token);

    return NextResponse.json(
      {
        ok: true,
        results: result,
        profile,
        persona,
        taker,
        link,
        ged: diagnostics
          ? {
              submission_id: submission?.id || null,
              submission_created_at: submission?.created_at || null,
              diagnostics,
              engine_diagnostic: engineDiagnostic,
            }
          : null,
        __debug: {
          resolved_by: found.resolvedBy,
          content_test_id: contentTestId,
          qsc_profile_lookup: {
            personality_code: personalityCode,
            mindset_level: mindsetLevel,
          },
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Unexpected error in GED result endpoint",
      },
      { status: 500 }
    );
  }
}