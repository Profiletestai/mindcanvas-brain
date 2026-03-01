//apps/web/app/mcas/t/[token]/page.tsx
import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import McasWizardClient from "./McasWizardClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function mcasSupa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { db: { schema: "mcas" } });
}

type FrameworkQuestion = {
  code: string; // Q1..Q25
  prompt: string;
  section?: string;
  options: { code: string; label: string }[];
};

export default async function Page(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const public_token = (token || "").trim();
  if (!public_token) notFound();

  const sb = mcasSupa();

  // 1) Find the application
  const { data: app, error: appErr } = await sb
    .from("partner_applications")
    .select(
      "id, partner_key, application_id, org_id, status, framework_slug, framework_version, candidate_email, candidate_first_name, candidate_last_name"
    )
    .eq("public_token", public_token)
    .maybeSingle();

  if (appErr || !app) notFound();

  // 2) Load framework
  const { data: fw, error: fwErr } = await sb
    .from("frameworks")
    .select("slug, version, definition")
    .eq("slug", app.framework_slug)
    .eq("version", app.framework_version)
    .maybeSingle();

  if (fwErr || !fw) notFound();

  const def = (fw.definition || {}) as any;
  const rawQuestions = Array.isArray(def.questions) ? (def.questions as any[]) : [];

  // 3) Normalize + enforce order Q1..Q25 (no randomization)
  const questions: FrameworkQuestion[] = rawQuestions
    .map((q) => ({
      code: String(q.code || "").trim(),
      prompt: String(q.prompt || "").trim(),
      section: q.section ? String(q.section) : undefined,
      options: Array.isArray(q.options)
        ? q.options.map((o: any) => ({
            code: String(o.code || "").trim(),
            label: String(o.label || "").trim(),
          }))
        : [],
    }))
    .filter((q) => q.code && q.prompt && q.options.length > 0)
    .sort((a, b) => {
      const ai = Number(a.code.replace("Q", "")) || 0;
      const bi = Number(b.code.replace("Q", "")) || 0;
      return ai - bi;
    });

  return (
    <McasWizardClient
      token={public_token}
      application={{
        partner_key: app.partner_key,
        application_id: app.application_id,
        status: app.status,
        candidate_first_name: app.candidate_first_name,
        candidate_last_name: app.candidate_last_name,
        candidate_email: app.candidate_email,
      }}
      questions={questions}
    />
  );
}