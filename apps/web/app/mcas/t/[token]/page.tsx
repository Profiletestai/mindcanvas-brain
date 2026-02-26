//apps/web/app/mcas/t/[token]/page.tsx
import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import McasTakerClient from "./McasTakerClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function mcasSupa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { db: { schema: "mcas" } });
}

type FrameworkQuestion = {
  code: string;          // "Q1"
  prompt: string;        // question text
  options: { code: string; label: string }[]; // A/B...
};

export default async function Page(
  props: { params: Promise<{ token: string }> }
) {
  const { token } = await props.params;
  const public_token = (token || "").trim();
  if (!public_token) notFound();

  const sb = mcasSupa();

  // 1) Find the partner application by token
  const { data: appRow, error: appErr } = await sb
    .from("partner_applications")
    .select(
      "id, org_id, partner_key, application_id, status, framework_slug, framework_version, candidate_email, candidate_first_name, candidate_last_name"
    )
    .eq("public_token", public_token)
    .maybeSingle();

  if (appErr || !appRow) notFound();

  // 2) Load framework definition (questions live here for MVP)
  const { data: fwRow, error: fwErr } = await sb
    .from("frameworks")
    .select("slug, version, status, definition")
    .eq("slug", appRow.framework_slug)
    .eq("version", appRow.framework_version)
    .maybeSingle();

  if (fwErr || !fwRow) notFound();

  const def = (fwRow.definition || {}) as any;
  const questions: FrameworkQuestion[] = Array.isArray(def.questions) ? def.questions : [];

  return (
    <McasTakerClient
      token={public_token}
      application={{
        partner_key: appRow.partner_key,
        application_id: appRow.application_id,
        status: appRow.status,
        candidate_email: appRow.candidate_email,
        candidate_first_name: appRow.candidate_first_name,
        candidate_last_name: appRow.candidate_last_name,
        framework_slug: appRow.framework_slug,
        framework_version: appRow.framework_version,
      }}
      framework={{
        slug: fwRow.slug,
        version: fwRow.version,
        status: fwRow.status,
      }}
      questions={questions}
    />
  );
}