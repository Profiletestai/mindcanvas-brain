//apps/web/app/admin/mcas/test-lab/[runId]/page.tsx
import "server-only";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import TestLabRunClient from "./TestLabRunClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function mcasSupa() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "mcas" } }
  );
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const withPadding = padded + "=".repeat((4 - (padded.length % 4)) % 4);
  return Buffer.from(withPadding, "base64").toString("utf8");
}

function decodeRun(runId: string) {
  try {
    return JSON.parse(base64UrlDecode(runId));
  } catch {
    return { title: "Internal MCAS Test", description: "", source: "mcas_internal_test_lab" };
  }
}

export default async function Page({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const run = decodeRun(runId);
  const sb = mcasSupa();

  const { data: framework, error } = await sb
    .from("frameworks")
    .select("definition")
    .eq("slug", "mcas-core-alignment")
    .eq("version", "v1")
    .maybeSingle();

  const questions = Array.isArray((framework?.definition as any)?.questions)
    ? (framework?.definition as any).questions
    : [];

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <Link href="/admin/mcas/test-lab" className="mb-6 inline-block text-sm text-sky-300 hover:text-sky-200">
          ← Back to Test Lab
        </Link>

        <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm text-slate-400">MCAS Internal Test Lab</p>
          <h1 className="mt-1 text-3xl font-semibold">{run.title}</h1>
          {run.description ? <p className="mt-3 whitespace-pre-wrap text-slate-300">{run.description}</p> : null}
        </div>

        {error ? (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">
            {error.message}
          </div>
        ) : null}

        {!questions.length ? (
          <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-4 text-yellow-100">
            No MCAS framework questions were found for mcas-core-alignment v1.
          </div>
        ) : (
          <TestLabRunClient runId={runId} questions={questions} />
        )}
      </div>
    </main>
  );
}