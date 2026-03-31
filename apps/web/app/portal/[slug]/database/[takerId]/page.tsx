// apps/web/app/portal/[slug]/database/[takerId]/page.tsx
// Server component — /portal/[slug]/database/[takerId]
// Contact info + latest results with Frequency/Profile mixes (no fragile views)

import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/server/supabaseAdmin";
import { buildCoachSummary } from "@/lib/report/buildCoachSummary";
import { getBaseUrl } from "@/lib/baseUrl";
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

function asPercentMap(values: Record<string, number>): Record<string, number> {
  const sum = Object.values(values).reduce((a, b) => a + (Number(b) || 0), 0);
  if (!sum) return Object.fromEntries(Object.keys(values).map((k) => [k, 0]));
  return Object.fromEntries(
    Object.entries(values).map(([k, v]) => [
      k,
      Math.round(((Number(v) || 0) / sum) * 100),
    ])
  );
}

function asDecimalMap(values: Record<string, number>): Record<string, number> {
  const sum = Object.values(values).reduce((a, b) => a + (Number(b) || 0), 0);
  if (!sum) return Object.fromEntries(Object.keys(values).map((k) => [k, 0]));
  return Object.fromEntries(
    Object.entries(values).map(([k, v]) => [k, (Number(v) || 0) / sum])
  );
}

function sortDesc(obj: Record<string, number>) {
  return Object.entries(obj).sort((a, b) =>
    b[1] === a[1] ? a[0].localeCompare(b[0]) : b[1] - a[1]
  );
}

function codeToPShort(code?: string | null) {
  if (!code) return "";
  const m = code.match(/PROFILE_(\d+)/i);
  if (m) return `P${m[1]}`;
  const m2 = code.match(/P(\d+)/i);
  return m2 ? `P${m2[1]}` : code;
}

function BarRow({
  label,
  pct,
  note,
}: {
  label: string;
  pct: number;
  note?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-48 text-sm">
        <span className="font-medium">{label}</span>
        {note ? <span className="text-gray-500"> {note}</span> : null}
      </div>
      <div className="flex-1 h-2 rounded bg-gray-200">
        <div
          className="h-2 rounded bg-blue-600"
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
      <div className="w-10 text-right text-sm tabular-nums">{pct}%</div>
    </div>
  );
}

type QscAudience = "entrepreneur" | "leader";

async function fetchVisibilityInternalSnapshot(args: {
  orgSlug: string;
  takerId: string;
}) {
  const { orgSlug, takerId } = args;

  try {
    const origin = getBaseUrl();
    const url = `${origin}/api/portal/visibility/taker/${encodeURIComponent(
      takerId
    )}/snapshot?org=${encodeURIComponent(orgSlug)}&audience=internal_snapshot`;

    const res = await fetch(url, { cache: "no-store" });
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return null;

    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.ok) return null;
    return j?.data ?? null;
  } catch {
    return null;
  }
}

function prettyTier(t?: string | null) {
  const s = String(t || "").trim();
  return s || "—";
}

function prettyStyle(s?: string | null) {
  const t = String(s || "").trim().toUpperCase();
  return t || "—";
}

function prettyReadiness(r?: string | null) {
  const t = String(r || "").trim().toLowerCase();
  if (t === "ready_to_progress") return "Ready to progress";
  if (t === "stabilise") return "Stabilise";
  return t || "—";
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

  if (
    discoverability == null &&
    trust == null &&
    conversion == null
  ) {
    return null;
  }

  return {
    discoverability,
    trust,
    conversion,
  };
}

