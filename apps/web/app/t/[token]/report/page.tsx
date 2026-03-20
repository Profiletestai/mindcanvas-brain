import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import ReportGateClient from "./ReportGateClient";

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
    const first = m.source_tests.find((x: any) => typeof x === "string" && isUuidLike(x));
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
  const frameworkType = String(meta?.frameworkType || meta?.frameworktype || "").toLowerCase();
  const resultType = String(meta?.resultType || meta?.resulttype || "").toLowerCase();
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

async function fetchPortalTestRow(sb: ReturnType<typeof portal>, testId: string): Promise<PortalTestRow | null> {
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

  try {
    const sb = portal();
    const vis = visibility();

    const { data: link, error: linkErr } = await sb
      .from("test_links")
      .select("test_id")
      .eq("token", token)
      .maybeSingle();

    if (!linkErr && link?.test_id) {
      // 1) Visibility hard route
      const { data: vTest, error: vErr } = await vis
        .from("tests")
        .select("id")
        .eq("portal_test_id", link.test_id)
        .maybeSingle();

      if (!vErr && vTest?.id) {
        const qs = new URLSearchParams();
        qs.set("tid", tid);
        if (src) qs.set("src", src);
        redirect(`/t/${encodeURIComponent(token)}/visibility/report?${qs.toString()}`);
      }

      // 2) Resolve wrapper + effective source for robust QSC detection
      const wrapperTestRow = await fetchPortalTestRow(sb, link.test_id);
      const effectiveTestRow = await resolveEffectiveTestRow(sb, wrapperTestRow);

      const isQsc =
        looksLikeQscTest(wrapperTestRow) ||
        looksLikeQscTest(effectiveTestRow);

      if (isQsc) {
        const qs = new URLSearchParams();
        qs.set("tid", tid);
        redirect(`/qsc/${encodeURIComponent(token)}/entrepreneur?${qs.toString()}`);
      }
    }
  } catch {
    // fall through to existing report gate
  }

  return <ReportGateClient token={token} tid={tid} src={src} />;
}