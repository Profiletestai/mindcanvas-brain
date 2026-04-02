//apps/web/app/t/[token]/visibility/report/page.tsx
import { notFound } from "next/navigation";
import { createClient } from "@/lib/server/supabaseAdmin";
import VisibilityReportClient from "./VisibilityReportClient";
import VisibilityLiteReportClient from "./VisibilityLiteReportClient";

export const dynamic = "force-dynamic";

type Variant = "full" | "lite";

function normalizeVariant(value: any): Variant | null {
  const s = String(value || "").trim().toLowerCase();

  if (
    [
      "lite",
      "light",
      "snapshot",
      "results_snapshot",
      "result_snapshot",
      "summary",
      "teaser",
    ].includes(s)
  ) {
    return "lite";
  }

  if (
    [
      "full",
      "taker_report",
      "results_playbook",
      "playbook",
      "extended",
    ].includes(s)
  ) {
    return "full";
  }

  return null;
}

async function resolveVariantFromToken(token: string): Promise<Variant> {
  const sb = createClient().schema("portal");

  const { data: link } = await sb
    .from("test_links")
    .select("test_id, meta")
    .eq("token", token)
    .maybeSingle();

  const linkMeta = (link as any)?.meta || {};

  const linkCandidates = [
    linkMeta?.visibility_report_variant,
    linkMeta?.visibilityReportVariant,
    linkMeta?.report_variant,
    linkMeta?.reportVariant,
    linkMeta?.result_variant,
    linkMeta?.resultVariant,
    linkMeta?.report_type,
    linkMeta?.reportType,
    linkMeta?.audience,
  ];

  for (const candidate of linkCandidates) {
    const normalized = normalizeVariant(candidate);
    if (normalized) return normalized;
  }

  const testId = (link as any)?.test_id;
  if (testId) {
    const { data: test } = await sb
      .from("tests")
      .select("name, meta")
      .eq("id", testId)
      .maybeSingle();

    const testMeta = (test as any)?.meta || {};

    const testCandidates = [
      testMeta?.visibility_report_variant,
      testMeta?.visibilityReportVariant,
      testMeta?.default_report_variant,
      testMeta?.defaultReportVariant,
      testMeta?.report_variant,
      testMeta?.reportVariant,
      testMeta?.report_type,
      testMeta?.reportType,
      testMeta?.audience,
      (test as any)?.name,
    ];

    for (const candidate of testCandidates) {
      const normalized = normalizeVariant(candidate);
      if (normalized) return normalized;
    }
  }

  return "full";
}

export default async function VisibilityReportPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { tid?: string; src?: string; variant?: string; report?: string };
}) {
  const token = String(params?.token || "").trim();
  const tid =
    typeof searchParams?.tid === "string" ? searchParams.tid.trim() : "";
  const src =
    typeof searchParams?.src === "string" && searchParams.src.trim()
      ? searchParams.src.trim()
      : undefined;

  if (!token || !tid) {
    return notFound();
  }

  const explicitVariant =
    normalizeVariant(searchParams?.variant) || normalizeVariant(searchParams?.report);

  const variant = explicitVariant || (await resolveVariantFromToken(token));

  if (variant === "lite") {
    return <VisibilityLiteReportClient token={token} tid={tid} src={src} />;
  }

  return <VisibilityReportClient token={token} tid={tid} src={src} />;
}