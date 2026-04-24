// apps/web/app/api/public/test/[token]/result/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const AB_VALUES = ["A", "B", "C", "D"] as const;
type AB = (typeof AB_VALUES)[number];
type TotalsAB = Partial<Record<AB, number>>;

type RawAnswer = {
  question_id: string;
  value?: number | string | null;
  selected?: number | string | null;
  selected_index?: number | string | null;
  index?: number | string | null;
  text?: string | null;
};

type SecondaryMetric = {
  raw_score: number;
  percentage: number;
  eligible_count: number;
  answered_count: number;
};

function supa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;
  return createClient(url, key, { db: { schema: "portal" } });
}

function toPercentages(t: TotalsAB): Record<AB, number> {
  const sum = AB_VALUES.reduce((acc, k) => acc + Number(t?.[k] ?? 0), 0);
  const out = {} as Record<AB, number>;
  for (const k of AB_VALUES) {
    const v = Number(t?.[k] ?? 0);
    out[k] = sum > 0 ? v / sum : 0;
  }
  return out;
}

function sumAB(t: TotalsAB) {
  return AB_VALUES.reduce((acc, k) => acc + Number(t?.[k] ?? 0), 0);
}

function normalizeProfileCode(input: any): string {
  const s = String(input || "").trim().toUpperCase();
  const m = s.match(/^P(?:ROFILE)?[_\s-]?([1-8])$/i);
  if (m) return `P${m[1]}`;
  return s;
}

function normalizeFreqTotals(input: any): TotalsAB {
  if (!input || typeof input !== "object") return { A: 0, B: 0, C: 0, D: 0 };
  const t =
    input.frequencies && typeof input.frequencies === "object"
      ? input.frequencies
      : input;
  return {
    A: Number(t?.A ?? 0),
    B: Number(t?.B ?? 0),
    C: Number(t?.C ?? 0),
    D: Number(t?.D ?? 0),
  };
}

function normalizeProfileTotals(input: any): Record<string, number> {
  if (!input || typeof input !== "object") return {};

  const src =
    input.profiles && typeof input.profiles === "object"
      ? input.profiles
      : input;

  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(src || {})) {
    const code = normalizeProfileCode(k);
    if (!code) continue;
    if (!/^P[1-8]$/i.test(code)) continue;
    out[code] = Number(v || 0);
  }
  return out;
}

function normalizeRaisonDetre(input: any): SecondaryMetric {
  const nested =
    input?.secondary_scores?.raison_detre &&
    typeof input.secondary_scores.raison_detre === "object"
      ? input.secondary_scores.raison_detre
      : input?.raison_detre && typeof input.raison_detre === "object"
      ? input.raison_detre
      : null;

  return {
    raw_score: Number(
      nested?.raw_score ?? input?.raison_detre_raw_score ?? 0
    ),
    percentage: Number(
      nested?.percentage ?? input?.raison_detre_percentage ?? 0
    ),
    eligible_count: Number(nested?.eligible_count ?? 0),
    answered_count: Number(nested?.answered_count ?? 0),
  };
}

function zeroTotals(freq: TotalsAB, prof: Record<string, number>) {
  const sf = sumAB(freq);
  const sp = Object.values(prof).reduce((a, b) => a + Number(b || 0), 0);
  return sf === 0 && sp === 0;
}

function answerRawValue(a: RawAnswer): string | number | null {
  const raw =
    a?.value ?? a?.selected ?? a?.selected_index ?? a?.index ?? a?.text ?? null;
  if (raw == null) return null;
  return raw;
}

function answerSelectedIndex(a: RawAnswer, optionCount: number): number {
  const raw = answerRawValue(a);
  const n = Number(raw);
  if (!Number.isFinite(n)) return -1;

  if (a?.value != null) {
    return Math.max(0, Math.min(optionCount - 1, n - 1));
  }

  return Math.max(0, Math.min(optionCount - 1, n));
}

function resolveWeightedPoints(
  a: RawAnswer,
  weights: Record<string, any>
): number | null {
  const raw = answerRawValue(a);
  if (raw == null) return null;

  const exactKey = String(raw);
  if (Object.prototype.hasOwnProperty.call(weights, exactKey)) {
    const pts = Number(weights[exactKey]);
    return Number.isFinite(pts) ? pts : null;
  }

  const n = Number(raw);
  if (Number.isFinite(n)) {
    const plusOne = String(n + 1);
    if (Object.prototype.hasOwnProperty.call(weights, plusOne)) {
      const pts = Number(weights[plusOne]);
      return Number.isFinite(pts) ? pts : null;
    }
  }

  return null;
}

