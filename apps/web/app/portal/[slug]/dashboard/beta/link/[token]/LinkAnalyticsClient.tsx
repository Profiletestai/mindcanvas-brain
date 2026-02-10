// apps/web/app/portal/[slug]/dashboard/beta/link/[token]/LinkAnalyticsClient.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type TimelinePoint = { date: string; submissions: number };

type DistItem = {
  code: string;
  name: string;
  count: number;
  pct: number;
  avgPoints: number;
};

type CompanyItem = {
  company: string;
  testsTaken: number;
  pct: number;
};

type LinkApiPayload = {
  ok: true;
  filters: { token: string; from: string; to: string };
  link: {
    linkId: string;
    orgId: string;
    testId: string;
    token: string;
    name: string | null;
    label: string | null;
    isActive: boolean | null;
    createdAt: string;
    expiresAt: string | null;
    redirectUrl: string | null;
    nextStepsUrl: string | null;
    showResults: boolean | null;
    meta: any;
  };
  kpis: { testsTaken: number; uniqueTakers: number | null; lastUsedAt: string | null };
  timeline: TimelinePoint[];
  distributions: { profiles: DistItem[]; frequencies: DistItem[] };
  segments: { companies: CompanyItem[] };
};

type CompanySubmission = {
  submissionId: string;
  createdAt: string;
  takerId: string | null;
  // PII / client-owned fields (best-effort from test_takers row)
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;

  // optional extras if present
  meta?: any;
};

type CompanySubsPayload = {
  ok: true;
  token: string;
  company: string;
  from: string;
  to: string;
  total: number;
  submissions: CompanySubmission[];
};

function clampPct(p: number) {
  if (!Number.isFinite(p)) return 0;
  return Math.max(0, Math.min(1, p));
}

function fmtPct(p: number) {
  return `${Math.round(clampPct(p) * 100)}%`;
}

function fmtNum(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return String(Math.round(n));
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString();
}

