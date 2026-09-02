import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import ReportGateClient from "./ReportGateClient";
import InevitableStandardReportClient from "./InevitableStandardReportClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PortalTestRow = {
  id: string;
  slug: string | null;
  name: string | null;
  meta: any | null;
};

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
  return createClient(url, key, {
    db: { schema: "portal" },
    auth: { persistSession: false },
  });
}

function visibility() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = getKey();
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, {
    db: { schema: "visibility" },
    auth: { persistSession: false },
  });
}

function isUuidLike(s: string) {
  return /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(
    String(s || "").trim()
  );
}

function resolveSourceTestIdFromMeta(meta: any): string | null {
  const m = meta && typeof meta === "object" ? meta : {};

  const direct =
    typeof m.default_source_test === "string"
      ? m.default_source_test
      : typeof m.source_test_id === "string"
        ? m.source_test_id
        : null;

  if (direct && isUuidLike(direct)) return direct;

  if (Array.isArray(m.source_tests)) {
    const first = m.source_tests.find(
      (x: any) => typeof x === "string" && isUuidLike(x)
    );
    if (first) return first;
  }

  return null;
}

function looksLikeQscTest(test: PortalTestRow | null) {
  const slug = String(test?.slug || "").toLowerCase();
  const name = String(test?.name || "").toLowerCase();
  const meta = test?.meta && typeof test.meta === "object" ? test.meta : {};

  const kind = String(meta?.kind || "").toLowerCase();
  const family = String(meta?.test_family || "").toLowerCase();
  const frameworkType = String(
    meta?.frameworkType || meta?.frameworktype || ""
  ).toLowerCase();
  const resultType = String(
    meta?.resultType || meta?.resulttype || ""
  ).toLowerCase();
  const canonical = String(meta?.canonical_slug || "").toLowerCase();
  const qscVariant = String(meta?.qsc_variant || meta?.variant || "").toLowerCase();

  return (
    slug.includes("qsc") ||
    name.includes("quantum source code") ||
    kind === "qsc" ||
    family === "qsc" ||
    frameworkType === "qsc" ||
    resultType === "qsc" ||
    canonical.startsWith("qsc") ||
    qscVariant === "entrepreneur" ||
    qscVariant === "leader" ||
    qscVariant === "leaders"
  );
}

function looksLikeInevitableStandardTest(test: PortalTestRow | null) {
  const slug = String(test?.slug || "").toLowerCase().trim();
  const name = String(test?.name || "").toLowerCase().trim();
  const meta = test?.meta && typeof test.meta === "object" ? test.meta : {};
  const engineKey = String(meta?.engine_key || "").toLowerCase().trim();

  return (
    meta?.is_inevitable_standard === true ||
    engineKey === "inevitable_standard" ||
    engineKey === "inevitable-standard" ||
    slug === "inevitable-standard" ||
    slug.startsWith("inevitable-standard-") ||
    name.includes("inevitable standard")
  );
}

function looksLikeTeamPuzzleRhythmTest(test: PortalTestRow | null) {
  const slug = String(test?.slug || "").toLowerCase();
  const name = String(test?.name || "").toLowerCase();
  const meta = test?.meta && typeof test.meta === "object" ? test.meta : {};

  const reportLayout = String(meta?.report_layout || "").toLowerCase();
  const variant = String(meta?.variant || "").toLowerCase();
  const family = String(meta?.test_family || "").toLowerCase();

  return (
    reportLayout === "team_puzzle_rhythm_v1" ||
    variant === "rhythm_edition" ||
    meta?.has_rhythm_layer === true ||
    meta?.rhythm?.enabled === true ||
    (family === "team_puzzle" && (slug.includes("rhythm") || name.includes("rhythm")))
  );
}

async function fetchPortalTestRow(
  sb: ReturnType<typeof portal>,
  testId: string
): Promise<PortalTestRow | null> {
  const { data, error } = await sb
    .from("tests")
    .select("id, slug, name, meta")
    .eq("id", testId)
    .maybeSingle();

  if (error || !data) return null;
  return data as PortalTestRow;
}

async function resolveEffectiveTestRow(
  sb: ReturnType<typeof portal>,
  wrapperTestRow: PortalTestRow | null
): Promise<PortalTestRow | null> {
  if (!wrapperTestRow) return null;

  const sourceTestId = resolveSourceTestIdFromMeta(wrapperTestRow.meta);
  if (!sourceTestId) return wrapperTestRow;

  const sourceRow = await fetchPortalTestRow(sb, sourceTestId);
  return sourceRow || wrapperTestRow;
}

function buildQueryString(params: Record<string, string | null | undefined>) {
  const qs = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value.trim()) {
      qs.set(key, value.trim());
    }
  }

  return qs.toString();
}

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams?: { tid?: string; src?: string };
}) {
  const token = params.token;
  const tid = typeof searchParams?.tid === "string" ? searchParams.tid : "";
  const src = typeof searchParams?.src === "string" ? searchParams.src : "";

  if (!tid) {
    return <ReportGateClient token={token} tid={tid} src={src} />;
  }

  let redirectTarget: string | null = null;
  let renderInevitableStandard = false;

  try {
    const sb = portal();
    const vis = visibility();

    const { data: link, error: linkErr } = await sb
      .from("test_links")
      .select("test_id")
      .eq("token", token)
      .maybeSingle();

    if (!linkErr && link?.test_id) {
      const commonQs = buildQueryString({ tid, src });

      // 1) Visibility hard route
      const { data: vTest, error: vErr } = await vis
        .from("tests")
        .select("id")
        .eq("portal_test_id", link.test_id)
        .maybeSingle();

      if (!vErr && vTest?.id) {
        redirectTarget = `/t/${encodeURIComponent(token)}/visibility/report?${commonQs}`;
      }

      // 2) Team Puzzle RHYTHM hard route
      // This keeps the RHYTHM Edition report separate from the existing generic report.
      if (!redirectTarget) {
        const wrapperTestRow = await fetchPortalTestRow(sb, link.test_id);
        const effectiveTestRow = await resolveEffectiveTestRow(sb, wrapperTestRow);

        if (
          looksLikeInevitableStandardTest(wrapperTestRow) ||
          looksLikeInevitableStandardTest(effectiveTestRow)
        ) {
          renderInevitableStandard = true;
        }

        if (
          !renderInevitableStandard &&
          looksLikeTeamPuzzleRhythmTest(wrapperTestRow)
        ) {
          redirectTarget = `/t/${encodeURIComponent(token)}/team-puzzle-rhythm-report?${commonQs}`;
        }

        // 3) Resolve wrapper + effective source for robust QSC detection
        if (!renderInevitableStandard && !redirectTarget) {
          const isQsc =
            looksLikeQscTest(wrapperTestRow) || looksLikeQscTest(effectiveTestRow);

          if (isQsc) {
            const qscQs = buildQueryString({ tid });
            redirectTarget = `/qsc/${encodeURIComponent(token)}/entrepreneur?${qscQs}`;
          }
        }
      }
    }
  } catch (error) {
    console.warn("[report/page] Report routing lookup failed", error);
  }

  // Important: call redirect outside the try/catch.
  // Next.js implements redirect() by throwing a special redirect error. If we call
  // redirect() inside the try block, our catch swallows it and the page falls back
  // to the old ReportGateClient instead of redirecting.
  if (redirectTarget) {
    redirect(redirectTarget);
  }

  if (renderInevitableStandard) {
    return <InevitableStandardReportClient token={token} tid={tid} />;
  }

  return <ReportGateClient token={token} tid={tid} src={src} />;
}