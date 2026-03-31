// apps/web/app/portal/[slug]/database/[takerId]/profile-extended-report/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/server/supabaseAdmin";
import {
  buildProfileExtendedReport,
  type BehaviourStyle,
  type Readiness,
  type VisibilityTier,
} from "@/lib/visibility/profileExtendedReport";

export const dynamic = "force-dynamic";

type Totals = Record<string, any> | string | null | undefined;

function parseTotals(totals: Totals): any {
  if (!totals) return {};
  try {
    if (typeof totals === "string") {
      const once = JSON.parse(totals);
      if (typeof once === "string") return JSON.parse(once);
      return once;
    }
    return totals || {};
  } catch {
    return {};
  }
}

function asVisibilityTier(value?: string | null): VisibilityTier | null {
  const v = String(value || "").trim();
  if (
    v === "Invisible" ||
    v === "Emerging" ||
    v === "Established" ||
    v === "Magnetic"
  ) {
    return v;
  }
  return null;
}

function asBehaviourStyle(value?: string | null): BehaviourStyle | null {
  const v = String(value || "").trim().toUpperCase();
  if (v === "A" || v === "B" || v === "C" || v === "D") return v;
  return null;
}

function asReadiness(value?: string | null): Readiness | null {
  const v = String(value || "").trim().toLowerCase();
  if (v === "stabilise" || v === "ready_to_progress") return v;
  return null;
}

function asNumber(value: any): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizePillarScores(raw: any): {
  discoverability?: number | null;
  trust?: number | null;
  conversion?: number | null;
} | null {
  if (!raw || typeof raw !== "object") return null;

  const discoverability = asNumber(raw.discoverability);
  const trust = asNumber(raw.trust);
  const conversion = asNumber(raw.conversion);

  if (discoverability == null && trust == null && conversion == null) {
    return null;
  }

  return {
    discoverability,
    trust,
    conversion,
  };
}

function prettyReadiness(r?: string | null) {
  const t = String(r || "").trim().toLowerCase();
  if (t === "ready_to_progress") return "Ready to progress";
  if (t === "stabilise") return "Stabilise";
  return t || "—";
}

export default async function ProfileExtendedReportPage({
  params,
}: {
  params: { slug: string; takerId: string };
}) {
  const { slug, takerId } = params;
  const sb = createClient().schema("portal");

  const { data: org } = await sb
    .from("orgs")
    .select("id, slug, name")
    .eq("slug", slug)
    .maybeSingle();

  if (!org) return notFound();

  const { data: taker } = await sb
    .from("test_takers")
    .select(
      "id, org_id, test_id, first_name, last_name, email, company, role_title"
    )
    .eq("id", takerId)
    .maybeSingle();

  if (!taker) return notFound();

  let allowed = taker.org_id === org.id;

  if (!allowed) {
    const { data: subs } = await sb
      .from("test_submissions")
      .select("test_id")
      .eq("taker_id", taker.id)
      .order("created_at", { ascending: false })
      .limit(25);

    const testIds = Array.from(
      new Set((subs || []).map((s: any) => s?.test_id).filter(Boolean))
    ) as string[];

    if (testIds.length) {
      const { data: testsForSubs } = await sb
        .from("tests")
        .select("id, org_id")
        .in("id", testIds);

      allowed = (testsForSubs || []).some((t: any) => t?.org_id === org.id);
    }
  }

  if (!allowed) return notFound();

  const { data: latest } = await sb
    .from("test_results")
    .select("id, created_at, totals")
    .eq("taker_id", taker.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latest) return notFound();

  const totalsRaw = parseTotals(latest.totals);

  const isVisibility =
    Boolean(totalsRaw?.visibility) ||
    String(totalsRaw?.meta?.engine || "").toLowerCase().includes("visibility");

  if (!isVisibility) return notFound();

  const tier = asVisibilityTier(
    totalsRaw?.visibility?.tier ??
      totalsRaw?.tier ??
      totalsRaw?.computed?.tier ??
      null
  );

  const level =
    asNumber(
      totalsRaw?.visibility?.level ??
        totalsRaw?.level ??
        totalsRaw?.computed?.level ??
        totalsRaw?.computed?.tier_level ??
        null
    ) ?? 0;

  const behaviourStyle = asBehaviourStyle(
    totalsRaw?.visibility?.style ??
      totalsRaw?.visibility?.behaviour_style ??
      totalsRaw?.behaviour_style ??
      totalsRaw?.computed?.behaviour_style ??
      totalsRaw?.computed?.style ??
      null
  );

  const readiness = asReadiness(
    totalsRaw?.visibility?.readiness ??
      totalsRaw?.readiness ??
      totalsRaw?.computed?.readiness ??
      null
  );

  const pillarScores = normalizePillarScores(
    totalsRaw?.pillar_scores ??
      totalsRaw?.visibility?.pillar_scores ??
      totalsRaw?.computed?.pillar_scores ??
      null
  );

  if (!tier || !level || !behaviourStyle) return notFound();

  const report = await buildProfileExtendedReport({
    tier,
    level,
    behaviour_style: behaviourStyle,
    readiness,
    pillar_scores: pillarScores,
  });

  const fullName =
    [taker.first_name, taker.last_name].filter(Boolean).join(" ").trim() || "—";

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Profile Extended Report</h1>
          <p className="text-sm text-gray-500">
            {fullName} · {org.name}
          </p>
        </div>

        <Link
          href={`/portal/${slug}/database/${taker.id}`}
          className="rounded-md border px-3 py-2 text-sm"
        >
          Back to test taker profile
        </Link>
      </header>

      <section className="rounded-xl border bg-white p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border bg-slate-50 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Tier</div>
            <div className="mt-1 text-lg font-semibold">{tier}</div>
          </div>

          <div className="rounded-lg border bg-slate-50 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Level</div>
            <div className="mt-1 text-lg font-semibold">{level}</div>
          </div>

          <div className="rounded-lg border bg-slate-50 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Style</div>
            <div className="mt-1 text-lg font-semibold">{behaviourStyle}</div>
          </div>

          <div className="rounded-lg border bg-slate-50 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Readiness</div>
            <div className="mt-1 text-lg font-semibold">{prettyReadiness(readiness)}</div>
          </div>
        </div>
      </section>

      {report.sections.map((section) => (
        <section
          key={section.section_key}
          className="rounded-xl border bg-white p-4 space-y-4"
        >
          <div>
            {section.heading ? (
              <h2 className="text-lg font-semibold text-slate-900">{section.heading}</h2>
            ) : null}
            {section.subheading ? (
              <p className="mt-1 text-sm text-slate-500">{section.subheading}</p>
            ) : null}
          </div>

          <div className="space-y-4">
            {section.blocks.map((block, index) => (
              <div
                key={`${section.section_key}-${index}`}
                className="rounded-lg border border-slate-200 bg-slate-50/60 p-4"
              >
                {block.heading ? (
                  <h3 className="text-sm font-semibold text-slate-900">{block.heading}</h3>
                ) : null}

                {block.summary ? (
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {block.summary}
                  </p>
                ) : null}

                {Array.isArray(block.bullets) && block.bullets.length > 0 ? (
                  <ul className="mt-3 list-disc pl-5 space-y-1 text-sm leading-6 text-slate-700">
                    {block.bullets.map((item: string, i: number) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}