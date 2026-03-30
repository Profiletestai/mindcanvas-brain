// apps/web/app/api/public/test/[token]/submit/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculateQscScores } from "@/lib/qsc-scoring";
import { sendTemplatedEmail } from "@/lib/server/emailTemplates";
import { getBaseUrl } from "@/lib/baseUrl";

type AB = "A" | "B" | "C" | "D";
type AnswerCode = "A" | "B" | "C" | "D" | "E";
type Tier = "Invisible" | "Emerging" | "Established" | "Magnetic";
type Readiness = "stabilise" | "ready_to_progress";
type PrimePillar = "visibility" | "trust" | "authority" | "dominance";
type SectionCode =
  | "personality"
  | "visibility"
  | "trust"
  | "authority"
  | "dominance";

type PMEntry = { points?: number; profile?: string };

type PortalQuestionRow = {
  id: string;
  idx?: number | string | null;
  profile_map?: PMEntry[] | null;
  weights?: any | null;
};

type VisQuestionRow = {
  id: string;
  idx: number;
  code: string;
  pillar: number;
  section_code: SectionCode | null;
  is_internal_only: boolean;
  is_scored: boolean;
};

type VisOptionRow = {
  question_id: string;
  option_code: string;
  scoring: VisScoring;
  is_active: boolean;
};

type ScoringPersonality = {
  type: "personality";
  bucket: AB;
  points: number;
};

type ScoringTier = {
  type: "tier";
  tier: Tier;
};

type ScoringPrime = {
  type: "prime";
  value?: number; // 0..4
  pillar?: PrimePillar;
  tier_weights?: Partial<Record<Tier, number>>;
};

type VisScoring = ScoringPersonality | ScoringTier | ScoringPrime;

const TIERS: Tier[] = ["Invisible", "Emerging", "Established", "Magnetic"];
const PRIME_PILLARS: PrimePillar[] = [
  "visibility",
  "trust",
  "authority",
  "dominance",
];

function supa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_ANON_KEY!;
  return createClient(url, key, { db: { schema: "portal" } });
}

function visSupa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_ANON_KEY!;
  return createClient(url, key, { db: { schema: "visibility" } });
}

function isUuidLike(s: string) {
  return /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(
    String(s || "").trim()
  );
}

