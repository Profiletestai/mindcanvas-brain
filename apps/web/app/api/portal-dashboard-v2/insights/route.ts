// apps/web/app/api/portal-dashboard-v2/insights/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

type Confidence = "low" | "medium" | "high";

function confidenceFromSample(n: number): Confidence {
  if (n < 20) return "low";
  if (n < 80) return "medium";
  return "high";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const scope: "org" | "test" | "link" = body?.scope || "org";
    const metrics = body?.metrics || {};
    const kpis = metrics?.kpis || {};
    const timeline = Array.isArray(metrics?.timeline) ? metrics.timeline : [];
    const topProfiles = Array.isArray(metrics?.topProfiles) ? metrics.topProfiles : [];
    const topFrequency = metrics?.topFrequency || null;
    const topCompanies = Array.isArray(metrics?.topCompanies) ? metrics.topCompanies : [];

    const submissions = Number(kpis?.submissions ?? kpis?.testsTaken ?? 0) || 0;
    const conf = confidenceFromSample(submissions);

    // Trend: compare last 7 points vs previous 7 points if available
    let trendNote = "Trend not available.";
    if (timeline.length >= 8) {
      const last = timeline.slice(-7).reduce((s: number, r: any) => s + (Number(r.submissions) || 0), 0);
      const prev = timeline.slice(-14, -7).reduce((s: number, r: any) => s + (Number(r.submissions) || 0), 0);
      if (prev > 0) {
        const change = ((last - prev) / prev) * 100;
        const rounded = Math.round(change);
        if (rounded > 10) trendNote = `Usage is up ~${rounded}% vs the previous period.`;
        else if (rounded < -10) trendNote = `Usage is down ~${Math.abs(rounded)}% vs the previous period.`;
        else trendNote = `Usage is broadly stable vs the previous period.`;
      } else {
        trendNote = `Usage is building (no prior baseline in the compared period).`;
      }
    }

    const whatYoureSeeing: string[] = [];
    const whatItSuggests: string[] = [];
    const recommendedNextSteps: string[] = [];
    const watchOuts: string[] = [];

    if (scope === "org") whatYoureSeeing.push(`This is an organisation-level view across the selected date range.`);
    if (scope === "test") whatYoureSeeing.push(`This is a test-level view across the selected date range.`);
    if (scope === "link") whatYoureSeeing.push(`This is a link-level view across the selected date range.`);

    whatYoureSeeing.push(`Total submissions in range: ${submissions}.`);
    whatYoureSeeing.push(trendNote);

    if (topProfiles.length) {
      const p0 = topProfiles[0];
      whatYoureSeeing.push(
        `The leading profile signal is ${p0.name || p0.code} (based on the current ranking method).`
      );
    }

    if (topFrequency) {
      whatYoureSeeing.push(`The leading frequency signal is ${topFrequency.name || topFrequency.code}.`);
    }

    // Concentration signals
    if (topCompanies.length) {
      const c0 = topCompanies[0];
      if (c0?.pct != null && c0.pct >= 0.6) {
        whatItSuggests.push(
          `Results are heavily concentrated in one company (${c0.company}), which may indicate a single rollout cohort rather than broad adoption.`
        );
        recommendedNextSteps.push(`If this is meant to be multi-company, create/activate additional links segmented by cohort or partner.`);
      }
    }

    if (submissions === 0) {
      whatItSuggests.push(`No submissions were recorded in this date range.`);
      recommendedNextSteps.push(`Check link distribution, expiry/max-uses, and whether the chosen date range is correct.`);
    } else {
      whatItSuggests.push(
        `The profile/frequency mix gives you an early read on who is taking the test and what your dominant outcomes look like right now.`
      );
      recommendedNextSteps.push(`Use the link drill-down to compare profile mix between campaigns (different links).`);
      recommendedNextSteps.push(`Add one “purpose” label per link to make performance comparisons meaningful.`);
    }

    if (conf === "low") {
      watchOuts.push(`Small sample size — treat these as early signals, not conclusions.`);
    }

    // Always add a data integrity note
    watchOuts.push(
      `These insights summarise observed metrics only; they don’t prove causation (they point to where to investigate).`
    );

    return NextResponse.json({
      ok: true,
      summary: {
        whatYoureSeeing,
        whatItSuggests,
        recommendedNextSteps,
        watchOuts,
        confidence: {
          sampleSize: submissions,
          level: conf,
        },
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
