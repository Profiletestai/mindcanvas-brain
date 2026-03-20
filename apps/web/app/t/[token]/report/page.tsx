// apps/web/app/t/[token]/report/page.tsx
import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import ReportGateClient from "./ReportGateClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

function looksLikeQscTest(test: { slug?: string | null; name?: string | null; meta?: any | null } | null) {
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

    // token -> linked portal test
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

      // 2) QSC hard route
      const { data: testRow, error: testErr } = await sb
        .from("tests")
        .select("id, slug, name, meta")
        .eq("id", link.test_id)
        .maybeSingle();

      if (!testErr && testRow && looksLikeQscTest(testRow as any)) {
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