export default async function TakerDetail({
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

  // NOTE: do not org-filter taker here; we validate access below (supports wrapper org setups)
  const { data: taker } = await sb
    .from("test_takers")
    .select(
      "id, org_id, test_id, first_name, last_name, email, phone, created_at, company, role_title, link_token, last_result_url"
    )
    .eq("id", takerId)
    .maybeSingle();

  if (!taker) return notFound();

  // ✅ Access check:
  // 1) allow if taker belongs to this org
  // 2) otherwise allow if taker has ANY submission for a test whose tests.org_id == this org
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

  const { data: test } = await sb
    .from("tests")
    .select("id, name, slug, meta")
    .eq("id", taker.test_id)
    .maybeSingle();

  const { data: results } = await sb
    .from("test_results")
    .select("id, created_at, totals")
    .eq("taker_id", taker.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const latest = (results ?? [])[0] || null;
  const totalsRaw = parseTotals(latest?.totals);

  // ✅ Detect Visibility engine totals (from your submit route)
  const isVisibility =
    Boolean(totalsRaw?.visibility) ||
    String(totalsRaw?.meta?.engine || "").toLowerCase().includes("visibility");

  // ----- Meta + framework lookup ------------------------------------------
  const meta: any = (test?.meta as any) ?? {};
  const framework: any = meta?.framework || meta || {};

  const profilesSource: any[] = Array.isArray(framework?.profiles)
    ? framework.profiles
    : Array.isArray(meta?.profiles)
    ? meta.profiles
    : [];

  const profiles: Array<{ name: string; code?: string; frequency?: string }> =
    profilesSource.map((p: any) => ({
      name: String(p?.name ?? ""),
      code: p?.code ?? null,
      frequency: p?.frequency ?? null,
    }));

  const freqSource: any[] = Array.isArray(framework?.frequencies)
    ? framework.frequencies
    : Array.isArray(meta?.frequencies)
    ? meta.frequencies
    : [];

  const freqLabels: Record<string, string> = freqSource.length
    ? Object.fromEntries(
        freqSource.map((f: any) => [
          String(f?.code ?? "").toUpperCase(),
          String(f?.label ?? ""),
        ])
      )
    : { A: "A", B: "B", C: "C", D: "D" };

  // --- Build frequency and profile score maps (raw points) ----------------
  let profileScores: Record<string, number> = {};
  let frequencyScores: Record<string, number> = {};

  if (
    totalsRaw &&
    typeof totalsRaw === "object" &&
    ("frequencies" in totalsRaw || "profiles" in totalsRaw)
  ) {
    // New structured shape: { frequencies: {...}, profiles: {...} }
    const tr: any = totalsRaw;

    if (tr.frequencies && typeof tr.frequencies === "object") {
      frequencyScores = Object.fromEntries(
        Object.entries(tr.frequencies).map(([k, v]) => [
          String(k).toUpperCase(),
          Number(v) || 0,
        ])
      );
    }

    if (tr.profiles && typeof tr.profiles === "object") {
      const rawProfiles = tr.profiles as Record<string, number>;

      const codeToName = new Map<string, string>();
      for (const p of profiles) {
        if (p.code) {
          const upperCode = String(p.code).toUpperCase();
          codeToName.set(upperCode, p.name);
          codeToName.set(codeToPShort(upperCode), p.name);
        }
      }

      profileScores = {};
      for (const [rawKey, value] of Object.entries(rawProfiles)) {
        const upperKey = String(rawKey).toUpperCase();
        const short = codeToPShort(upperKey);
        const mappedName =
          codeToName.get(upperKey) ||
          codeToName.get(short.toUpperCase()) ||
          rawKey;
        profileScores[mappedName] = Number(value) || 0;
      }
    }
  } else {
    // Legacy flat totals
    const keys = Object.keys(totalsRaw || {});
    const isFreqTotals =
      keys.length &&
      keys.every((k) => ["A", "B", "C", "D"].includes(k.toUpperCase()));

    if (isFreqTotals) {
      frequencyScores = Object.fromEntries(
        Object.entries(totalsRaw).map(([k, v]) => [
          k.toUpperCase(),
          Number(v) || 0,
        ])
      );
    } else {
      // Assume these are profile scores keyed by profile name
      profileScores = Object.fromEntries(
        Object.entries(totalsRaw).map(([k, v]) => [String(k), Number(v) || 0])
      );

      const p2f = Object.fromEntries(
        profiles.map((p) => [p.name, (p.frequency || "").toUpperCase()])
      );
      frequencyScores = Object.entries(profileScores).reduce(
        (acc, [pName, score]) => {
          const f = p2f[pName] || "";
          if (!f) return acc;
          acc[f] = (acc[f] || 0) + (Number(score) || 0);
          return acc;
        },
        {} as Record<string, number>
      );
    }
  }

  // --- Percentages for display (0–100) ------------------------------------
  const freqPct = asPercentMap(frequencyScores);
  const profilePct = asPercentMap(profileScores);
  const topProfile = sortDesc(profileScores)[0] as [string, number] | undefined;

  // --- Decimals for coach summary (0–1) -----------------------------------
  const freqDec = asDecimalMap(frequencyScores);
  const profileDec = asDecimalMap(profileScores);

  const freqLabelArray = (["A", "B", "C", "D"] as const).map((code) => ({
    code,
    name: freqLabels[code] || code,
  }));

  const topFreqEntry = sortDesc(freqDec)[0];
  const topFreqCode = (topFreqEntry ? topFreqEntry[0].toUpperCase() : "A") as
    | "A"
    | "B"
    | "C"
    | "D";

  const sortedProfileDec = sortDesc(profileDec);
  const primaryDec = sortedProfileDec[0]
    ? { code: "", name: sortedProfileDec[0][0], pct: sortedProfileDec[0][1] }
    : undefined;
  const secondaryDec = sortedProfileDec[1]
    ? { code: "", name: sortedProfileDec[1][0], pct: sortedProfileDec[1][1] }
    : undefined;
  const tertiaryDec = sortedProfileDec[2]
    ? { code: "", name: sortedProfileDec[2][0], pct: sortedProfileDec[2][1] }
    : undefined;

  const hasScores =
    Object.values(frequencyScores).some((v) => v > 0) ||
    Object.values(profileScores).some((v) => v > 0);

  const coachSummary = hasScores
    ? buildCoachSummary({
        participant: {
          firstName: taker.first_name || undefined,
          role: taker.role_title || undefined,
          company: taker.company || undefined,
        },
        organisation: {
          name: org.name,
        },
        frequencies: {
          labels: freqLabelArray,
          percentages: freqDec as Record<"A" | "B" | "C" | "D", number>,
          topCode: topFreqCode,
        },
        profiles: {
          labels: profiles.map((p) => ({ code: p.code || "", name: p.name })),
          percentages: profileDec,
          primary: primaryDec,
          secondary: secondaryDec,
          tertiary: tertiaryDec,
        },
      })
    : "";

  const fullName =
    [taker.first_name, taker.last_name].filter(Boolean).join(" ").trim() || "—";

  // Build top 3 profiles for cards (using percentage profile mix)
  const sortedProfilePct = sortDesc(profilePct);
  const topThreeProfiles = sortedProfilePct.slice(0, 3).map(([name, pct]) => {
    const pMeta = profiles.find((p) => p.name === name);
    const code = pMeta?.code || "";
    return { name, pct, code };
  });

  const labels = ["Primary profile", "Secondary", "Tertiary"];

  // --- QSC URLs (Portal-only Snapshot + Portal-only Extended + Public Strategic) ---
  const isQsc =
    test?.slug === "qsc-core" ||
    test?.slug === "qsc-leaders" ||
    (typeof meta?.frameworkType === "string" &&
      meta.frameworkType.toLowerCase() === "qsc");

  let qscSnapshotUrl: string | null = null;
  let qscExtendedUrl: string | null = null;
  let qscStrategicUrl: string | null = null;

  // Determine QSC audience server-side so we build correct URLs (leader vs entrepreneur)
  let qscAudience: QscAudience | null = null;

  if (isQsc && taker.link_token) {
    const { data: qscRow } = await sb
      .from("qsc_results")
      .select("audience, created_at")
      .eq("token", taker.link_token)
      .eq("taker_id", taker.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const aud = (qscRow?.audience as QscAudience | null) ?? null;

    if (aud === "leader" || aud === "entrepreneur") {
      qscAudience = aud;
    } else if (test?.slug === "qsc-leaders") {
      qscAudience = "leader";
    } else {
      qscAudience = "entrepreneur";
    }

    const base = `/qsc/${encodeURIComponent(taker.link_token)}`;
    const query = `?tid=${encodeURIComponent(taker.id)}`;

    qscSnapshotUrl = `${base}${query}`;

    const extendedPath =
      qscAudience === "leader" ? "/extended-leader" : "/extended";
    qscExtendedUrl = `${base}${extendedPath}${query}`;

    const strategicPath = qscAudience === "leader" ? "/leader" : "/entrepreneur";
    qscStrategicUrl = `${base}${strategicPath}${query}`;
  }

  // --- Main report URL (what "Open test-taker report" should open) ----------
  let reportUrl: string | null = null;

  if (isQsc) {
    reportUrl = qscStrategicUrl;
  } else if (isVisibility && taker.link_token) {
    // ✅ Visibility should open the bespoke visibility report
    reportUrl = `/t/${encodeURIComponent(
      taker.link_token
    )}/visibility/report?tid=${encodeURIComponent(taker.id)}&src=portal`;
  } else if (taker.link_token) {
    reportUrl = `/t/${encodeURIComponent(
      taker.link_token
    )}/report?tid=${encodeURIComponent(taker.id)}&src=portal`;
  } else if (taker.last_result_url) {
    reportUrl = String(taker.last_result_url);
  }

  const freqDefs: any[] = freqSource || [];

  // ✅ Load internal visibility snapshot (Option B2 endpoint)
  const visibilitySnapshot = await fetchVisibilityInternalSnapshot({
    orgSlug: slug,
    takerId: taker.id,
  });

  // ✅ Build Profile Extended Report for internal portal view only
  const visibilityTier = asVisibilityTier(
    visibilitySnapshot?.signals?.tier ??
      totalsRaw?.visibility?.tier ??
      totalsRaw?.tier ??
      totalsRaw?.computed?.tier ??
      null
  );

  const visibilityLevel =
    asNumber(
      visibilitySnapshot?.signals?.level ??
        totalsRaw?.visibility?.level ??
        totalsRaw?.level ??
        totalsRaw?.computed?.level ??
        totalsRaw?.computed?.tier_level ??
        null
    ) ?? 0;

  const visibilityStyle = asBehaviourStyle(
    visibilitySnapshot?.signals?.style ??
      visibilitySnapshot?.signals?.behaviour_style ??
      totalsRaw?.visibility?.style ??
      totalsRaw?.visibility?.behaviour_style ??
      totalsRaw?.behaviour_style ??
      totalsRaw?.computed?.behaviour_style ??
      totalsRaw?.computed?.style ??
      null
  );

  const visibilityReadiness = asReadiness(
    visibilitySnapshot?.signals?.readiness ??
      totalsRaw?.visibility?.readiness ??
      totalsRaw?.readiness ??
      totalsRaw?.computed?.readiness ??
      null
  );

  const visibilityPillarScores = normalizePillarScores(
    visibilitySnapshot?.signals?.pillar_scores ??
      visibilitySnapshot?.pillar_scores ??
      totalsRaw?.pillar_scores ??
      totalsRaw?.visibility?.pillar_scores ??
      totalsRaw?.computed?.pillar_scores ??
      null
  );

  const profileExtendedReport =
    isVisibility && visibilityTier && visibilityLevel > 0 && visibilityStyle
      ? await buildProfileExtendedReport({
          tier: visibilityTier,
          level: visibilityLevel,
          behaviour_style: visibilityStyle,
          readiness: visibilityReadiness,
          pillar_scores: visibilityPillarScores,
        })
      : null;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{fullName}</h1>
          <p className="text-sm text-gray-500">{org.name}</p>
        </div>
        <Link
          href={`/portal/${slug}/database`}
          className="rounded-md border px-3 py-2 text-sm"
        >
          Back to database
        </Link>
      </header>

      {/* Contact */}
      <section className="rounded-xl border p-4 bg-white">
        <h2 className="font-medium mb-3">Contact</h2>
        <dl className="grid grid-cols-3 gap-2 text-sm">
          <dt className="text-gray-500">First name</dt>
          <dd className="col-span-2">{taker.first_name || "—"}</dd>
          <dt className="text-gray-500">Last name</dt>
          <dd className="col-span-2">{taker.last_name || "—"}</dd>
          <dt className="text-gray-500">Email</dt>
          <dd className="col-span-2">{taker.email || "—"}</dd>
          <dt className="text-gray-500">Phone</dt>
          <dd className="col-span-2">{taker.phone || "—"}</dd>
          <dt className="text-gray-500">Created at</dt>
          <dd className="col-span-2">
            {taker.created_at
              ? new Date(taker.created_at as any).toLocaleString()
              : "—"}
          </dd>
          <dt className="text-gray-500">Company</dt>
          <dd className="col-span-2">{taker.company || "—"}</dd>
          <dt className="text-gray-500">Role title</dt>
          <dd className="col-span-2">{taker.role_title || "—"}</dd>
        </dl>
      </section>

      {/* ✅ Visibility Snapshot Panel (Portal-only) */}
      {visibilitySnapshot && (
        <section className="rounded-xl border p-4 bg-white space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-medium">Visibility Snapshot</h2>
              <p className="text-sm text-gray-500">
                Internal summary (KB-driven)
              </p>
            </div>

            {taker.link_token && (
              <Link
                href={`/t/${encodeURIComponent(
                  taker.link_token
                )}/visibility/report?tid=${encodeURIComponent(taker.id)}&src=portal`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium hover:bg-slate-100"
              >
                Open Visibility Report
              </Link>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border bg-slate-50 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Tier
              </div>
              <div className="mt-1 text-lg font-semibold">
                {prettyTier(visibilitySnapshot?.signals?.tier)}
              </div>
            </div>

            <div className="rounded-lg border bg-slate-50 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Level
              </div>
              <div className="mt-1 text-lg font-semibold">
                {Number(visibilitySnapshot?.signals?.level ?? 0) || "—"}
              </div>
            </div>

            <div className="rounded-lg border bg-slate-50 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Style
              </div>
              <div className="mt-1 text-lg font-semibold">
                {prettyStyle(visibilitySnapshot?.signals?.style)}
              </div>
            </div>

            <div className="rounded-lg border bg-slate-50 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Readiness
              </div>
              <div className="mt-1 text-lg font-semibold">
                {prettyReadiness(visibilitySnapshot?.signals?.readiness)}
              </div>
            </div>
          </div>

          {visibilitySnapshot?.summary && (
            <div className="rounded-lg border bg-white p-3">
              <div className="text-sm font-medium">Quick take</div>
              <div className="mt-2 grid gap-2 md:grid-cols-2 text-sm text-slate-700">
                {visibilitySnapshot.summary.snapshot ? (
                  <p>
                    <span className="font-semibold">Snapshot:</span>{" "}
                    {visibilitySnapshot.summary.snapshot}
                  </p>
                ) : null}
                {visibilitySnapshot.summary.pillars ? (
                  <p>
                    <span className="font-semibold">Pillars:</span>{" "}
                    {visibilitySnapshot.summary.pillars}
                  </p>
                ) : null}
                {visibilitySnapshot.summary.opportunity ? (
                  <p>
                    <span className="font-semibold">Opportunity:</span>{" "}
                    {visibilitySnapshot.summary.opportunity}
                  </p>
                ) : null}
                {visibilitySnapshot.summary.next_move ? (
                  <p>
                    <span className="font-semibold">Next move:</span>{" "}
                    {visibilitySnapshot.summary.next_move}
                  </p>
                ) : null}
              </div>
            </div>
          )}

          {Array.isArray(visibilitySnapshot?.sections) &&
            visibilitySnapshot.sections.length > 0 && (
              <div className="space-y-2">
                {visibilitySnapshot.sections.map((sec: any) => (
                  <details
                    key={sec.key}
                    className="rounded-lg border bg-white p-3"
                  >
                    <summary className="cursor-pointer font-medium">
                      {sec.title || sec.key}
                    </summary>
                    <div className="mt-3 space-y-3 text-sm text-slate-700">
                      {(sec.blocks || []).map((b: any, idx: number) => (
                        <div key={idx} className="space-y-2">
                          {b?.paragraphs && Array.isArray(b.paragraphs) ? (
                            b.paragraphs
                              .map((p: any) => String(p || "").trim())
                              .filter(Boolean)
                              .map((p: string, i: number) => (
                                <p key={i} className="leading-relaxed">
                                  {p}
                                </p>
                              ))
                          ) : b?.short_summary ? (
                            <p className="leading-relaxed">
                              {String(b.short_summary)}
                            </p>
                          ) : null}

                          {b?.bullets && Array.isArray(b.bullets) && b.bullets.length ? (
                            <ul className="list-disc pl-5 space-y-1">
                              {b.bullets
                                .map((x: any) => String(x || "").trim())
                                .filter(Boolean)
                                .map((x: string, i: number) => (
                                  <li key={i}>{x}</li>
                                ))}
                            </ul>
                          ) : null}

                          {b?.transition ? (
                            <p className="text-slate-500 italic">
                              {String(b.transition)}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            )}
        </section>
      )}

      {/* ✅ Profile Extended Report (Portal-only / internal) */}
      {profileExtendedReport?.sections?.length ? (
        <section className="rounded-xl border p-4 bg-white space-y-4">
          <div>
            <h2 className="font-medium">Profile Extended Report</h2>
            <p className="text-sm text-gray-500">
              Internal profile layer built from Visibility Ladder KB blocks
            </p>
          </div>

          <div className="space-y-5">
            {profileExtendedReport.sections.map((section) => (
              <div
                key={section.section_key}
                className="rounded-xl border border-slate-200 bg-slate-50/50 p-4"
              >
                {section.heading ? (
                  <h3 className="text-base font-semibold text-slate-900">
                    {section.heading}
                  </h3>
                ) : null}

                {section.subheading ? (
                  <p className="mt-1 text-sm text-slate-500">
                    {section.subheading}
                  </p>
                ) : null}

                <div className="mt-4 space-y-4">
                  {section.blocks.map((block, index) => (
                    <div
                      key={`${section.section_key}-${index}`}
                      className="rounded-lg border border-slate-100 bg-white p-4"
                    >
                      {block.heading ? (
                        <h4 className="text-sm font-semibold text-slate-900">
                          {block.heading}
                        </h4>
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
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Latest Result */}
      <section className="rounded-xl border p-4 bg-white space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-medium">Latest Result</h2>
            <dl className="mt-1 grid grid-cols-3 gap-2 text-sm">
              <dt className="text-gray-500">Test</dt>
              <dd className="col-span-2">{test?.name || "—"}</dd>
              <dt className="text-gray-500">Completed</dt>
              <dd className="col-span-2">
                {latest?.created_at
                  ? new Date(latest.created_at as any).toLocaleString()
                  : "—"}
              </dd>
              <dt className="text-gray-500">Top profile</dt>
              <dd className="col-span-2">
                {topProfile ? `${topProfile[0]} (${topProfile[1]})` : "—"}
              </dd>
            </dl>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap gap-2">
              {reportUrl && (
                <Link
                  href={reportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md border border-sky-500 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-800 hover:bg-sky-100"
                >
                  Open test-taker report
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* ✅ QSC buttons now open in a new tab */}
        {isQsc && (qscSnapshotUrl || qscExtendedUrl || qscStrategicUrl) && (
          <div className="flex flex-wrap gap-2 pt-2">
            {qscSnapshotUrl && (
              <Link
                href={qscSnapshotUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-sky-500 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-800 hover:bg-sky-100"
              >
                Buyer Persona Snapshot
              </Link>
            )}

            {qscExtendedUrl && (
              <Link
                href={qscExtendedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-50 hover:bg-slate-800"
              >
                Extended Source Code Snapshot
              </Link>
            )}

            {qscStrategicUrl && (
              <Link
                href={qscStrategicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-amber-600 bg-amber-500 px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-400"
              >
                QSC — Strategic Growth Report
              </Link>
            )}
          </div>
        )}

        <div className="space-y-2 pt-4">
          <h3 className="font-medium">Frequency mix</h3>
          {["A", "B", "C", "D"].map((f) => (
            <BarRow
              key={f}
              label={
                (freqDefs.find(
                  (x: any) => String(x?.code).toUpperCase() === f
                )?.label as string) ||
                freqLabels[f] ||
                f
              }
              note={`(${f})`}
              pct={freqPct[f] ?? 0}
            />
          ))}
        </div>

        <div className="space-y-2">
          <h3 className="font-medium">Profile mix</h3>
          {Object.keys(profilePct).length ? (
            sortDesc(profilePct).map(([name, pct]) => {
              const p = profiles.find((x) => x.name === name);
              const short = codeToPShort(p?.code || "");
              return (
                <BarRow
                  key={name}
                  label={name}
                  note={short ? `(${short})` : undefined}
                  pct={pct}
                />
              );
            })
          ) : (
            <p className="text-sm text-gray-500">
              Profile-level scores aren’t available for this result (only
              frequencies were stored).
            </p>
          )}
        </div>

        {/* Primary / Secondary / Tertiary cards for coaches */}
        {topThreeProfiles.length > 0 && (
          <div className="grid gap-4 md:grid-cols-3 pt-4">
            {topThreeProfiles.map((p, idx) => (
              <div
                key={p.name}
                className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {labels[idx] || "Profile"}
                </p>
                <h3 className="mt-1 text-base font-semibold text-slate-900">
                  {p.name}
                </h3>
                {p.code && (
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">
                    {p.code}
                  </p>
                )}
                <p className="mt-2 text-sm font-medium text-slate-800">
                  {p.pct}% match
                </p>
              </div>
            ))}
          </div>
        )}

        {coachSummary && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h3 className="font-medium mb-2">Coach summary</h3>
            <div className="space-y-2 text-sm leading-relaxed text-gray-700">
              {coachSummary
                .split(/\n{2,}/)
                .map((p) => p.trim())
                .filter(Boolean)
                .map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
