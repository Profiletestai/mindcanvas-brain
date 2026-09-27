export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

import { requireSuperadminApi } from "@/lib/server/adminApiAuth";

import { getServiceClient } from "../../../../_lib/supabase";
import {
  buildProfileCopy,
  draftReportSections,
} from "../../../../_lib/ai";

/**
 * POST /api/admin/profiles/drafts
 * Body: { name: string; frequency: "A"|"B"|"C"|"D" }
 *
 * Platform-superadmin only.
 *
 * Uses onboarding "goals" to set tone/industry/sector, then asks AI for copy.
 * Returns a JSON payload that the editor renders.
 */
export async function POST(req: Request) {
  try {
    const auth = await requireSuperadminApi();

    if (!auth.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: auth.error,
        },
        {
          status: auth.status,
        }
      );
    }

    const {
      name,
      frequency,
    } = (await req.json()) ?? {};

    if (!name || !frequency) {
      return NextResponse.json(
        {
          error: "Missing profile name or frequency",
        },
        {
          status: 400,
        }
      );
    }

    // Try to pull onboarding "goals" for context.
    // The route is now platform-superadmin only before the service client
    // or AI generation can be reached.
    const sb = getServiceClient();

    let goalsTone = "confident, modern, human";
    let goalsIndustry = "General";
    let goalsSector = "General";
    let goalsCompany = "Your Organization";

    const goals = await sb
      .from("onboarding_steps")
      .select("step,data")
      .eq("step", "goals")
      .maybeSingle();

    const data =
      goals?.data?.data ??
      goals?.data;

    if (data) {
      goalsTone =
        (data.brand_tone ||
          data.brandTone ||
          goalsTone) as string;

      goalsIndustry =
        (data.industry ||
          goalsIndustry) as string;

      goalsSector =
        (data.sector ||
          goalsSector) as string;

      goalsCompany =
        (data.company ||
          data.org_name ||
          goalsCompany) as string;
    }

    const short = await buildProfileCopy({
      brandTone: goalsTone,
      industry: goalsIndustry,
      sector: goalsSector,
      company: goalsCompany,
      frequencyName: frequency,
      profileName: name,
    });

    const full = await draftReportSections({
      brandTone: goalsTone,
      industry: goalsIndustry,
      sector: goalsSector,
      company: goalsCompany,
      frequencyName: frequency,
      profileName: name,
    });

    const payload = {
      profile: {
        name,
        frequency,
      },

      meta: {
        brandTone: goalsTone,
        industry: goalsIndustry,
        sector: goalsSector,
        company: goalsCompany,
      },

      card: {
        summary: short.summary,
        strengths: short.strengths,
      },

      sections: {
        intro:
          `Welcome to your ${name} profile. ` +
          `This draft is tuned to ${goalsCompany} ` +
          `(${goalsIndustry}/${goalsSector}) and written in a ` +
          `“${goalsTone}” tone.`,

        how_to_use:
          "Use this report as a practical guide: skim the overview, review strengths and challenges, note ideal roles/environments, and apply the guidance section to create an immediate action plan.",

        core_overview:
          `Profile in Depth: ${name}\nFrequency: ${frequency}`,

        ideal_env:
          full?.roles ||
          "A supportive environment that values this profile’s contribution and provides clarity, feedback, and opportunities for impact.",

        strengths:
          (
            Array.isArray(short.strengths)
              ? short.strengths.join("\n")
              : ""
          ) ||
          "Strength 1\nStrength 2\nStrength 3",

        challenges:
          full?.challenges ||
          "Two short paragraphs on common challenges.",

        ideal_roles:
          full?.roles ||
          "1–2 short paragraphs describing suitable roles.",

        guidance:
          full?.guidance ||
          "Two short paragraphs with practical guidance aligned to the company context.",

        examples:
          "• Example 1: A representative person or team that demonstrates this profile in action.\n" +
          "• Example 2: Another concise example with impact/results.",

        additional: "",
      },
    };

    return NextResponse.json(payload);
  } catch (e: any) {
    const msg =
      e?.message ||
      "Failed to generate draft";

    const hint =
      /OPENAI_API_KEY/i.test(msg)
        ? "OPENAI_API_KEY missing in Vercel env."
        : undefined;

    return NextResponse.json(
      {
        error: hint
          ? `${msg}. ${hint}`
          : msg,
      },
      {
        status: 500,
      }
    );
  }
}

// Disallow other verbs explicitly.
export async function GET() {
  return NextResponse.json(
    {
      error: "Use POST",
    },
    {
      status: 405,
    }
  );
}

export async function PUT() {
  return NextResponse.json(
    {
      error: "Use POST",
    },
    {
      status: 405,
    }
  );
}

export async function PATCH() {
  return NextResponse.json(
    {
      error: "Use POST",
    },
    {
      status: 405,
    }
  );
}
