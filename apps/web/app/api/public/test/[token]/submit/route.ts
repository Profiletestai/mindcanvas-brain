// apps/web/app/api/public/test/[token]/submit/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculateQscScores } from "@/lib/qsc-scoring";
import { sendTemplatedEmail } from "@/lib/server/emailTemplates";
import { getBaseUrl } from "@/lib/baseUrl";

type AB = "A" | "B" | "C" | "D";
type Tier = "Invisible" | "Emerging" | "Established" | "Magnetic";
type Readiness = "stabilise" | "ready_to_progress";

type PMEntry = { points?: number; profile?: string };
type QuestionRow = {
  id: string;
  idx?: number | string | null;
  profile_map?: PMEntry[] | null;
};

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
  if (typeof row.index === "number") return row.index;
  if (typeof row.selected === "number") return row.selected;
  if (typeof row.selected_index === "number") return row.selected_index;
  if (row?.value && typeof row.value.index === "number") return row.value.index;
  return null;
}

const asNumber = (x: any, d = 0) => (Number.isFinite(Number(x)) ? Number(x) : d);

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
 * If tests.meta.wrapper = true, use meta.default_source_test (or source_tests[0])
 * as the effective test ID to load questions/labels/scoring.
 */
function resolveEffectiveTestId(testRow: any): string {
  const meta = testRow?.meta ?? {};
  const isWrapper = meta?.wrapper === true;
  if (!isWrapper) return testRow?.id;

  const def = meta?.default_source_test;
  if (typeof def === "string" && def.length > 10) return def;

  const arr = meta?.source_tests;
  if (Array.isArray(arr) && typeof arr[0] === "string") return arr[0];

  return testRow?.id;
}

type LinkBehavior = {
  show_results: boolean;
  redirect_url: string | null;
  hidden_results_message: string | null;
  next_steps_url: string | null;
  email_report: boolean; // ✅ real DB column
};

/**
 * Load link behavior flags.
 *
 * Your DB column is `email_report`.
 * Some older code referenced `email_results`, so we fall back to that if needed.
 */
