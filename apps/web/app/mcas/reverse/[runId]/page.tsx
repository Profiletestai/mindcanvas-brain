//apps/web/app/mcas/reverse/[runId]/page.tsx
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import ReverseProfileClient from "./ReverseProfileClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function mcasSupa() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "mcas" } }
  );
}

export default async function Page(
  props: { params: Promise<{ runId: string }> }
) {
  const { runId } = await props.params;

  const sb = mcasSupa();

  const { data: run, error: runErr } = await sb
    .from("reverse_profile_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();

  if (runErr || !run) notFound();

  const { data: framework, error: fwErr } = await sb
    .from("frameworks")
    .select("definition")
    .eq("slug", run.framework_slug || "mcas-core-alignment")
    .eq("version", run.framework_version || "v1")
    .maybeSingle();

  if (fwErr || !framework) notFound();

  const questions = Array.isArray(framework?.definition?.questions)
    ? framework.definition.questions
    : [];

  if (!questions.length) notFound();

  return (
    <ReverseProfileClient
      runId={runId}
      title={run.title || "Reverse Profile Test"}
      questions={questions}
    />
  );
}