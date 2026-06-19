// apps/web/app/mcas/t/[token]/page.tsx

import "server-only";

import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import McasWizardClient from "./McasWizardClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type PageProps = {
  params: Promise<{
    token: string;
  }>;
};

type McasTestLinkRow = {
  id: string;
  org_id: string;
  public_token: string;
  link_type: string;
  framework_slug: string;
  framework_version: string;
  name: string;
  contact_owner_name: string | null;
  recipient_email: string | null;
  send_email: boolean;
  report_version: "lite" | "full";
  show_results: boolean;
  email_report: boolean;
  next_steps_url: string | null;
  usage_limit_type: "unlimited" | "limited";
  usage_limit_count: number | null;
  status: "active" | "paused" | "expired" | "archived";
  settings: Record<string, unknown>;
};

type McasFrameworkRow = {
  slug: string;
  version: string;
  definition: unknown;
};

type FrameworkQuestion = {
  code: string;
  prompt: string;
  section?: string;
  options: { code: string; label: string }[];
};

function mcasSupa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, key, {
    db: { schema: "mcas" },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normaliseQuestion(value: unknown): FrameworkQuestion | null {
  if (!isRecord(value)) return null;

  const code = String(value.code || "").trim();
  const prompt = String(value.prompt || "").trim();

  const options = Array.isArray(value.options)
    ? value.options
        .map((option) => {
          if (!isRecord(option)) return null;

          const optionCode = String(option.code || "").trim();
          const label = String(option.label || "").trim();

          if (!optionCode || !label) return null;

          return {
            code: optionCode,
            label,
          };
        })
        .filter(
          (option): option is { code: string; label: string } =>
            option !== null
        )
    : [];

  if (!code || !prompt || options.length === 0) return null;

  return {
    code,
    prompt,
    section: value.section ? String(value.section) : undefined,
    options,
  };
}

function questionIndex(code: string) {
  return Number(code.replace("Q", "")) || 0;
}

export default async function Page({ params }: PageProps) {
  const { token } = await params;
  const publicToken = (token || "").trim();

  if (!publicToken) notFound();

  const sb = mcasSupa();

  const { data: testLinkData, error: testLinkError } = await sb
    .from("test_links")
    .select(
      [
        "id",
        "org_id",
        "public_token",
        "link_type",
        "framework_slug",
        "framework_version",
        "name",
        "contact_owner_name",
        "recipient_email",
        "send_email",
        "report_version",
        "show_results",
        "email_report",
        "next_steps_url",
        "usage_limit_type",
        "usage_limit_count",
        "status",
        "settings",
      ].join(", ")
    )
    .eq("public_token", publicToken)
    .maybeSingle();

  const testLink = testLinkData as McasTestLinkRow | null;

  if (testLinkError || !testLink) notFound();

  if (
    testLink.status !== "active" ||
    testLink.link_type !== "candidate_assessment"
  ) {
    notFound();
  }

  const { data: frameworkData, error: frameworkError } = await sb
    .from("frameworks")
    .select("slug, version, definition")
    .eq("slug", testLink.framework_slug)
    .eq("version", testLink.framework_version)
    .maybeSingle();

  const framework = frameworkData as McasFrameworkRow | null;

  if (frameworkError || !framework || !isRecord(framework.definition)) {
    notFound();
  }

  const rawQuestions = Array.isArray(framework.definition.questions)
    ? framework.definition.questions
    : [];

  const questions = rawQuestions
    .map(normaliseQuestion)
    .filter((question): question is FrameworkQuestion => question !== null)
    .sort((a, b) => questionIndex(a.code) - questionIndex(b.code));

  if (questions.length === 0) notFound();

  return (
    <McasWizardClient
      token={publicToken}
      testLink={{
        id: testLink.id,
        name: testLink.name,
        link_type: testLink.link_type,
        status: testLink.status,
        recipient_email: testLink.recipient_email,
        report_version: testLink.report_version,
        show_results: testLink.show_results,
        next_steps_url: testLink.next_steps_url,
      }}
      questions={questions}
    />
  );
}