function normalizeSlug(s: any) {
  return String(s || "").trim().toLowerCase();
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

function coerceProfileMapEntries(value: any): PMEntry[] {
  const direct = parseMaybeJson<any>(value);
  const arr = Array.isArray(direct)
    ? direct
    : Array.isArray((direct as any)?.profile_map)
      ? (direct as any).profile_map
      : Array.isArray((direct as any)?.weights)
        ? (direct as any).weights
        : Array.isArray((direct as any)?.map)
          ? (direct as any).map
          : [];

  return arr
    .map((entry: any) => ({
      points: Number(entry?.points ?? 0),
      profile: String(entry?.profile || "").trim(),
    }))
    .filter(
      (entry: PMEntry) =>
        Number.isFinite(Number(entry.points)) && !!entry.profile
    );
}

// Accept PROFILE_1..8 or P1..P8 → A/B/C/D; fallback if value already starts with A/B/C/D
function profileCodeToFreq(code: string): AB | null {
  const s = String(code || "").trim().toUpperCase();
  let n: number | null = null;
  const m1 = s.match(/^P(?:ROFILE)?[_\s-]?(\d+)$/);
  if (m1) n = Number(m1[1]);
  if (n && n >= 1 && n <= 8) {
    return (n <= 2 ? "A" : n <= 4 ? "B" : n <= 6 ? "C" : "D") as AB;
  }
  const ch = s[0];
  return ch === "A" || ch === "B" || ch === "C" || ch === "D"
    ? (ch as AB)
    : null;
}

function toZeroBasedSelected(row: any): number | null {
  if (row && typeof row.value === "number" && Number.isFinite(row.value)) {
    const sel = row.value - 1;
    return sel >= 0 ? sel : null;
  }

  if (typeof row?.value === "string" && row.value.trim() !== "") {
    const n = Number(row.value);
    if (Number.isFinite(n)) {
      const sel = n - 1;
      return sel >= 0 ? sel : null;
    }
  }

  if (typeof row?.index === "number") return row.index;
  if (typeof row?.selected === "number") return row.selected;
  if (typeof row?.selected_index === "number") return row.selected_index;

  if (typeof row?.index === "string" && row.index.trim() !== "") {
    const n = Number(row.index);
    if (Number.isFinite(n)) return n;
  }

  if (typeof row?.selected === "string" && row.selected.trim() !== "") {
    const n = Number(row.selected);
    if (Number.isFinite(n)) return n;
  }

  if (
    typeof row?.selected_index === "string" &&
    row.selected_index.trim() !== ""
  ) {
    const n = Number(row.selected_index);
    if (Number.isFinite(n)) return n;
  }

  if (row?.value && typeof row.value.index === "number") return row.value.index;
  return null;
}

const asNumber = (x: any, d = 0) =>
  Number.isFinite(Number(x)) ? Number(x) : d;

function normalizeEmail(v: any): string {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : "";
}

function getDefaultInternalEmail() {
  return (
    normalizeEmail(process.env.INTERNAL_NOTIFICATIONS_EMAIL) ||
    "notifications@profiletest.ai"
  );
}

function getDefaultSupportEmail() {
  return (
    normalizeEmail(process.env.INTERNAL_NOTIFICATIONS_EMAIL) ||
    "support@profiletest.ai"
  );
}

/**
 * Wrapper resolution:
 * - generic source_test_id/base_test_id/parent_test_id
 * - QSC wrapper source_tests/default_source_test
 */
async function resolveEffectiveTestId(
  sb: ReturnType<typeof supa>,
  testRow: any
): Promise<string> {
  const meta = testRow?.meta ?? {};

  const genericSource =
    typeof meta?.source_test_id === "string"
      ? meta.source_test_id
      : typeof meta?.base_test_id === "string"
        ? meta.base_test_id
        : typeof meta?.parent_test_id === "string"
          ? meta.parent_test_id
          : null;

  if (genericSource && isUuidLike(genericSource)) return genericSource;

  const isWrapper = meta?.wrapper === true;
  if (!isWrapper) return testRow?.id;

  const qscVariant = String(meta?.qsc_variant || meta?.variant || "")
    .trim()
    .toLowerCase();
  const sourceTests: string[] = Array.isArray(meta?.source_tests)
    ? meta.source_tests
    : [];
  const defaultSource =
    typeof meta?.default_source_test === "string"
      ? meta.default_source_test
      : null;

  if (sourceTests.length) {
    const clean = sourceTests.filter((id) => isUuidLike(id));
    if (clean.length) {
      const { data: candidates } = await sb
        .from("tests")
        .select("id, slug")
        .in("id", clean);

      const list = Array.isArray(candidates) ? candidates : [];
      const preferredSlug =
        qscVariant === "leader" || qscVariant === "leaders"
          ? "qsc-leaders"
          : "qsc-core";

      const preferred = list.find(
        (t: any) => normalizeSlug(t.slug) === preferredSlug
      );
      if (preferred?.id) return preferred.id;
    }
  }

  if (defaultSource && isUuidLike(defaultSource)) return defaultSource;
  if (sourceTests.length && isUuidLike(sourceTests[0])) return sourceTests[0];

  return testRow?.id;
}

type LinkBehavior = {
  show_results: boolean;
  redirect_url: string | null;
  hidden_results_message: string | null;
  next_steps_url: string | null;
  email_report: boolean;
};

/**
 * Load link behavior flags.
 */
async function loadLinkBehavior(
  sb: ReturnType<typeof supa>,
  token: string
): Promise<LinkBehavior> {
  const a1 = await sb
    .from("test_links")
    .select(
      "show_results, redirect_url, hidden_results_message, next_steps_url, email_report"
    )
    .eq("token", token)
    .maybeSingle();

  if (!a1.error) {
    const d: any = a1.data || {};
    return {
      show_results: d.show_results ?? true,
      redirect_url: d.redirect_url ?? null,
      hidden_results_message: d.hidden_results_message ?? null,
      next_steps_url: d.next_steps_url ?? null,
      email_report: d.email_report ?? false,
    };
  }

  const a2 = await sb
    .from("test_links")
    .select(
      "show_results, redirect_url, hidden_results_message, next_steps_url, email_results"
    )
    .eq("token", token)
    .maybeSingle();

  if (!a2.error) {
    const d: any = a2.data || {};
    return {
      show_results: d.show_results ?? true,
      redirect_url: d.redirect_url ?? null,
      hidden_results_message: d.hidden_results_message ?? null,
      next_steps_url: d.next_steps_url ?? null,
      email_report: d.email_results ?? false,
    };
  }

  console.warn("[submit] test_links behavior load failed", a2.error || a1.error);
  return {
    show_results: true,
    redirect_url: null,
    hidden_results_message: null,
    next_steps_url: null,
    email_report: false,
  };
}

/* ---------------- Visibility helpers ---------------- */

function safeAB(v: any): AB | null {
  return v === "A" || v === "B" || v === "C" || v === "D" ? v : null;
}

function safeAnswerCode(v: any): AnswerCode | null {
  return v === "A" || v === "B" || v === "C" || v === "D" || v === "E"
    ? v
    : null;
}

function answerValue(code: AnswerCode): number {
  switch (code) {
    case "A":
      return 0;
    case "B":
      return 1;
    case "C":
      return 2;
    case "D":
      return 3;
    case "E":
      return 4;
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function roundInt(n: number) {
  return Math.round(n);
}

function emptyTierCounts(): Record<Tier, number> {
  return {
    Invisible: 0,
    Emerging: 0,
    Established: 0,
    Magnetic: 0,
  };
}

function emptyPersonalityPoints(): Record<AB, number> {
  return { A: 0, B: 0, C: 0, D: 0 };
}

function emptyPrimePillarTotals(): Record<PrimePillar, number> {
  return {
    visibility: 0,
    trust: 0,
    authority: 0,
    dominance: 0,
  };
}

function emptyPrimePillarCounts(): Record<PrimePillar, number> {
  return {
    visibility: 0,
    trust: 0,
    authority: 0,
    dominance: 0,
  };
}

function isPrimeMode(
  engineKey: string | null | undefined,
  version: number | null | undefined
) {
  return (
    String(engineKey || "").toLowerCase() === "visibility_prime_v1" ||
    Number(version || 0) >= 2
  );
}

function getPrimePillarFromQuestion(q: VisQuestionRow): PrimePillar | null {
  if (q.section_code === "visibility") return "visibility";
  if (q.section_code === "trust") return "trust";
  if (q.section_code === "authority") return "authority";
  if (q.section_code === "dominance") return "dominance";

  const code = String(q.code || "").trim().toUpperCase();
  if (/^V[1-5]$/.test(code)) return "visibility";
  if (/^T[1-5]$/.test(code)) return "trust";
  if (/^A[1-5]$/.test(code)) return "authority";
  if (/^D[1-5]$/.test(code)) return "dominance";

  return null;
}

function isPersonalityQuestion(q: VisQuestionRow): boolean {
  if (q.section_code === "personality") return true;

  const code = String(q.code || "").trim().toUpperCase();
  if (/^P[1-8]$/.test(code)) return true;
  if (/^Q[1-8]$/.test(code) && q.pillar === 1) return true;

  return false;
}

function buildPrimeTierWeights(value: number): Record<Tier, number> {
  const weights = emptyTierCounts();
  switch (value) {
    case 0:
      weights.Invisible = 1;
      break;
    case 1:
      weights.Invisible = 0.5;
      weights.Emerging = 0.5;
      break;
    case 2:
      weights.Emerging = 1;
      break;
    case 3:
      weights.Established = 1;
      break;
    case 4:
      weights.Magnetic = 1;
      break;
    default:
      weights.Emerging = 1;
      break;
  }
  return weights;
}

function normalizePersonalityScoring(raw: any): ScoringPersonality | null {
  if (!raw || raw.type !== "personality") return null;
  const bucket = safeAB(raw.bucket);
  if (!bucket) return null;
  return {
    type: "personality",
    bucket,
    points: Number(raw.points) || 0,
  };
}

function normalizeLegacyTierScoring(raw: any): ScoringTier | null {
  if (!raw || raw.type !== "tier") return null;
  if (!TIERS.includes(raw.tier)) return null;
  return { type: "tier", tier: raw.tier };
}

function normalizePrimeScoring(
  raw: any,
  q: VisQuestionRow,
  answerCode: AnswerCode
) {
  const pillar = getPrimePillarFromQuestion(q);
  if (!pillar) return null;

  const value =
    raw?.type === "prime" && typeof raw?.value === "number"
      ? clamp(Number(raw.value), 0, 4)
      : answerValue(answerCode);

  const tier_weights =
    raw?.type === "prime" && raw?.tier_weights
      ? {
          Invisible: Number(raw.tier_weights?.Invisible || 0),
          Emerging: Number(raw.tier_weights?.Emerging || 0),
          Established: Number(raw.tier_weights?.Established || 0),
          Magnetic: Number(raw.tier_weights?.Magnetic || 0),
        }
      : buildPrimeTierWeights(value);

  return {
    pillar:
      raw?.type === "prime" && raw?.pillar
        ? (raw.pillar as PrimePillar)
        : pillar,
    value,
    tier_weights,
  };
}

function computeTierAndLevel(
  tierCounts: Record<Tier, number>,
  totalSignals: number
) {
  const tierRank: Record<Tier, number> = {
    Invisible: 1,
    Emerging: 2,
    Established: 3,
    Magnetic: 4,
  };

  const base: Record<Tier, number> = {
    Invisible: 0,
    Emerging: 5,
    Established: 10,
    Magnetic: 15,
  };

  let dominant: Tier = "Invisible";
  let bestCount = -1;
  let bestRank = -1;

  for (const t of TIERS) {
    const c = tierCounts[t] ?? 0;
    const r = tierRank[t];
    if (c > bestCount || (c === bestCount && r > bestRank)) {
      dominant = t;
      bestCount = c;
      bestRank = r;
    }
  }

  const support = tierCounts[dominant] ?? 0;
  const domRank = tierRank[dominant];

  const above = TIERS.filter((t) => tierRank[t] > domRank).reduce(
    (sum, t) => sum + (tierCounts[t] ?? 0),
    0
  );

  const below = TIERS.filter((t) => tierRank[t] < domRank).reduce(
    (sum, t) => sum + (tierCounts[t] ?? 0),
    0
  );

  const dominance = totalSignals ? (support + 0.5 * above) / totalSignals : 0;
  const tierLevel = clamp(Math.ceil(dominance * 5), 1, 5);
  const level = base[dominant] + tierLevel;

  return { tier: dominant, level, tierLevel, support, above, below, dominance };
}

function computeReadiness(tierLevel: number, below: number): Readiness {
  const minTierLevelReady = 4;
  const maxBelowAllowedReady = 3;
  return tierLevel >= minTierLevelReady && below <= maxBelowAllowedReady
    ? "ready_to_progress"
    : "stabilise";
}

function computePersonalityPercent(
  personalityPoints: Record<AB, number>
): Record<AB, number> {
  const total = Object.values(personalityPoints).reduce((sum, n) => sum + n, 0);
  if (!total) return { A: 0, B: 0, C: 0, D: 0 };

  return {
    A: roundInt((personalityPoints.A / total) * 100),
    B: roundInt((personalityPoints.B / total) * 100),
    C: roundInt((personalityPoints.C / total) * 100),
    D: roundInt((personalityPoints.D / total) * 100),
  };
}

function computePrimePillarScores(
  pillarTotals: Record<PrimePillar, number>,
  pillarCounts: Record<PrimePillar, number>
): Record<PrimePillar, number> {
  const out = {
    visibility: 0,
    trust: 0,
    authority: 0,
    dominance: 0,
  };

  for (const pillar of PRIME_PILLARS) {
    const total = pillarTotals[pillar] || 0;
    const count = pillarCounts[pillar] || 0;
    out[pillar] = count ? roundInt((total / (count * 4)) * 100) : 0;
  }

  return out;
}

function bandFromPct(pct: number) {
  if (pct < 40) return "weak";
  if (pct < 60) return "developing";
  if (pct < 80) return "strong";
  return "dominant";
}

function computePrimePillarBands(
  pillarScores: Record<PrimePillar, number>
) {
  return {
    visibility: bandFromPct(pillarScores.visibility),
    trust: bandFromPct(pillarScores.trust),
    authority: bandFromPct(pillarScores.authority),
    dominance: bandFromPct(pillarScores.dominance),
  };
}

function getWeakestStrongestPillar(
  pillarScores: Record<PrimePillar, number>
) {
  let weakest: PrimePillar = "visibility";
  let strongest: PrimePillar = "visibility";

  for (const pillar of PRIME_PILLARS) {
    if (pillarScores[pillar] < pillarScores[weakest]) weakest = pillar;
    if (pillarScores[pillar] > pillarScores[strongest]) strongest = pillar;
  }

  return { weakest, strongest };
}

function computeBalancePattern(
  pillarScores: Record<PrimePillar, number>
) {
  const values = PRIME_PILLARS.map((p) => pillarScores[p]);
  const spread = Math.max(...values) - Math.min(...values);
  const { strongest } = getWeakestStrongestPillar(pillarScores);

  if (spread <= 15) return "balanced";
  if (spread >= 35) return "volatile";
  return `${strongest}_led`;
}

function computePrimePatternTags(
  pillarScores: Record<PrimePillar, number>,
  tier: Tier
) {
  const tags: string[] = [];
  const values = PRIME_PILLARS.map((p) => pillarScores[p]);
  const spread = Math.max(...values) - Math.min(...values);

  if (spread <= 15) tags.push("balanced_profile");
  if (pillarScores.visibility >= 60 && pillarScores.trust < 40) {
    tags.push("visible_but_untrusted");
  }
  if (pillarScores.trust >= 60 && pillarScores.visibility < 40) {
    tags.push("credible_but_hidden");
  }
  if (
    pillarScores.visibility >= 60 &&
    pillarScores.trust >= 60 &&
    pillarScores.authority < 50
  ) {
    tags.push("authority_gap");
  }
  if (pillarScores.authority >= 60 && pillarScores.dominance < 50) {
    tags.push("decision_friction");
  }
  if (pillarScores.authority >= 70 && pillarScores.dominance >= 70) {
    tags.push("leadership_signal");
  }
  if (pillarScores.dominance >= 70 || tier === "Magnetic") {
    tags.push("validation_required");
  }

  return [...new Set(tags)];
}

function computePrimeReadiness(
  tier: Tier,
  tierLevel: number,
  pillarScores: Record<PrimePillar, number>
): Readiness {
  const minPillar = Math.min(
    pillarScores.visibility,
    pillarScores.trust,
    pillarScores.authority,
    pillarScores.dominance
  );

  if (tierLevel < 4) return "stabilise";

  switch (tier) {
    case "Invisible":
      return pillarScores.visibility >= 35 && pillarScores.trust >= 30
        ? "ready_to_progress"
        : "stabilise";

    case "Emerging":
      return (
        pillarScores.visibility >= 55 &&
        pillarScores.trust >= 55 &&
        pillarScores.authority >= 45 &&
        minPillar >= 35
      )
        ? "ready_to_progress"
        : "stabilise";

    case "Established":
      return (
        pillarScores.visibility >= 70 &&
        pillarScores.trust >= 70 &&
        pillarScores.authority >= 70 &&
        pillarScores.dominance >= 65 &&
        minPillar >= 55
      )
        ? "ready_to_progress"
        : "stabilise";

    case "Magnetic":
    default:
      return "stabilise";
  }
}

/* ---------------- End visibility helpers ---------------- */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: { token: string } }
) {
  try {
    const token = params.token?.trim();
    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Missing token" },
        { status: 400 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as any;
    const takerId: string | undefined =
      body.taker_id || body.takerId || body.tid;

    if (!takerId) {
      return NextResponse.json(
        { ok: false, error: "Missing taker_id" },
        { status: 400 }
      );
    }

    const answers: any[] = Array.isArray(body.answers) ? body.answers : [];
    const sb = supa();

    const linkBehavior = await loadLinkBehavior(sb, token);

    const { data: taker, error: takerErr } = await sb
      .from("test_takers")
      .select(
        "id, org_id, test_id, link_token, first_name, last_name, email, company, role_title, phone, last_result_url"
      )
      .eq("id", takerId)
      .eq("link_token", token)
      .maybeSingle();

    if (takerErr || !taker) {
      return NextResponse.json(
        { ok: false, error: "Taker not found for this token" },
        { status: 404 }
      );
    }

    const { data: test, error: testErr } = await sb
      .from("tests")
      .select("id, slug, meta, name")
      .eq("id", taker.test_id)
      .maybeSingle();

    if (testErr || !test) {
      return NextResponse.json(
        { ok: false, error: "Test not found for taker" },
        { status: 500 }
      );
    }

    // ✅ VISIBILITY BRANCH (supports legacy + prime)
    const vis = visSupa();
    const { data: vTest, error: vTestErr } = await vis
      .from("tests")
      .select("id, engine_key, version")
      .eq("portal_test_id", taker.test_id)
      .maybeSingle();

    if (vTestErr) {
      return NextResponse.json(
        {
          ok: false,
          error: `Visibility test lookup failed: ${vTestErr.message}`,
        },
        { status: 500 }
      );
    }

    if (vTest?.id) {
      const primeMode = isPrimeMode(vTest.engine_key, vTest.version);

      const { data: vQsRaw, error: vqErr } = await vis
        .from("questions")
        .select(
          "id, code, idx, pillar, section_code, is_internal_only, is_scored"
        )
        .eq("test_id", vTest.id)
        .eq("is_active", true)
        .order("idx", { ascending: true });

      if (vqErr) {
        return NextResponse.json(
          {
            ok: false,
            error: `Visibility questions load failed: ${vqErr.message}`,
          },
          { status: 500 }
        );
      }

      const vQs: VisQuestionRow[] = (vQsRaw || []).map((q: any) => ({
        id: String(q.id),
        code: String(q.code),
        idx: Number(q.idx),
        pillar: Number(q.pillar),
        section_code: q.section_code ?? null,
        is_internal_only: Boolean(q.is_internal_only),
        is_scored: Boolean(q.is_scored),
      }));

      const qIds = vQs.map((q) => q.id);

      const { data: vOptsRaw, error: voErr } = await vis
        .from("options")
        .select("question_id, option_code, scoring, is_active")
        .in("question_id", qIds)
        .eq("is_active", true);

      if (voErr) {
        return NextResponse.json(
          {
            ok: false,
            error: `Visibility options load failed: ${voErr.message}`,
          },
          { status: 500 }
        );
      }

      const vOpts: VisOptionRow[] = (vOptsRaw || []).map((o: any) => ({
        question_id: String(o.question_id),
        option_code: String(o.option_code),
        scoring: o.scoring as VisScoring,
        is_active: Boolean(o.is_active),
      }));

      const qById = new Map<string, VisQuestionRow>();
      const qCodeById = new Map<string, string>();
      for (const q of vQs) {
        qById.set(q.id, q);
        qCodeById.set(q.id, q.code);
      }

      const scoringMap: Record<string, Partial<Record<AnswerCode, VisScoring>>> =
        {};
      for (const o of vOpts) {
        const answerCode = safeAnswerCode(o.option_code);
        if (!answerCode) continue;
        scoringMap[o.question_id] = scoringMap[o.question_id] || {};
        scoringMap[o.question_id]![answerCode] = o.scoring;
      }

      const personalityPoints = emptyPersonalityPoints();
      const tierCounts = emptyTierCounts();
      const primePillarTotals = emptyPrimePillarTotals();
      const primePillarCounts = emptyPrimePillarCounts();

      let ladderSignals = 0;
      let answeredQuestions = 0;
      let answeredPersonalityQuestions = 0;

      const storedAnswers: Record<string, AnswerCode> = {};

      for (const row of answers) {
        const qid = row?.question_id || row?.qid || row?.id;
        if (!qid) continue;

        const q = qById.get(String(qid));
        if (!q) continue;

        const sel = toZeroBasedSelected(row);
        if (sel == null || sel < 0 || sel > 4) continue;

        const answerCode: AnswerCode =
          sel === 0 ? "A" : sel === 1 ? "B" : sel === 2 ? "C" : sel === 3 ? "D" : "E";

        answeredQuestions += 1;
        storedAnswers[q.code] = answerCode;

        const rawScoring = scoringMap[q.id]?.[answerCode];

        if (isPersonalityQuestion(q) || q.is_internal_only || q.is_scored === false) {
          const personality = normalizePersonalityScoring(rawScoring);
          if (personality) {
            personalityPoints[personality.bucket] += Number(personality.points || 0);
            answeredPersonalityQuestions += 1;
          }
          continue;
        }

        if (primeMode) {
          const prime = normalizePrimeScoring(rawScoring, q, answerCode);
          if (!prime) continue;

          primePillarTotals[prime.pillar] += prime.value;
          primePillarCounts[prime.pillar] += 1;

          for (const tierKey of TIERS) {
            tierCounts[tierKey] += Number(prime.tier_weights[tierKey] ?? 0);
          }

          ladderSignals += 1;
          continue;
        }

        const legacyTier = normalizeLegacyTierScoring(rawScoring);
        if (legacyTier) {
          tierCounts[legacyTier.tier] += 1;
          ladderSignals += 1;
        }
      }

      const personality_percent = computePersonalityPercent(personalityPoints);

      let personality_type: AB | null = null;
      const totalPersonalityPoints = Object.values(personalityPoints).reduce(
        (sum, n) => sum + n,
        0
      );

      if (totalPersonalityPoints > 0) {
        let bestBucket: AB = "A";
        let bestPoints = -1;
        for (const bucket of ["A", "B", "C", "D"] as AB[]) {
          if (personalityPoints[bucket] > bestPoints) {
            bestPoints = personalityPoints[bucket];
            bestBucket = bucket;
          }
        }
        personality_type = bestBucket;
      }

      const { tier, level, tierLevel, below, dominance, support, above } =
        computeTierAndLevel(tierCounts, ladderSignals);

      let readiness: Readiness = "stabilise";
      let pillar_scores: Record<string, number> = {};
      let pillar_bands: Record<string, string> = {};
      let weakest_pillar: string | null = null;
      let strongest_pillar: string | null = null;
      let balance_pattern: string | null = null;
      let pattern_tags: string[] = [];
      let overall_pct: number | null = null;
      let validation_required = false;
      let validation_status: string | null = null;

      if (primeMode) {
        const primePillarScores = computePrimePillarScores(
          primePillarTotals,
          primePillarCounts
        );
        const primePillarBands = computePrimePillarBands(primePillarScores);
        const { weakest, strongest } = getWeakestStrongestPillar(primePillarScores);

        const totalPrimeValue = PRIME_PILLARS.reduce(
          (sum, p) => sum + primePillarTotals[p],
          0
        );

        overall_pct = ladderSignals
          ? roundInt((totalPrimeValue / (ladderSignals * 4)) * 100)
          : 0;

        readiness = computePrimeReadiness(tier, tierLevel, primePillarScores);
        balance_pattern = computeBalancePattern(primePillarScores);
        pattern_tags = computePrimePatternTags(primePillarScores, tier);

        validation_required =
          primePillarScores.dominance >= 70 ||
          (primePillarScores.authority >= 70 && tier === "Magnetic");

        validation_status = validation_required
          ? "self_report_validation_required"
          : "self_report_only";

        pillar_scores = primePillarScores;
        pillar_bands = primePillarBands;
        weakest_pillar = weakest;
        strongest_pillar = strongest;
      } else {
        readiness = computeReadiness(tierLevel, below);
      }

      const fullName = [taker.first_name, taker.last_name]
        .filter(Boolean)
        .join(" ")
        .trim();

      const { data: sub, error: subErr } = await vis
        .from("submissions")
        .insert({
          org_id: taker.org_id,
          test_id: vTest.id,
          test_link_id: null,
          token,
          taker_name: fullName || null,
          taker_email: taker.email ?? null,
          answers: storedAnswers,
          metadata: {
            taker_id: taker.id,
            portal_test_id: taker.test_id,
            mode: primeMode ? "prime" : "legacy",
          },
        })
        .select("id")
        .single();

      if (subErr || !sub?.id) {
        return NextResponse.json(
          {
            ok: false,
            error: `Visibility submission insert failed: ${subErr?.message || "unknown"}`,
          },
          { status: 500 }
        );
      }

      const resultInsert: any = {
        submission_id: sub.id,
        engine_key: primeMode ? "visibility_prime_v1" : "visibility_v1",
        version: primeMode ? 2 : 1,
        personality_type,
        personality_points: personalityPoints,
        personality_percent,
        tier,
        level,
        tier_counts: tierCounts,
        readiness,
        computed: {
          portal_test_id: taker.test_id,
          visibility_test_id: vTest.id,
          mode: primeMode ? "prime" : "legacy",
          tier_level: tierLevel,
          overall_pct,
          ladder_question_count: ladderSignals,
          personality_question_count: answeredPersonalityQuestions,
          scoring_model: primeMode ? "prime_20q_v2" : "legacy_v1",
          validation_required,
          validation_status,
        },
        debug: {
          answeredQuestions,
          ladderSignals,
          support,
          above,
          below,
          dominance,
          primePillarTotals: primeMode ? primePillarTotals : undefined,
          primePillarCounts: primeMode ? primePillarCounts : undefined,
        },
      };

      if (primeMode) {
        resultInsert.pillar_scores = pillar_scores;
        resultInsert.pillar_bands = pillar_bands;
        resultInsert.weakest_pillar = weakest_pillar;
        resultInsert.strongest_pillar = strongest_pillar;
        resultInsert.balance_pattern = balance_pattern;
        resultInsert.pattern_tags = pattern_tags;
      }

      const { data: resRow, error: resErr } = await vis
        .from("results")
        .insert(resultInsert)
        .select(
          "id, engine_key, version, tier, level, readiness, personality_type, personality_percent, pillar_scores, pillar_bands, weakest_pillar, strongest_pillar, balance_pattern, pattern_tags, computed"
        )
        .single();

      if (resErr || !resRow?.id) {
        return NextResponse.json(
          {
            ok: false,
            error: `Visibility results insert failed: ${resErr?.message || "unknown"}`,
          },
          { status: 500 }
        );
      }

      if (!primeMode) {
        try {
          const { data: pillarRpc, error: pillarErr } = await vis.rpc(
            "compute_pillar_signals_for_submission",
            { p_submission_id: sub.id }
          );

          if (!pillarErr && pillarRpc?.ok === true && pillarRpc?.computed) {
            const pillarComputed = pillarRpc.computed;

            await vis
              .from("results")
              .update({
                pillar_scores: pillarComputed.pillar_scores ?? {},
                pillar_bands: pillarComputed.pillar_bands ?? {},
                weakest_pillar: pillarComputed.weakest_pillar ?? null,
                strongest_pillar: pillarComputed.strongest_pillar ?? null,
                pattern_tags: Array.isArray(pillarComputed.pattern_tags)
                  ? pillarComputed.pattern_tags
                  : [],
              })
              .eq("id", resRow.id);
          }
        } catch (e) {
          console.warn("[visibility submit] legacy pillar compute failed", e);
        }
      }

      const totals = {
        visibility: {
          tier,
          level,
          readiness,
          personality_type,
          personality_points: personalityPoints,
          personality_percent,
          tier_counts: tierCounts,
          pillar_scores,
          pillar_bands,
          weakest_pillar,
          strongest_pillar,
          balance_pattern,
          pattern_tags,
          overall_pct,
          validation_required,
          validation_status,
        },
        meta: {
          engine: primeMode ? "visibility_prime_v1" : "visibility_v1",
          portal_test_id: taker.test_id,
          visibility_test_id: vTest.id,
          submission_id: sub.id,
          result_id: resRow.id,
          mode: primeMode ? "prime" : "legacy",
        },
      };

      const { error: sub2Err } = await sb.from("test_submissions").insert({
        taker_id: taker.id,
        test_id: taker.test_id,
        link_token: token,
        totals,
        answers_json: answers,
        raw_answers: answers,
        first_name: taker.first_name ?? null,
        last_name: taker.last_name ?? null,
        email: taker.email ?? null,
        company: taker.company ?? null,
        role_title: taker.role_title ?? null,
      });

      if (sub2Err) {
        return NextResponse.json(
          {
            ok: false,
            error: `Portal submission insert failed: ${sub2Err.message}`,
          },
          { status: 500 }
        );
      }

      const { error: upErr } = await sb
        .from("test_results")
        .upsert({ taker_id: taker.id, totals }, { onConflict: "taker_id" });

      if (upErr) {
        return NextResponse.json(
          { ok: false, error: `Portal results upsert failed: ${upErr.message}` },
          { status: 500 }
        );
      }

      const origin = getBaseUrl();

      const reportPath = `/t/${encodeURIComponent(token)}/visibility/report?tid=${encodeURIComponent(
        taker.id
      )}&sid=${encodeURIComponent(sub.id)}`;

      const resultPath = `/t/${encodeURIComponent(token)}/result?tid=${encodeURIComponent(
        taker.id
      )}`;

      const baseReportUrl = `${origin}${reportPath}`;
      const baseResultUrl = `${origin}${resultPath}`;

      await sb
        .from("test_takers")
        .update({
          status: "completed",
          last_result_url: reportPath,
        })
        .eq("id", taker.id)
        .eq("link_token", token);

      const { data: orgRow } = await sb
        .from("orgs")
        .select("id, slug, name, support_email, notification_email, website_url")
        .eq("id", taker.org_id)
        .maybeSingle();

      const orgName =
        String((orgRow as any)?.name || (orgRow as any)?.slug || "").trim() ||
        "MindCanvas";

      const supportEmail =
        normalizeEmail((orgRow as any)?.support_email) || getDefaultSupportEmail();

      let takerEmailResult: any = null;
      try {
        if (linkBehavior.email_report && normalizeEmail(taker.email)) {
          takerEmailResult = await sendTemplatedEmail({
            orgId: taker.org_id,
            type: "test_taker_report",
            to: String(taker.email),
            context: {
              first_name: taker.first_name || "there",
              test_name: (test.name as string) || "Visibility Ladder",
              report_link: baseReportUrl,
              org_name: orgName,
              support_email: supportEmail,
            },
          });

          if (!takerEmailResult?.ok) {
            console.error("[visibility submit] test_taker_report failed", takerEmailResult);
          }
        }
      } catch (e) {
        console.error("[visibility submit] test_taker_report unexpected error", e);
      }

      let ownerNotification: any = null;
      try {
        const sentTo =
          normalizeEmail((orgRow as any)?.notification_email) ||
          getDefaultInternalEmail();

        if (normalizeEmail(sentTo)) {
          const internalReportLink = `${origin}/portal/${(orgRow as any)?.slug}/database/${taker.id}`;
          const internalResultsDashboardLink = `${origin}/portal/${(orgRow as any)?.slug}/dashboard?testId=${taker.test_id}`;

          ownerNotification = await sendTemplatedEmail({
            orgId: (orgRow as any)?.id || taker.org_id,
            type: "test_owner_notification",
            to: sentTo,
            context: {
              owner_first_name: "",
              owner_full_name: "",
              test_taker_full_name: fullName || (taker as any).email || "",
              test_taker_email: (taker as any).email || "",
              test_taker_mobile: (taker as any).phone || "",
              test_taker_org: (taker as any).company || "",
              test_name: (test.name as string) || "Visibility Ladder",
              internal_report_link: internalReportLink,
              internal_results_dashboard_link: internalResultsDashboardLink,
              org_name: orgName,
              owner_website: (orgRow as any)?.website_url || "",
            },
          });

          if (!ownerNotification?.ok) {
            console.error(
              "[visibility submit] test_owner_notification failed",
              ownerNotification
            );
          }
        }
      } catch (e) {
        console.error("[visibility submit] owner notification unexpected error", e);
      }

      const redirectPath =
        linkBehavior.show_results === true
          ? reportPath
          : linkBehavior.redirect_url && linkBehavior.redirect_url.trim().length
            ? linkBehavior.redirect_url.trim()
            : reportPath;

      return NextResponse.json({
        ok: true,
        totals,
        link: {
          show_results: linkBehavior.show_results,
          redirect_url: linkBehavior.redirect_url,
          hidden_results_message: linkBehavior.hidden_results_message,
          next_steps_url: linkBehavior.next_steps_url,
          email_report: linkBehavior.email_report,
        },
        redirect: redirectPath,
        redirect_url: redirectPath,
        result_url: baseResultUrl,
        report_url: baseReportUrl,
        visibility: {
          submission_id: sub.id,
          result_id: resRow.id,
          visibility_test_id: vTest.id,
          engine_key: resRow.engine_key,
          version: resRow.version,
        },
        owner_notification: ownerNotification,
        taker_email: takerEmailResult,
      });
    }

    // ---------- Existing behaviour for all other tests ----------
    const effectiveTestId = await resolveEffectiveTestId(sb, test);

    const slug: string = (test.slug as string) || "";
    const meta: any = test.meta || {};
    const frameworkType: string =
      (meta?.frameworkType as string) ||
      (meta?.frameworktype as string) ||
      "";
    const kind: string = (meta?.kind as string) || "";
    const resultType: string =
      (meta?.resultType as string) || (meta?.resulttype as string) || "";
    const qscVariant: string =
      (meta?.qsc_variant as string) || (meta?.variant as string) || "";

    const slugLower = slug.toLowerCase();
    const frameworkTypeLower = frameworkType.toLowerCase();
    const kindLower = kind.toLowerCase();
    const resultTypeLower = resultType.toLowerCase();
    const qscVariantLower = qscVariant.toLowerCase();
    const testFamilyLower = String(
      meta?.test_family || meta?.testFamily || ""
    ).toLowerCase();

    const isQscTest =
      slugLower.startsWith("qsc-") ||
      frameworkTypeLower === "qsc" ||
      kindLower === "qsc" ||
      resultTypeLower === "qsc" ||
      testFamilyLower === "qsc" ||
      ["entrepreneur", "leader", "leaders"].includes(qscVariantLower);

    const isQscEntrepreneur =
      isQscTest && (qscVariantLower === "entrepreneur" || slugLower.includes("core"));

    const qscAudience: "entrepreneur" | "leader" = isQscEntrepreneur
      ? "entrepreneur"
      : "leader";

    const { data: questions, error: qErr } = await sb
      .from("test_questions")
      .select("id, idx, profile_map, weights")
      .eq("test_id", effectiveTestId)
      .order("idx", { ascending: true })
      .order("created_at", { ascending: true });

    if (qErr) {
      return NextResponse.json(
        { ok: false, error: `Questions load failed: ${qErr.message}` },
        { status: 500 }
      );
    }

    const byId: Record<string, PortalQuestionRow> = {};
    for (const q of questions || []) {
      byId[q.id] = q;
    }

    const { data: labels, error: labErr } = await sb
      .from("test_profile_labels")
      .select("profile_code, profile_name, frequency_code")
      .eq("test_id", effectiveTestId);

    if (labErr) {
      return NextResponse.json(
        { ok: false, error: `Labels load failed: ${labErr.message}` },
        { status: 500 }
      );
    }

    const nameToCode = new Map<string, string>();
    const codeToFreq = new Map<string, AB>();

    for (const r of labels || []) {
      const code = String((r as any).profile_code || "").trim();
      const name = String((r as any).profile_name || "").trim();
      const f = String((r as any).frequency_code || "").trim().toUpperCase();

      if (name && code) nameToCode.set(name, code);
      if (code) {
        if (f === "A" || f === "B" || f === "C" || f === "D") {
          codeToFreq.set(code, f as AB);
        } else {
          const implied = profileCodeToFreq(code);
          if (implied) codeToFreq.set(code, implied);
        }
      }
    }

    const freqTotals: Record<AB, number> = { A: 0, B: 0, C: 0, D: 0 };
    const profileTotals: Record<string, number> = {};

    for (let idx = 0; idx < answers.length; idx++) {
      const row = answers[idx];
      const qid = row?.question_id || row?.qid || row?.id;
      const q: PortalQuestionRow | undefined = qid ? byId[qid] : undefined;
      if (!q) continue;

      const mapEntries = coerceProfileMapEntries(q.profile_map);
      const fallbackEntries = coerceProfileMapEntries(q.weights);
      const scoringEntries = mapEntries.length ? mapEntries : fallbackEntries;
      if (!Array.isArray(scoringEntries) || scoringEntries.length === 0) continue;

      const sel = toZeroBasedSelected(row);
      if (sel == null || sel < 0 || sel >= scoringEntries.length) continue;

      const entry = scoringEntries[sel] || {};
      const points = asNumber(entry.points, 0);
      let pcode = String(entry.profile || "").trim();

      if (pcode && !/^P(?:ROFILE)?[_\s-]?\d+$/i.test(pcode)) {
        const fromName = nameToCode.get(pcode);
        if (fromName) pcode = fromName;
      }
      if (!pcode || points <= 0) continue;

      profileTotals[pcode] = (profileTotals[pcode] || 0) + points;

      const f = codeToFreq.get(pcode) || profileCodeToFreq(pcode);
      if (f) freqTotals[f] += points;
    }

    const totals = {
      frequencies: {
        A: freqTotals.A,
        B: freqTotals.B,
        C: freqTotals.C,
        D: freqTotals.D,
      },
      profiles: profileTotals,
      meta: {
        wrapper_test_id: taker.test_id,
        effective_test_id: effectiveTestId,
      },
    };

    const { error: subErr } = await sb.from("test_submissions").insert({
      taker_id: taker.id,
      test_id: taker.test_id,
      link_token: token,
      totals,
      answers_json: answers,
      raw_answers: answers,
      first_name: taker.first_name ?? null,
      last_name: taker.last_name ?? null,
      email: taker.email ?? null,
      company: taker.company ?? null,
      role_title: taker.role_title ?? null,
    });

    if (subErr) {
      return NextResponse.json(
        { ok: false, error: `Submission insert failed: ${subErr.message}` },
        { status: 500 }
      );
    }

    const { error: upErr } = await sb
      .from("test_results")
      .upsert({ taker_id: taker.id, totals }, { onConflict: "taker_id" });

    if (upErr) {
      return NextResponse.json(
        { ok: false, error: `Results upsert failed: ${upErr.message}` },
        { status: 500 }
      );
    }

    // ---------------- QSC SCORING ----------------
    if (isQscTest) {
      try {
        const questionsForScoring = (questions || [])
          .map((q: any) => {
            const mapEntries = coerceProfileMapEntries(q.profile_map);
            const fallbackEntries = coerceProfileMapEntries(q.weights);
            const scoringEntries = mapEntries.length ? mapEntries : fallbackEntries;

            return {
              id: q.id as string,
              idx: (q.idx as number | null) ?? null,
              profile_map: scoringEntries as any,
            };
          })
          .filter(
            (q) => Array.isArray(q.profile_map) && q.profile_map.length > 0
          );

        const answersForScoring = answers
          .map((row: any) => {
            const qid = row?.question_id || row?.qid || row?.id;
            const sel = toZeroBasedSelected(row);
            return { question_id: qid as string, choice: sel ?? -1 };
          })
          .filter((a: any) => a.question_id && a.choice >= 0);

        if (questionsForScoring.length === 0) {
          throw new Error(
            `QSC scoring found no scoreable questions for effective_test_id=${effectiveTestId}`
          );
        }

        if (answersForScoring.length === 0) {
          throw new Error("QSC scoring found no scoreable answers in submit payload");
        }

        const scoring = calculateQscScores(
          questionsForScoring,
          answersForScoring
        );

        const personalityCount = Object.keys(
          scoring.personalityTotals || {}
        ).length;
        const mindsetCount = Object.keys(scoring.mindsetTotals || {}).length;

        if (personalityCount === 0 && mindsetCount === 0) {
          throw new Error(
            `QSC scoring produced empty totals. personality=${JSON.stringify(
              scoring.personalityTotals || {}
            )} mindset=${JSON.stringify(scoring.mindsetTotals || {})}`
          );
        }

        let qscProfileId: string | null = null;

        if (scoring.combinedProfileCode) {
          const [personalityKey, mindsetKey] =
            scoring.combinedProfileCode.split("_");

          const personalityMap: Record<string, string> = {
            FIRE: "A",
            FLOW: "B",
            FORM: "C",
            FIELD: "D",
          };
          const mindsetMap: Record<string, number> = {
            ORIGIN: 1,
            MOMENTUM: 2,
            VECTOR: 3,
            ORBIT: 4,
            QUANTUM: 5,
          };

          const personality_code = personalityMap[personalityKey];
          const mindset_level = mindsetMap[mindsetKey];

          if (personality_code && mindset_level) {
            const { data: qscProfileRow, error: qscProfileError } = await sb
              .from("qsc_profiles")
              .select("id")
              .eq("personality_code", personality_code)
              .eq("mindset_level", mindset_level)
              .maybeSingle();

            if (qscProfileError) {
              throw new Error(
                `QSC profile lookup failed: ${qscProfileError.message}`
              );
            }

            qscProfileId = (qscProfileRow as any)?.id ?? null;
          }
        }

        const qscPayload = {
          taker_id: taker.id,
          test_id: taker.test_id,
          token,
          audience: qscAudience,
          personality_totals: scoring.personalityTotals,
          personality_percentages: scoring.personalityPercentages,
          mindset_totals: scoring.mindsetTotals,
          mindset_percentages: scoring.mindsetPercentages,
          primary_personality: scoring.primaryPersonality,
          secondary_personality: scoring.secondaryPersonality,
          primary_mindset: scoring.primaryMindset,
          secondary_mindset: scoring.secondaryMindset,
          combined_profile_code: scoring.combinedProfileCode,
          qsc_profile_id: qscProfileId,
        };

        const { data: existingQsc, error: existingErr } = await sb
          .from("qsc_results")
          .select("id")
          .eq("taker_id", taker.id)
          .eq("test_id", taker.test_id)
          .eq("token", token)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingErr) {
          throw new Error(
            `QSC existing row lookup failed: ${existingErr.message}`
          );
        }

        if (existingQsc?.id) {
          const { error: qscUpdateError } = await sb
            .from("qsc_results")
            .update(qscPayload)
            .eq("id", existingQsc.id);

          if (qscUpdateError) {
            throw new Error(
              `QSC scoring failed during update: ${qscUpdateError.message}`
            );
          }
        } else {
          const { error: qscInsertError } = await sb
            .from("qsc_results")
            .insert(qscPayload);

          if (qscInsertError) {
            throw new Error(
              `QSC scoring failed during insert: ${qscInsertError.message}`
            );
          }
        }
      } catch (e: any) {
        return NextResponse.json(
          { ok: false, error: `QSC scoring failed: ${String(e?.message || e)}` },
          { status: 500 }
        );
      }
    }
    // ---------------- END QSC SCORING ----------------

    const origin = getBaseUrl();

    const reportPath = `/t/${encodeURIComponent(
      token
    )}/report?tid=${encodeURIComponent(taker.id)}`;
    const resultPath = `/t/${encodeURIComponent(
      token
    )}/result?tid=${encodeURIComponent(taker.id)}`;

    const baseReportUrl = `${origin}${reportPath}`;
    const baseResultUrl = `${origin}${resultPath}`;

    const qscGrowthPath = `/qsc/${encodeURIComponent(
      token
    )}/entrepreneur?tid=${encodeURIComponent(taker.id)}`;
    const qscLeaderPath = `/qsc/${encodeURIComponent(
      token
    )}/leader?tid=${encodeURIComponent(taker.id)}`;

    const qscPublicPath = isQscEntrepreneur ? qscGrowthPath : qscLeaderPath;
    const qscPublicUrl = `${origin}${qscPublicPath}`;

    await sb
      .from("test_takers")
      .update({
        status: "completed",
        last_result_url: isQscTest ? qscPublicPath : reportPath,
      })
      .eq("id", taker.id)
      .eq("link_token", token);

    const reportUrlForEmail = isQscTest ? qscPublicUrl : baseReportUrl;

    const redirectUrl: string =
      linkBehavior.show_results === true
        ? isQscTest
          ? qscPublicPath
          : reportPath
        : linkBehavior.redirect_url && linkBehavior.redirect_url.trim().length
          ? linkBehavior.redirect_url.trim()
          : resultPath;

    const { data: orgRow } = await sb
      .from("orgs")
      .select("id, slug, name, support_email, notification_email, website_url")
      .eq("id", taker.org_id)
      .maybeSingle();

    const orgName =
      String((orgRow as any)?.name || (orgRow as any)?.slug || "").trim() ||
      "MindCanvas";

    const supportEmail =
      normalizeEmail((orgRow as any)?.support_email) ||
      getDefaultSupportEmail();

    let takerEmailResult: any = null;
    try {
      if (linkBehavior.email_report && normalizeEmail(taker.email)) {
        takerEmailResult = await sendTemplatedEmail({
          orgId: taker.org_id,
          type: "test_taker_report",
          to: String(taker.email),
          context: {
            first_name: taker.first_name || "there",
            test_name: (test.name as string) || slug || "your assessment",
            report_link: reportUrlForEmail,
            org_name: orgName,
            support_email: supportEmail,
          },
        });

        if (!takerEmailResult?.ok) {
          console.error("[submit] test_taker_report failed", takerEmailResult);
        }
      }
    } catch (e) {
      console.error("[submit] test_taker_report unexpected error", e);
    }

    let ownerNotification: any = null;
    try {
      const sentTo =
        normalizeEmail((orgRow as any)?.notification_email) ||
        getDefaultInternalEmail();

      const firstName = (taker as any).first_name || "";
      const lastName = (taker as any).last_name || "";
      const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

      if (normalizeEmail(sentTo)) {
        const internalReportLink = `${origin}/portal/${(orgRow as any)?.slug}/database/${taker.id}`;
        const internalResultsDashboardLink = `${origin}/portal/${(orgRow as any)?.slug}/dashboard?testId=${taker.test_id}`;

        ownerNotification = await sendTemplatedEmail({
          orgId: (orgRow as any)?.id || taker.org_id,
          type: "test_owner_notification",
          to: sentTo,
          context: {
            owner_first_name: "",
            owner_full_name: "",
            test_taker_full_name: fullName || (taker as any).email || "",
            test_taker_email: (taker as any).email || "",
            test_taker_mobile: (taker as any).phone || "",
            test_taker_org: (taker as any).company || "",
            test_name: (test.name as string) || slug || "your assessment",
            internal_report_link: internalReportLink,
            internal_results_dashboard_link: internalResultsDashboardLink,
            org_name: orgName,
            owner_website: (orgRow as any)?.website_url || "",
          },
        });

        if (!ownerNotification?.ok) {
          console.error("[submit] test_owner_notification failed", ownerNotification);
        }
      }
    } catch (e) {
      console.error("[submit] owner notification unexpected error", e);
    }

    return NextResponse.json({
      ok: true,
      totals,
      link: {
        show_results: linkBehavior.show_results,
        redirect_url: linkBehavior.redirect_url,
        hidden_results_message: linkBehavior.hidden_results_message,
        next_steps_url: linkBehavior.next_steps_url,
        email_report: linkBehavior.email_report,
      },
      redirect: redirectUrl,
      result_url: baseResultUrl,
      report_url: baseReportUrl,
      qsc_public_path: isQscTest ? qscPublicPath : null,
      qsc_public_url: isQscTest ? qscPublicUrl : null,
      owner_notification: ownerNotification,
      taker_email: takerEmailResult,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}