/** CSV helpers */
function csvEscape(v: any) {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsvLines(filename: string, lines: string[]) {
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadCsv(filename: string, header: string[], rows: any[][]) {
  const lines = [header.map(csvEscape).join(","), ...rows.map((r) => r.map(csvEscape).join(","))];
  downloadCsvLines(filename, lines);
}

function SimpleBars({ data }: { data: TimelinePoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.submissions || 0));
  return (
    <div className="w-full">
      <div className="flex items-end gap-1 h-24">
        {data.map((p) => {
          const h = Math.round((p.submissions / max) * 96);
          return (
            <div key={p.date} className="flex-1 min-w-[6px]">
              <div
                className="w-full rounded-sm bg-white/70"
                style={{ height: `${h}px` }}
                title={`${p.date}: ${Math.round(p.submissions)}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-white/60">
        <span>{data[0]?.date ?? ""}</span>
        <span>{data[data.length - 1]?.date ?? ""}</span>
      </div>
    </div>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: any;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-full px-3 py-1 text-xs border",
        active
          ? "bg-white text-black border-white"
          : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10",
      ].join(" ")}
      type="button"
    >
      {children}
    </button>
  );
}

function initials(first?: string | null, last?: string | null, email?: string | null) {
  const a = (first || "").trim();
  const b = (last || "").trim();
  const e = (email || "").trim();
  const f = a ? a[0] : e ? e[0] : "?";
  const l = b ? b[0] : a && a.length > 1 ? a[1] : "";
  return (f + l).toUpperCase();
}

export default function LinkAnalyticsClient({
  orgSlug,
  token,
  from,
  to,
  testId,
}: {
  orgSlug: string;
  token: string;
  from?: string;
  to?: string;
  testId?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState<LinkApiPayload | null>(null);

  const [tab, setTab] = useState<"companies" | "profiles" | "frequencies">("companies");

  // Company drill-down drawer
  const [companyOpen, setCompanyOpen] = useState(false);
  const [companyName, setCompanyName] = useState<string>("");
  const [companyLoading, setCompanyLoading] = useState(false);
  const [companyErr, setCompanyErr] = useState("");
  const [companyData, setCompanyData] = useState<CompanySubsPayload | null>(null);
  const [companySearch, setCompanySearch] = useState<string>("");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr("");

        const q = new URLSearchParams();
        q.set("token", token);
        if (from) q.set("from", from);
        if (to) q.set("to", to);

        const res = await fetch(`/api/portal-dashboard-v2/link?${q.toString()}`, { cache: "no-store" });
        const j = await res.json();
        if (!res.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${res.status}`);

        if (alive) setData(j as LinkApiPayload);
      } catch (e: any) {
        if (alive) setErr(String(e?.message || e));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [token, from, to, testId]);

  const title = useMemo(() => {
    const l = data?.link;
    if (!l) return "Link analytics";
    return l.name || l.label || "Link analytics";
  }, [data]);

  const safeName = useMemo(() => {
    const base = title || "link";
    return String(base).replace(/[^a-z0-9_-]+/gi, "_").slice(0, 40);
  }, [title]);

  function downloadCsvAllSections() {
    if (!data?.ok) return;

    const lines: string[] = [];

    const pushSection = (sectionTitle: string, header: string[], rows: any[][]) => {
      lines.push(csvEscape(sectionTitle));
      lines.push(header.map(csvEscape).join(","));
      for (const r of rows) lines.push(r.map(csvEscape).join(","));
      lines.push("");
    };

    const companies = (data.segments?.companies || []).map((c) => [
      c.company || "",
      fmtNum(c.testsTaken),
      Math.round(clampPct(c.pct) * 100),
    ]);

    const profiles = (data.distributions?.profiles || []).map((p) => [
      p.name || "",
      p.code || "",
      fmtNum(p.count),
      Math.round(clampPct(p.pct) * 100),
      fmtNum(p.avgPoints),
    ]);

    const freqs = (data.distributions?.frequencies || []).map((f) => [
      f.name || "",
      f.code || "",
      fmtNum(f.count),
      Math.round(clampPct(f.pct) * 100),
      fmtNum(f.avgPoints),
    ]);

    pushSection("Companies", ["company", "tests_taken", "pct"], companies);
    pushSection("Profiles", ["profile_name", "profile_code", "count", "pct", "avg_points"], profiles);
    pushSection("Frequencies", ["frequency_name", "frequency_code", "count", "pct", "avg_points"], freqs);

    const filename = `link_analytics_${orgSlug}_${safeName}.csv`;
    downloadCsvLines(filename, lines);
  }

  const backHref = useMemo(() => {
    const q = new URLSearchParams();
    if (testId) q.set("testId", testId);
    const qs = q.toString();
    return `/portal/${orgSlug}/dashboard/beta${qs ? `?${qs}` : ""}`;
  }, [orgSlug, testId]);

  const timelineSorted = useMemo(() => {
    const t = (data?.timeline || []).slice();
    t.sort((a, b) => (a.date < b.date ? -1 : 1));
    return t;
  }, [data]);

  async function openCompany(c: string) {
    const company = (c || "").trim() || "Unknown";
    setCompanyName(company);
    setCompanyOpen(true);
    setCompanySearch("");
    setCompanyErr("");
    setCompanyData(null);
    setCompanyLoading(true);

    try {
      const q = new URLSearchParams();
      q.set("token", token);
      q.set("company", company);
      if (from) q.set("from", from);
      if (to) q.set("to", to);
      // org/testId not required by the API route; keep optional for future checks
      // q.set("org", orgSlug);

      const res = await fetch(`/api/portal-dashboard-v2/link/company-submissions?${q.toString()}`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${res.status}`);

      setCompanyData(j as CompanySubsPayload);
    } catch (e: any) {
      setCompanyErr(String(e?.message || e));
    } finally {
      setCompanyLoading(false);
    }
  }

  function closeCompany() {
    setCompanyOpen(false);
    setCompanyName("");
    setCompanyData(null);
    setCompanyErr("");
    setCompanyLoading(false);
    setCompanySearch("");
  }

  const filteredCompanySubs = useMemo(() => {
    const subs = companyData?.submissions || [];
    const q = (companySearch || "").trim().toLowerCase();
    if (!q) return subs;

    return subs.filter((s) => {
      const name = `${s.firstName || ""} ${s.lastName || ""}`.toLowerCase();
      const email = (s.email || "").toLowerCase();
      const phone = (s.phone || "").toLowerCase();
      return name.includes(q) || email.includes(q) || phone.includes(q);
    });
  }, [companyData, companySearch]);

  function exportCompanyCsv() {
    if (!companyData?.ok) return;

    const header = [
      "submitted_at",
      "company",
      "first_name",
      "last_name",
      "email",
      "phone",
      "taker_id",
      "submission_id",
    ];

    const rows = (filteredCompanySubs || []).map((s) => [
      s.createdAt || "",
      companyData.company || "",
      s.firstName || "",
      s.lastName || "",
      s.email || "",
      s.phone || "",
      s.takerId || "",
      s.submissionId || "",
    ]);

    const safeCompany = String(companyData.company || "company").replace(/[^a-z0-9_-]+/gi, "_").slice(0, 40);
    const filename = `company_submissions_${orgSlug}_${safeName}_${safeCompany}.csv`;
    downloadCsv(filename, header, rows);
  }

  return (
    <div className="min-h-screen p-6 text-white space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-widest text-white/60">Beta</div>
            <h1 className="text-2xl font-semibold truncate">{title}</h1>
            <div className="text-sm text-white/60 mt-1">
              {data?.filters?.from && data?.filters?.to ? (
                <>
                  Date range: <span className="text-white/80">{fmtDateTime(data.filters.from)}</span> →{" "}
                  <span className="text-white/80">{fmtDateTime(data.filters.to)}</span>
                </>
              ) : null}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={downloadCsvAllSections}
              disabled={!data?.ok}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
              title="Download summary sections as CSV"
              type="button"
            >
              Download CSV
            </button>
            <Link
              href={backHref}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>

      {loading && <div className="text-white/70">Loading…</div>}
      {err && <div className="text-red-300">Error: {err}</div>}

      {!loading && !err && data?.ok && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60">Tests taken</div>
              <div className="text-3xl font-semibold">{fmtNum(data.kpis.testsTaken)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60">Unique takers</div>
              <div className="text-3xl font-semibold">{fmtNum(data.kpis.uniqueTakers)}</div>
              <div className="text-xs text-white/50 mt-1">
                {data.kpis.uniqueTakers != null && data.kpis.testsTaken
                  ? `${fmtPct(data.kpis.uniqueTakers / data.kpis.testsTaken)} unique`
                  : ""}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60">Last used</div>
              <div className="text-sm text-white/80 mt-2">{fmtDateTime(data.kpis.lastUsedAt)}</div>
            </div>
          </div>

          {/* Timeline */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Activity over time</h2>
              <div className="text-xs text-white/50">Daily submissions</div>
            </div>
            <div className="mt-3">
              {timelineSorted.length ? (
                <SimpleBars data={timelineSorted} />
              ) : (
                <div className="text-sm text-white/60">No activity in this range.</div>
              )}
            </div>
          </div>

          {/* Segmentation (Tabbed) */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Segmentation</h2>
                <p className="text-sm text-white/60">
                  Click a company to drill down into individual submissions and export.
                </p>
              </div>

              <div className="flex gap-2">
                <TabButton active={tab === "companies"} onClick={() => setTab("companies")}>
                  Companies
                </TabButton>
                <TabButton active={tab === "profiles"} onClick={() => setTab("profiles")}>
                  Profiles
                </TabButton>
                <TabButton active={tab === "frequencies"} onClick={() => setTab("frequencies")}>
                  Frequencies
                </TabButton>
              </div>
            </div>

            <div className="mt-4">
              {tab === "companies" ? (
                <div className="space-y-2">
                  {(data.segments?.companies || []).length ? (
                    (data.segments.companies || []).slice(0, 50).map((c) => {
                      const name = (c.company || "").trim() || "Unknown";
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => openCompany(name)}
                          className="w-full text-left flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 hover:bg-white/10"
                          title="View submissions for this company"
                        >
                          <div className="min-w-0">
                            <div className="font-medium truncate">{name}</div>
                            <div className="text-xs text-white/50">
                              {fmtNum(c.testsTaken)} · {fmtPct(c.pct)}
                            </div>
                          </div>
                          <div className="text-xs text-white/70">
                            View submissions →
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="text-sm text-white/60">No company data captured for this link.</div>
                  )}
                </div>
              ) : null}

              {tab === "profiles" ? (
                <div className="space-y-2">
                  {(data.distributions?.profiles || []).length ? (
                    (data.distributions.profiles || []).slice(0, 60).map((p) => (
                      <div
                        key={p.code}
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3"
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate">{p.name}</div>
                          <div className="text-xs text-white/50">
                            {fmtNum(p.count)} · {fmtPct(p.pct)}
                          </div>
                        </div>
                        <div className="text-xs text-white/70">avg {fmtNum(p.avgPoints)}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-white/60">No profile data.</div>
                  )}
                </div>
              ) : null}

              {tab === "frequencies" ? (
                <div className="space-y-2">
                  {(data.distributions?.frequencies || []).length ? (
                    (data.distributions.frequencies || []).slice(0, 30).map((f) => (
                      <div
                        key={f.code}
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3"
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate">{f.name}</div>
                          <div className="text-xs text-white/50">
                            {fmtNum(f.count)} · {fmtPct(f.pct)}
                          </div>
                        </div>
                        <div className="text-xs text-white/70">avg {fmtNum(f.avgPoints)}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-white/60">No frequency data.</div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}

      {/* Company drill-down drawer */}
      {companyOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={closeCompany} />
          <div className="absolute right-0 top-0 h-full w-full max-w-[720px] bg-[#050914] border-l border-white/10 p-4 overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-white/50">Company submissions</div>
                <div className="text-lg font-semibold truncate">{companyName}</div>
                <div className="text-xs text-white/50 mt-1">
                  {from || to ? (
                    <>
                      Range: {from || "—"} → {to || "—"}
                    </>
                  ) : null}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={exportCompanyCsv}
                  disabled={!companyData?.ok}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
                  type="button"
                  title="Export filtered submissions"
                >
                  Export CSV
                </button>
                <button
                  onClick={closeCompany}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
                  type="button"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="mt-4">
              {companyLoading ? <div className="text-white/70">Loading submissions…</div> : null}
              {companyErr ? <div className="text-red-300">Error: {companyErr}</div> : null}

              {!companyLoading && !companyErr && companyData?.ok ? (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                    <div className="text-sm text-white/70">
                      Total: <span className="text-white">{fmtNum(companyData.total)}</span>
                    </div>

                    <div className="flex gap-2 items-center">
                      <input
                        value={companySearch}
                        onChange={(e) => setCompanySearch(e.target.value)}
                        placeholder="Search name, email, phone…"
                        className="h-10 w-full sm:w-[320px] rounded-lg bg-white/10 border border-white/10 px-3 text-sm text-white outline-none"
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-[980px] w-full text-sm">
                      <thead className="text-white/70">
                        <tr className="border-b border-white/10">
                          <th className="py-2 text-left font-medium">Taker</th>
                          <th className="py-2 text-left font-medium">Email</th>
                          <th className="py-2 text-left font-medium">Phone</th>
                          <th className="py-2 text-left font-medium">Submitted</th>
                          <th className="py-2 text-left font-medium">Submission ID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(filteredCompanySubs || []).map((s) => {
                          const fullName = `${s.firstName || ""} ${s.lastName || ""}`.trim() || "Unknown";
                          return (
                            <tr key={s.submissionId} className="border-b border-white/5 hover:bg-white/5">
                              <td className="py-3 pr-3">
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-xs">
                                    {initials(s.firstName, s.lastName, s.email)}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-medium truncate">{fullName}</div>
                                    <div className="text-xs text-white/50 truncate">
                                      {s.company || companyName}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 pr-3 text-white/80">{s.email || "—"}</td>
                              <td className="py-3 pr-3 text-white/80">{s.phone || "—"}</td>
                              <td className="py-3 pr-3 text-white/70">{fmtDateTime(s.createdAt)}</td>
                              <td className="py-3 pr-3 text-white/60 font-mono text-xs">{s.submissionId}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {!filteredCompanySubs.length ? (
                      <div className="mt-3 text-sm text-white/60">No submissions match your search.</div>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