async function loadLinkBehavior(
  sb: ReturnType<typeof supa>,
  token: string
): Promise<LinkBehavior> {
  // ✅ attempt using current schema (email_report)
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

  // ⚠️ fallback: older schema might have email_results
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

// -------- Visibility scoring helpers ----------
type ScoringPersonality = { type: "personality"; bucket: AB; points: number };
type ScoringTier = { type: "tier"; tier: Tier };
type Scoring = ScoringPersonality | ScoringTier;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
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
  const tiers: Tier[] = ["Invisible", "Emerging", "Established", "Magnetic"];

  let dominant: Tier = "Invisible";
  let bestCount = -1;
  let bestRank = -1;
  for (const t of tiers) {
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

  const above = tiers
    .filter((t) => tierRank[t] > domRank)
    .reduce((s, t) => s + (tierCounts[t] ?? 0), 0);

  const below = tiers
    .filter((t) => tierRank[t] < domRank)
    .reduce((s, t) => s + (tierCounts[t] ?? 0), 0);

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
// -------- End visibility helpers ----------

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

    // Load link behavior flags (show/hide/redirect/email)
    const linkBehavior = await loadLinkBehavior(sb, token);

    // Resolve taker → wrapper test (org-facing)
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

    // Load wrapper test row (the one linked to the token)
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

    // ✅ VISIBILITY BRANCH (only activates if linked in visibility.tests)
    // This does NOT affect other tests.
    const vis = visSupa();
    const { data: vTest, error: vTestErr } = await vis
      .from("tests")
      .select("id")
      .eq("portal_test_id", taker.test_id)
      .maybeSingle();

    if (vTestErr) {
      return NextResponse.json(
        { ok: false, error: `Visibility test lookup failed: ${vTestErr.message}` },
        { status: 500 }
      );
    }

    if (vTest?.id) {
      // Load visibility questions + options scoring
      const { data: vQs, error: vqErr } = await vis
        .from("questions")
        .select("id, code, idx, pillar")
        .eq("test_id", vTest.id)
        .eq("is_active", true);

      if (vqErr) {
        return NextResponse.json(
          { ok: false, error: `Visibility questions load failed: ${vqErr.message}` },
          { status: 500 }
        );
      }

      const qIds = (vQs ?? []).map((q: any) => q.id);

      const { data: vOpts, error: voErr } = await vis
        .from("options")
        .select("question_id, option_code, scoring")
        .in("question_id", qIds)
        .eq("is_active", true);

      if (voErr) {
        return NextResponse.json(
          { ok: false, error: `Visibility options load failed: ${voErr.message}` },
          { status: 500 }
        );
      }

      const codeByQid = new Map<string, string>();
      for (const q of vQs ?? []) codeByQid.set(q.id, String(q.code));

      const scoringMap: Record<string, Partial<Record<AB, Scoring>>> = {};
      for (const o of vOpts ?? []) {
        const ab = String(o.option_code).toUpperCase() as AB;
        if (ab !== "A" && ab !== "B" && ab !== "C" && ab !== "D") continue;
        scoringMap[o.question_id] = scoringMap[o.question_id] || {};
        scoringMap[o.question_id]![ab] = o.scoring as Scoring;
      }

      // Score
      const personalityPoints: Record<AB, number> = {
        A: 0,
        B: 0,
        C: 0,
        D: 0,
      };
      const tierCounts: Record<Tier, number> = {
        Invisible: 0,
        Emerging: 0,
        Established: 0,
        Magnetic: 0,
      };
      let ladderSignals = 0;

      // Store answers as QCODE -> AB (for visibility.submissions.answers)
      const storedAnswers: Record<string, AB> = {};

      for (const row of answers) {
        const qid = row?.question_id || row?.qid || row?.id;
        if (!qid) continue;

        const sel = toZeroBasedSelected(row);
        if (sel == null || sel < 0 || sel > 3) continue;

        const ab: AB = sel === 0 ? "A" : sel === 1 ? "B" : sel === 2 ? "C" : "D";
        const qCode = codeByQid.get(qid);
        if (qCode) storedAnswers[qCode] = ab;

        const scoring = scoringMap[qid]?.[ab];
        if (!scoring) continue;

        if ((scoring as any).type === "personality") {
          const s = scoring as ScoringPersonality;
          personalityPoints[s.bucket] += Number(s.points || 0);
        } else if ((scoring as any).type === "tier") {
          const s = scoring as ScoringTier;
          tierCounts[s.tier] += 1;
          ladderSignals += 1;
        }
      }

      // Dominant personality
      const types: AB[] = ["A", "B", "C", "D"];
      let personality_type: AB = "A";
      let best = -1;
      for (const t of types) {
        if (personalityPoints[t] > best) {
          best = personalityPoints[t];
          personality_type = t;
        }
      }

      const { tier, level, tierLevel, below, dominance, support, above } =
        computeTierAndLevel(tierCounts, ladderSignals);

      const readiness = computeReadiness(tierLevel, below);

      // Persist into visibility schema
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
          metadata: { taker_id: taker.id, portal_test_id: taker.test_id },
        })
        .select("id")
        .single();

      if (subErr) {
        return NextResponse.json(
          { ok: false, error: `Visibility submission insert failed: ${subErr.message}` },
          { status: 500 }
        );
      }

      const { error: resErr } = await vis.from("results").insert({
        submission_id: sub.id,
        engine_key: "visibility_v1",
        version: 1,
        personality_type,
        personality_points: personalityPoints,
        tier,
        level,
        tier_counts: tierCounts,
        readiness,
        computed: { tier_level: tierLevel },
        debug: { ladderSignals, support, above, below, dominance },
      });

      if (resErr) {
        return NextResponse.json(
          { ok: false, error: `Visibility results insert failed: ${resErr.message}` },
          { status: 500 }
        );
      }

      // Also store a minimal totals payload into portal tables (so portal UX doesn’t break)
      const totals = {
        visibility: {
          tier,
          level,
          readiness,
          personality_type,
          personality_points: personalityPoints,
          tier_counts: tierCounts,
        },
        meta: {
          engine: "visibility_v1",
          portal_test_id: taker.test_id,
          visibility_test_id: vTest.id,
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
          { ok: false, error: `Portal submission insert failed: ${sub2Err.message}` },
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

      // ✅ Canonical base for ALL absolute links
      const origin = getBaseUrl();

      // ✅ NEW: Visibility uses its own bespoke report route (no ReportGate/template)
      const reportPath = `/t/${encodeURIComponent(
        token
      )}/visibility/report?tid=${encodeURIComponent(taker.id)}`;

      const resultPath = `/t/${encodeURIComponent(
        token
      )}/result?tid=${encodeURIComponent(taker.id)}`;

      const baseReportUrl = `${origin}${reportPath}`;
      const baseResultUrl = `${origin}${resultPath}`;

      // Mark completed + persist last_result_url
      await sb
        .from("test_takers")
        .update({
          status: "completed",
          last_result_url: reportPath,
        })
        .eq("id", taker.id)
        .eq("link_token", token);

      // Load org (needed for email template placeholders)
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

      // ✅ Email report link to test taker (if enabled)
      let takerEmailResult: any = null;
      try {
        if (linkBehavior.email_report && normalizeEmail(taker.email)) {
          takerEmailResult = await sendTemplatedEmail({
            orgId: taker.org_id,
            type: "test_taker_report",
            to: String(taker.email),
            context: {
              first_name: taker.first_name || "there",
              test_name: (test.name as string) || "your assessment",
              report_link: baseReportUrl, // ✅ new visibility report link
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

      // ✅ Send internal notification (keeps ops parity with other tests)
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

              test_name: (test.name as string) || "your assessment",

              internal_report_link: internalReportLink,
              internal_results_dashboard_link: internalResultsDashboardLink,

              org_name: orgName,
              owner_website: (orgRow as any)?.website_url || "",
            },
          });

          if (!ownerNotification?.ok) {
            console.error("[visibility submit] test_owner_notification failed", ownerNotification);
          }
        }
      } catch (e) {
        console.error("[visibility submit] owner notification unexpected error", e);
      }

      // Decide redirect using existing rules
      const redirectUrl: string =
        linkBehavior.show_results === true
          ? reportPath
          : linkBehavior.redirect_url && linkBehavior.redirect_url.trim().length
          ? linkBehavior.redirect_url.trim()
          : resultPath;

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
        owner_notification: ownerNotification,
        taker_email: takerEmailResult,
      });
    }

    // ---------- Existing behaviour for all other tests ----------
    const effectiveTestId = resolveEffectiveTestId(test);

    // Determine test family/type (existing)
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
      isQscTest &&
      (qscVariantLower === "entrepreneur" || slugLower.includes("core"));

    const qscAudience: "entrepreneur" | "leader" = isQscEntrepreneur
      ? "entrepreneur"
      : "leader";

    // Load questions with profile_map FROM effective test
    const { data: questions, error: qErr } = await sb
      .from("test_questions")
      .select("id, idx, profile_map")
      .eq("test_id", effectiveTestId)
      .order("idx", { ascending: true })
      .order("created_at", { ascending: true });

    if (qErr) {
      return NextResponse.json(
        { ok: false, error: `Questions load failed: ${qErr.message}` },
        { status: 500 }
      );
    }

    const byId: Record<string, QuestionRow> = {};
    for (const q of questions || []) byId[q.id] = q;

    // Labels FROM effective test
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
      const f = String((r as any).frequency_code || "")
        .trim()
        .toUpperCase();

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

    // Compute totals (legacy frequency/profile scoring)
    const freqTotals: Record<AB, number> = { A: 0, B: 0, C: 0, D: 0 };
    const profileTotals: Record<string, number> = {};

    for (let idx = 0; idx < answers.length; idx++) {
      const row = answers[idx];
      const qid = row?.question_id || row?.qid || row?.id;
      const q: QuestionRow | undefined = qid ? byId[qid] : undefined;
      if (!q || !Array.isArray(q.profile_map) || q.profile_map.length === 0)
        continue;

      const sel = toZeroBasedSelected(row);
      if (sel == null || sel < 0 || sel >= q.profile_map.length) continue;

      const entry = q.profile_map[sel] || {};
      const points = asNumber(entry.points, 0);
      let pcode = String(entry.profile || "").trim();

      // Resolve profile name → code if needed
      if (pcode && !/^P(?:ROFILE)?[_\s-]?\d+$/i.test(pcode)) {
        const fromName = nameToCode.get(pcode);
        if (fromName) pcode = fromName;
      }
      if (!pcode || points <= 0) continue;

      profileTotals[pcode] = (profileTotals[pcode] || 0) + points;

      const f = codeToFreq.get(pcode) || profileCodeToFreq(pcode);
      if (f) freqTotals[f] += points;
    }

    // Persist submission snapshot (keep wrapper test_id for org reporting)
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
      test_id: taker.test_id, // wrapper
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
        const questionsForScoring = (questions || []).map((q: any) => ({
          id: q.id as string,
          idx: (q.idx as number | null) ?? null,
          profile_map: (q.profile_map ?? []) as any,
        }));

        const answersForScoring = answers
          .map((row: any) => {
            const qid = row?.question_id || row?.qid || row?.id;
            const sel = toZeroBasedSelected(row);
            return { question_id: qid as string, choice: sel ?? -1 };
          })
          .filter((a: any) => a.question_id && a.choice >= 0);

        const scoring = calculateQscScores(
          questionsForScoring,
          answersForScoring
        );

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

            if (!qscProfileError)
              qscProfileId = (qscProfileRow as any)?.id ?? null;
          }
        }

        const { error: qscUpsertError } = await sb
          .from("qsc_results")
          .upsert(
            {
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
            },
            { onConflict: "taker_id" }
          );

        if (qscUpsertError) {
          console.error(
            "QSC scoring: failed to upsert qsc_results",
            qscUpsertError
          );
        }
      } catch (e) {
        console.error("QSC scoring: unexpected error", e);
      }
    }
    // ---------------- END QSC SCORING ----------------

    // ✅ Canonical base for ALL absolute links
    const origin = getBaseUrl();

    const reportPath = `/t/${encodeURIComponent(
      token
    )}/report?tid=${encodeURIComponent(taker.id)}`;
    const resultPath = `/t/${encodeURIComponent(
      token
    )}/result?tid=${encodeURIComponent(taker.id)}`;

    const baseReportUrl = `${origin}${reportPath}`;
    const baseResultUrl = `${origin}${resultPath}`;

    // ✅ QSC PUBLIC report destination
    const qscGrowthPath = `/qsc/${encodeURIComponent(
      token
    )}/entrepreneur?tid=${encodeURIComponent(taker.id)}`;
    const qscLeaderPath = `/qsc/${encodeURIComponent(
      token
    )}/leader?tid=${encodeURIComponent(taker.id)}`;

    const qscPublicPath = isQscEntrepreneur ? qscGrowthPath : qscLeaderPath;
    const qscPublicUrl = `${origin}${qscPublicPath}`;

    // Mark completed + persist correct last_result_url
    await sb
      .from("test_takers")
      .update({
        status: "completed",
        last_result_url: isQscTest ? qscPublicPath : reportPath,
      })
      .eq("id", taker.id)
      .eq("link_token", token);

    // Email the correct report page
    const reportUrlForEmail = isQscTest ? qscPublicUrl : baseReportUrl;

    // ✅ Decide redirect deterministically using show_results
    const redirectUrl: string =
      linkBehavior.show_results === true
        ? isQscTest
          ? qscPublicPath
          : reportPath
        : linkBehavior.redirect_url && linkBehavior.redirect_url.trim().length
        ? linkBehavior.redirect_url.trim()
        : resultPath;

    // Load org (needed for email template placeholders)
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

    // ✅ Email report link to test taker (if enabled)
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

    // ✅ Send internal notification
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
          console.error(
            "[submit] test_owner_notification failed",
            ownerNotification
          );
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