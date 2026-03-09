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
  return createClient(url, key, { db: { schema: "portal" }, auth: { persistSession: false } });
}

function visibility() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = getKey();
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, { db: { schema: "visibility" }, auth: { persistSession: false } });
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

  // If we have no tid, keep existing behaviour (ReportGateClient will show a helpful message)
  if (!tid) {
    return <ReportGateClient token={token} tid={tid} src={src} />;
  }

  // ✅ FAILSAFE: if this token belongs to a Visibility engine test, redirect to the WOW report route
  try {
    const sb = portal();
    const vis = visibility();

    // token -> portal test_id
    const { data: link, error: linkErr } = await sb
      .from("test_links")
      .select("test_id")
      .eq("token", token)
      .maybeSingle();

    if (!linkErr && link?.test_id) {
      // does visibility.tests map to this portal test?
      const { data: vTest, error: vErr } = await vis
        .from("tests")
        .select("id")
        .eq("portal_test_id", link.test_id)
        .maybeSingle();

      if (!vErr && vTest?.id) {
        // Redirect to the bespoke visibility report
        const qs = new URLSearchParams();
        qs.set("tid", tid);
        if (src) qs.set("src", src);

        redirect(`/t/${encodeURIComponent(token)}/visibility/report?${qs.toString()}`);
      }
    }
  } catch {
    // If anything goes wrong, just fall back to the existing report gate
  }

  // Default behaviour for all other tests
  return <ReportGateClient token={token} tid={tid} src={src} />;
}