function computeRaisonDetre(
  rawAnswers: RawAnswer[],
  qrows: Array<{
    id: string;
    idx: number | null;
    category: string | null;
    weights: any | null;
    profile_map: any | null;
  }>
): SecondaryMetric {
  const byQid = new Map<string, RawAnswer>();
  for (const a of rawAnswers) {
    if (a?.question_id) byQid.set(String(a.question_id), a);
  }

  let rawScore = 0;
  let minScore = 0;
  let maxScore = 0;
  let eligibleCount = 0;
  let answeredCount = 0;

  for (const row of qrows) {
    const hasProfileMap =
      Array.isArray(row.profile_map) && row.profile_map.length > 0;
    const weights =
      row.weights && typeof row.weights === "object" ? row.weights : null;

    if (hasProfileMap) continue;
    if (!weights || Array.isArray(weights)) continue;

    const numericValues = Object.values(weights)
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n));

    if (numericValues.length === 0) continue;

    eligibleCount += 1;
    minScore += Math.min(...numericValues);
    maxScore += Math.max(...numericValues);

    const answer = byQid.get(String(row.id));
    if (!answer) continue;

    const pts = resolveWeightedPoints(answer, weights);
    if (pts == null) continue;

    rawScore += pts;
    answeredCount += 1;
  }

  const percentage =
    answeredCount > 0 && maxScore > minScore
      ? Math.round(((rawScore - minScore) / (maxScore - minScore)) * 100)
      : 0;

  return {
    raw_score: rawScore,
    percentage,
    eligible_count: eligibleCount,
    answered_count: answeredCount,
  };
}

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { token: string } }
) {
  const url = new URL(req.url);
  const token = params.token;
  const tid = url.searchParams.get("tid");

  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Missing token" },
      { status: 400 }
    );
  }

  if (!tid) {
    return NextResponse.json(
      { ok: false, error: "Missing taker id (?tid=)" },
      { status: 400 }
    );
  }

  const sb = supa();

  const link = await sb
    .from("test_links")
    .select(
      "test_id, show_results, redirect_url, hidden_results_message, next_steps_url"
    )
    .eq("token", token)
    .maybeSingle();

  if (link.error) {
    return NextResponse.json(
      { ok: false, error: link.error.message },
      { status: 500 }
    );
  }

  if (!link.data?.test_id) {
    return NextResponse.json(
      { ok: false, error: "test not found for token" },
      { status: 404 }
    );
  }

  const testId = link.data.test_id as string;

  const linkMeta = {
    show_results: link.data.show_results ?? true,
    redirect_url: (link.data.redirect_url as string | null) ?? null,
    hidden_results_message:
      (link.data.hidden_results_message as string | null) ?? null,
    next_steps_url: (link.data.next_steps_url as string | null) ?? null,
  };

  let orgSlug: string | null = null;
  let orgName: string | null = null;
  let testName: string | null = null;

  const testRes = await sb
    .from("tests")
    .select("id, name, org_id")
    .eq("id", testId)
    .maybeSingle();

  if (testRes.error) {
    console.warn("[test result] error loading test metadata", testRes.error);
  } else if (testRes.data) {
    testName = (testRes.data as any).name ?? null;

    const orgId = (testRes.data as any).org_id as string | null | undefined;
    if (orgId) {
      const orgRes = await sb
        .from("orgs")
        .select("id, slug, name")
        .eq("id", orgId)
        .maybeSingle();

      if (orgRes.error) {
        console.warn("[test result] error loading org metadata", orgRes.error);
      } else if (orgRes.data) {
        orgSlug = (orgRes.data as any).slug ?? null;
        orgName = (orgRes.data as any).name ?? null;
      }
    }
  }

  let takerFirst: string | null = null;
  let takerLast: string | null = null;

  const takerRes = await sb
    .from("test_takers")
    .select("first_name, last_name")
    .eq("id", tid)
    .maybeSingle();

  if (takerRes.error) {
    console.warn("[test result] error loading taker names", takerRes.error);
  } else if (takerRes.data) {
    takerFirst = (takerRes.data as any).first_name ?? null;
    takerLast = (takerRes.data as any).last_name ?? null;
  }

  let rawTotals: any = null;
  let rawAnswers: RawAnswer[] = [];

  const r1 = await sb
    .from("test_results")
    .select("totals")
    .eq("taker_id", tid)
    .maybeSingle();

  const r2 = await sb
    .from("test_submissions")
    .select("totals, raw_answers, answers_json")
    .eq("taker_id", tid)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  rawTotals = r1.data?.totals ?? r2.data?.totals ?? null;

  const ra = Array.isArray(r2.data?.raw_answers)
    ? r2.data?.raw_answers
    : Array.isArray(r2.data?.answers_json)
    ? r2.data?.answers_json
    : [];

  rawAnswers = ra
    .map((a: any) => ({
      question_id: String(a?.question_id ?? a?.id ?? ""),
      value: a?.value ?? null,
      selected: a?.selected ?? null,
      selected_index: a?.selected_index ?? null,
      index: a?.index ?? null,
      text: a?.text ?? null,
    }))
    .filter((x) => x.question_id);

  let frequencyTotals = normalizeFreqTotals(rawTotals);
  let profileTotals = normalizeProfileTotals(rawTotals);
  let raisonDetre = normalizeRaisonDetre(rawTotals);

  const fl = await sb
    .from("test_frequency_labels")
    .select("frequency_code, frequency_name")
    .eq("test_id", testId);

  if (fl.error) {
    return NextResponse.json(
      { ok: false, error: fl.error.message },
      { status: 500 }
    );
  }

  if (!fl.data?.length) {
    return NextResponse.json(
      { ok: false, error: "labels_missing_for_test_frequency" },
      { status: 500 }
    );
  }

  const frequencyLabels = AB_VALUES.map((c) => ({
    code: c,
    name:
      fl.data.find((r: any) => String(r.frequency_code).toUpperCase() === c)
        ?.frequency_name || `Frequency ${c}`,
  }));

  const pl = await sb
    .from("test_profile_labels")
    .select("profile_code, profile_name, frequency_code")
    .eq("test_id", testId);

  if (pl.error) {
    return NextResponse.json(
      { ok: false, error: pl.error.message },
      { status: 500 }
    );
  }

  if (!pl.data?.length) {
    return NextResponse.json(
      { ok: false, error: "labels_missing_for_test_profile" },
      { status: 500 }
    );
  }

  const profileLabels = pl.data.map((r: any) => ({
    code: normalizeProfileCode(r.profile_code),
    name: String(r.profile_name || "").trim(),
    frequency: String(r.frequency_code || "").trim().toUpperCase() as AB | null,
  }));

  if (rawAnswers.length > 0) {
    const qs = await sb
      .from("test_questions")
      .select("id, idx, category, profile_map, weights")
      .eq("test_id", testId)
      .order("idx", { ascending: true });

    if (qs.error) {
      return NextResponse.json(
        { ok: false, error: qs.error.message },
        { status: 500 }
      );
    }

    const qrows = (qs.data || []) as Array<{
      id: string;
      idx: number | null;
      category: string | null;
      profile_map: any | null;
      weights: any | null;
    }>;

    if (zeroTotals(frequencyTotals, profileTotals)) {
      const codeToFreq = new Map<string, AB>();
      for (const p of profileLabels) {
        if (p.code && p.frequency) codeToFreq.set(p.code, p.frequency);
      }

      const mapByQ = new Map<
        string,
        Array<{ profile: string; points: number }>
      >();

      for (const r of qrows) {
        const a = Array.isArray((r as any).profile_map)
          ? (r as any).profile_map
          : [];
        mapByQ.set(
          r.id,
          a.map((x: any) => ({
            profile: normalizeProfileCode(x?.profile),
            points: Number(x?.points ?? 0),
          }))
        );
      }

      const freqTotals: TotalsAB = { A: 0, B: 0, C: 0, D: 0 };
      const profTotals: Record<string, number> = {};

      for (const answer of rawAnswers) {
        const map = mapByQ.get(answer.question_id);
        if (!map || map.length === 0) continue;

        const idx = answerSelectedIndex(answer, map.length);
        const entry = map[idx];
        if (!entry) continue;

        const pcode = normalizeProfileCode(entry.profile);
        if (!pcode) continue;

        const pts = Number(entry.points || 0);
        profTotals[pcode] = (profTotals[pcode] || 0) + pts;

        const f = codeToFreq.get(pcode);
        if (f) freqTotals[f] = Number(freqTotals[f] || 0) + pts;
      }

      frequencyTotals = {
        A: Number(freqTotals.A || 0),
        B: Number(freqTotals.B || 0),
        C: Number(freqTotals.C || 0),
        D: Number(freqTotals.D || 0),
      };
      profileTotals = profTotals;
    }

    raisonDetre = computeRaisonDetre(rawAnswers, qrows);

    const mergedTotals = {
      ...(rawTotals && typeof rawTotals === "object" ? rawTotals : {}),
      frequencies: frequencyTotals,
      profiles: profileTotals,
      secondary_scores: {
        ...((rawTotals?.secondary_scores &&
          typeof rawTotals.secondary_scores === "object"
          ? rawTotals.secondary_scores
          : {}) as Record<string, any>),
        raison_detre: raisonDetre,
      },
    };

    await sb.from("test_results").upsert(
      {
        taker_id: tid,
        totals: mergedTotals,
      },
      { onConflict: "taker_id" }
    );
  }

  const freqPct = toPercentages(frequencyTotals);

  const pSum = Object.values(profileTotals).reduce(
    (a, b) => a + Number(b || 0),
    0
  );
  const profilePercentages: Record<string, number> = {};

  if (pSum > 0) {
    for (const [k, v] of Object.entries(profileTotals)) {
      profilePercentages[k] = Number(v || 0) / pSum;
    }
  }

  const topFreq =
    (Object.entries(frequencyTotals).sort(
      (a, b) => Number(b[1] || 0) - Number(a[1] || 0)
    )[0]?.[0] as AB) || "A";

  const topProfileCode =
    Object.entries(profileTotals).sort(
      (a, b) => Number(b[1] || 0) - Number(a[1] || 0)
    )[0]?.[0] ||
    profileLabels[0]?.code ||
    "P1";

  const topProfileName =
    profileLabels.find((p) => p.code === topProfileCode)?.name ||
    profileLabels[0]?.name ||
    "Top Profile";

  if (!orgSlug) {
    const freqNames = frequencyLabels
      .map((f) => (f.name || "").trim().toLowerCase())
      .filter(Boolean);

    const looksLikeCompetencyCoach =
      freqNames.includes("innovation") &&
      freqNames.includes("influence") &&
      freqNames.includes("implementation") &&
      freqNames.includes("insight");

    if (looksLikeCompetencyCoach) {
      orgSlug = "competency-coach";
      if (!orgName) orgName = "Competency Coach";
      if (!testName) testName = "Competency Coach";
    }
  }

  return NextResponse.json({
    ok: true,
    data: {
      org_slug: orgSlug,
      org_name: orgName,
      test_name: testName,

      link: linkMeta,

      taker: {
        id: tid,
        first_name: takerFirst,
        last_name: takerLast,
      },

      frequency_labels: frequencyLabels,
      frequency_totals: {
        A: Number(frequencyTotals.A || 0),
        B: Number(frequencyTotals.B || 0),
        C: Number(frequencyTotals.C || 0),
        D: Number(frequencyTotals.D || 0),
      },
      frequency_percentages: {
        A: Number(freqPct.A || 0),
        B: Number(freqPct.B || 0),
        C: Number(freqPct.C || 0),
        D: Number(freqPct.D || 0),
      },

      profile_labels: profileLabels.map((p) => ({
        code: p.code,
        name: p.name,
      })),
      profile_totals: profileTotals,
      profile_percentages: profilePercentages,

      top_freq: topFreq,
      top_profile_code: topProfileCode,
      top_profile_name: topProfileName,
      top_profile_name_full: topProfileName,

      raison_detre: raisonDetre,
      raison_detre_raw_score: Number(raisonDetre.raw_score || 0),
      raison_detre_percentage: Number(raisonDetre.percentage || 0),

      version: "portal-v1+raison-detre",
    },
  });
}
