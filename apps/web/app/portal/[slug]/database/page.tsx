// apps/web/app/portal/[slug]/database/page.tsx
// Server component — Database list for /portal/[slug]/database
// Robust list with search, test filter, purpose filter, sort + CSV export.

import Link from "next/link";
import { createClient } from "@/lib/server/supabaseAdmin";
import TestTakerEmailActions from "@/components/portal/TestTakerEmailActions";
import DatabaseFilters from "@/components/portal/DatabaseFilters";
import PortalPageHeader from "@/components/portal/PortalPageHeader";

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  testId?: string;
  purpose?: string;
  status?: string;
  sort?: string;
  page?: string;
};

type Row = {
  id: string;
  testId: string;
  name: string;
  email: string;
  company: string;
  testName: string;
  testPurpose: string;
  testStatus: "Completed" | "Incomplete";
  created: string;
};

// Format a timestamp as a relative label (e.g. "2h ago", "Yesterday").
function relativeTime(value: string | null): string {
  if (!value) return "—";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "—";

  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;

  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function DatabasePage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: SearchParams;
}) {
  try {
    const { slug } = params;
    const sb = createClient().schema("portal");

    // --- 1) Resolve org by slug -------------------------------------------
    const { data: org, error: orgErr } = await sb
      .from("orgs")
      .select("id, slug, name")
      .eq("slug", slug)
      .maybeSingle();

    if (orgErr || !org) {
      throw new Error(orgErr?.message || "Organisation not found");
    }

    const q = (searchParams.q || "").trim();
    const selectedTestId = (searchParams.testId || "").trim();
    const selectedPurpose = (searchParams.purpose || "").trim();
    const selectedStatus = (searchParams.status || "").trim().toLowerCase();
    const sortKey = (searchParams.sort || "created_desc") as
      | "created_desc"
      | "created_asc"
      | "company_asc"
      | "company_desc";

    const page = Math.max(parseInt(searchParams.page || "1", 10), 1);
    const pageSize = 100;

    // --- 2) Load tests for dropdown ---------------------------------------
    const { data: tests, error: testErr } = await sb
      .from("tests")
      .select("id, name, slug")
      .eq("org_id", org.id)
      .order("name", { ascending: true });

    if (testErr) throw new Error(testErr.message);

    // Map: test_id → test name
    const testNameById = new Map<string, string>();
    (tests ?? []).forEach((t: any) => {
      testNameById.set(t.id, t.name || t.slug || "Untitled test");
    });

    // --- 3) Load link names / purposes for this org -----------------------
    const { data: linkRows, error: linkErr } = await sb
      .from("test_links")
      .select("token, name")
      .eq("org_id", org.id);

    if (linkErr) {
      console.warn("test_links load error on database page:", linkErr.message);
    }

    // Map: link token → name (your "Test name / Test purpose")
    const linkNameByToken = new Map<string, string>();
    const purposeSet = new Set<string>();

    (linkRows ?? []).forEach((r: any) => {
      const token = (r.token || "").trim();
      const name = (r.name || "").trim();
      if (!token) return;
      if (name) {
        linkNameByToken.set(token, name);
        purposeSet.add(name);
      }
    });

    const purposeOptions = Array.from(purposeSet).sort((a, b) =>
      a.localeCompare(b),
    );

    // --- 4) Build base taker query ----------------------------------------
    let orderColumn: "created_at" | "company" = "created_at";
    let ascending = false;

    if (sortKey === "created_asc") {
      orderColumn = "created_at";
      ascending = true;
    } else if (sortKey === "company_asc" || sortKey === "company_desc") {
      orderColumn = "company";
      ascending = sortKey === "company_asc";
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let takerQuery = sb
      .from("test_takers")
      .select(
        "id, first_name, last_name, email, company, created_at, test_id, link_token, status",
        { count: "exact" },
      )
      .eq("org_id", org.id)
      .order(orderColumn, { ascending })
      .order("id", { ascending });

    if (selectedTestId) {
      takerQuery = takerQuery.eq("test_id", selectedTestId);
    }

    // Push search into DB so pagination works correctly
    if (q) {
      const safeQ = q.replace(/[%_,]/g, " ").trim();
      if (safeQ) {
        takerQuery = takerQuery.or(
          [
            `first_name.ilike.%${safeQ}%`,
            `last_name.ilike.%${safeQ}%`,
            `email.ilike.%${safeQ}%`,
            `company.ilike.%${safeQ}%`,
          ].join(","),
        );
      }
    }

    // Push purpose filter into DB via matching link tokens
    if (selectedPurpose) {
      const matchingTokens = (linkRows ?? [])
        .filter((r: any) => ((r.name || "").trim() === selectedPurpose))
        .map((r: any) => (r.token || "").trim())
        .filter(Boolean);

      if (matchingTokens.length === 0) {
        takerQuery = takerQuery.in("link_token", ["__no_match__"]);
      } else {
        takerQuery = takerQuery.in("link_token", matchingTokens);
      }
    }

    // Push completion status filter into DB
    if (selectedStatus === "completed") {
      takerQuery = takerQuery.ilike("status", "completed");
    } else if (selectedStatus === "incomplete") {
      takerQuery = takerQuery.or("status.is.null,status.not.ilike.completed");
    }

    const { data: takers, error: tkErr, count } = await takerQuery.range(
      from,
      to,
    );
    if (tkErr) throw new Error(tkErr.message);

    const rows: Row[] = (takers ?? []).map((t: any) => {
      const linkToken = (t.link_token || "").trim();
      const testPurpose = linkNameByToken.get(linkToken) || "—";

      return {
        id: t.id,
        testId: t.test_id,
        name:
          [t.first_name, t.last_name].filter(Boolean).join(" ").trim() || "—",
        email: t.email || "—",
        company: t.company || "—",
        testName: testNameById.get(t.test_id) || "—",
        testPurpose,
        testStatus:
          String(t.status || "").toLowerCase() === "completed"
            ? "Completed"
            : "Incomplete",
        created: relativeTime(t.created_at),
      };
    });

    const totalCount = count ?? 0;
    const hasPrev = page > 1;
    const hasNext = page * pageSize < totalCount;

    // --- presentation helpers -------------------------------------------
    const avatarPalette = [
      "bg-sky-500/15 text-sky-300",
      "bg-emerald-500/15 text-emerald-300",
      "bg-amber-500/15 text-amber-300",
      "bg-violet-500/15 text-violet-300",
      "bg-rose-500/15 text-rose-300",
      "bg-cyan-500/15 text-cyan-300",
    ];
    const initials = (name: string) =>
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? "")
        .join("") || "—";
    const avatarColor = (seed: string) => {
      let h = 0;
      for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
      return avatarPalette[Math.abs(h) % avatarPalette.length];
    };

    // Status → pill badge (matches design: rounded-full bordered chip).
    const statusPillClass = (status: Row["testStatus"]) =>
      status === "Completed"
        ? "border-emerald-500/40 bg-emerald-500/[0.08] text-emerald-400"
        : "border-amber-500/40 bg-amber-500/[0.08] text-amber-400";

    // SAFE helper to build URLs from filters
    const buildHref = (extra: Partial<SearchParams>) => {
      const nextQ = extra.q !== undefined ? extra.q : q;
      const nextTestId =
        extra.testId !== undefined ? extra.testId : selectedTestId;
      const nextPurpose =
        extra.purpose !== undefined ? extra.purpose : selectedPurpose;
      const nextStatus =
        extra.status !== undefined ? extra.status : selectedStatus;
      const nextSort = extra.sort !== undefined ? extra.sort : sortKey;
      const nextPage = extra.page !== undefined ? extra.page : String(page);

      const usp = new URLSearchParams();

      if (nextQ) usp.set("q", nextQ);
      if (nextTestId) usp.set("testId", nextTestId);
      if (nextPurpose) usp.set("purpose", nextPurpose);
      if (nextStatus) usp.set("status", nextStatus);
      if (nextSort) usp.set("sort", nextSort);
      if (nextPage) usp.set("page", nextPage);

      const qs = usp.toString();
      return `/portal/${slug}/database${qs ? `?${qs}` : ""}`;
    };

    return (
      <div className="space-y-6 text-slate-100">
        {/* Header row: title + actions */}
        <PortalPageHeader
          title="Database"
          subtitle="All profile submissions — review results, track status, and take action."
          actions={
            <>
            <form action={`/api/portal/takers-export`} method="GET">
              <input type="hidden" name="org" value={slug} />
              <input type="hidden" name="q" value={q} />
              <input type="hidden" name="testId" value={selectedTestId} />
              <input type="hidden" name="purpose" value={selectedPurpose} />
              <input type="hidden" name="status" value={selectedStatus} />
              <input type="hidden" name="sort" value={sortKey} />
              <button
                type="submit"
                style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
                className="inline-flex h-[30px] items-center justify-center rounded-md border border-[rgba(255,255,255,0.11)] bg-[rgba(255,255,255,0.04)] px-4 text-[12px] font-bold leading-none tracking-[0.1px] text-[rgba(255,255,255,0.62)] transition-colors hover:bg-[rgba(255,255,255,0.08)]"
              >
                Export
              </button>
            </form>

            <Link
              href={`/portal/${slug}/links`}
              style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
              className="inline-flex h-[30px] items-center gap-[7px] rounded-md bg-[linear-gradient(101.83deg,#54AFE0_0%,#54AFE0_100%)] px-4 text-[12px] font-bold leading-none tracking-[0.1px] text-white shadow-[0_6px_20px_0_rgba(26,106,232,0.38)] transition-opacity hover:opacity-90"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              New test link
            </Link>
            </>
          }
        />

        {/* Filters row */}
        <DatabaseFilters
          tests={(tests ?? []).map((t: any) => ({
            id: t.id,
            label: t.name || t.slug || "Untitled",
          }))}
          purposeOptions={purposeOptions}
          initialQ={searchParams.q || ""}
          initialTestId={selectedTestId}
          initialPurpose={selectedPurpose}
          initialStatus={selectedStatus}
          initialSort={sortKey}
        />

        {/* Data card */}
        <div className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#0e2a45] backdrop-blur-[24px]">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/[0.07] text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-[#647789]">
                  <th className="px-6 py-5">Name</th>
                  <th className="px-5 py-5">Test taken</th>
                  <th className="px-5 py-5">Date</th>
                  <th className="px-5 py-5">Status</th>
                  <th className="px-5 py-5">Report</th>
                  <th className="px-5 py-5">Tags</th>
                  <th className="px-6 py-5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-white/[0.05] transition hover:bg-white/[0.025]"
                  >
                    {/* Name + email + avatar */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${avatarColor(
                            r.name,
                          )}`}
                        >
                          {initials(r.name)}
                        </span>
                        <div className="flex min-w-0 items-baseline gap-2.5">
                          <span className="whitespace-nowrap text-[15px] font-semibold text-white">
                            {r.name}
                          </span>
                          {r.email && r.email !== "—" && (
                            <span className="truncate text-[13px] text-slate-500">
                              {r.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Test taken */}
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center whitespace-nowrap rounded-full border border-[#3d6ea8]/50 px-3.5 py-1.5 text-[13px] font-medium text-[#4a9cff]">
                        {r.testName}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="whitespace-nowrap px-5 py-4 text-[14px] text-slate-400">
                      {r.created}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center whitespace-nowrap rounded-full border px-3 py-1 text-[12px] font-semibold ${statusPillClass(
                          r.testStatus,
                        )}`}
                      >
                        {r.testStatus}
                      </span>
                    </td>

                    {/* Report */}
                    <td className="px-5 py-4">
                      {r.testStatus === "Completed" ? (
                        <Link
                          href={`/portal/${slug}/database/${r.id}`}
                          className="inline-flex items-center whitespace-nowrap rounded-full border border-white/[0.12] bg-white/[0.06] px-4 py-1.5 text-[13px] font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
                        >
                          View report
                        </Link>
                      ) : (
                        <span className="whitespace-nowrap text-[13px] italic text-slate-500">
                          In progress
                        </span>
                      )}
                    </td>

                    {/* Tags */}
                    <td className="px-5 py-4">
                      {r.testPurpose && r.testPurpose !== "—" ? (
                        <span className="inline-flex items-center whitespace-nowrap rounded-full border border-white/[0.08] px-3.5 py-1.5 text-[13px] font-medium text-slate-500">
                          {r.testPurpose}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/portal/${slug}/database/${r.id}`}
                          title="View profile"
                          className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] border border-white/[0.08] bg-white/[0.04] text-white/[0.36] transition hover:bg-white/[0.07] hover:text-white/70"
                        >
                          <svg
                            width="26"
                            height="26"
                            viewBox="0 0 26 26"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.45714"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M8.71436 8.71429H17.2858V15.5714L14.7144 18.1429H8.71436V8.71429Z" />
                            <path d="M10.4285 11.2857H15.5713" />
                            <path d="M10.4285 13.8571H12.9999" />
                          </svg>
                        </Link>

                        <TestTakerEmailActions
                          orgSlug={slug}
                          testId={r.testId}
                          takerId={r.id}
                          compact
                        />

                        <a
                          href={`/api/portal/takers-export?org=${slug}&q=${encodeURIComponent(
                            r.email,
                          )}`}
                          title="Download CSV"
                          className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] border border-white/[0.08] bg-white/[0.04] text-white/[0.36] transition hover:bg-white/[0.07] hover:text-white/70"
                        >
                          <svg
                            width="26"
                            height="26"
                            viewBox="0 0 26 26"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.45714"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M8.71436 15.5714V17.2857H17.2858V15.5714M13.0001 8.71429V14.7143M15.5715 12.1429L13.0001 14.7143L10.4286 12.1429" />
                          </svg>
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}

                {rows.length === 0 && (
                  <tr>
                    <td
                      className="px-6 py-10 text-center text-slate-500"
                      colSpan={7}
                    >
                      No submissions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            Page {page}
            {totalCount > 0 ? ` · ${totalCount} total` : ""}
          </span>

          <div className="flex gap-2">
            {hasPrev ? (
              <Link
                href={buildHref({ page: String(page - 1) })}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-slate-200 transition hover:bg-white/10"
              >
                Prev
              </Link>
            ) : (
              <span className="cursor-not-allowed rounded-lg border border-white/5 bg-white/5 px-3 py-1.5 text-slate-600">
                Prev
              </span>
            )}

            {hasNext ? (
              <Link
                href={buildHref({ page: String(page + 1) })}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-slate-200 transition hover:bg-white/10"
              >
                Next
              </Link>
            ) : (
              <span className="cursor-not-allowed rounded-lg border border-white/5 bg-white/5 px-3 py-1.5 text-slate-600">
                Next
              </span>
            )}
          </div>
        </div>
      </div>
    );
  } catch (err: any) {
    return (
      <div className="space-y-3 p-6 text-red-200">
        <h1 className="text-xl font-semibold">Database page error</h1>
        <p className="text-sm">
          Something went wrong while loading the database view.
        </p>
        <pre className="whitespace-pre-wrap rounded border border-red-700/40 bg-red-950/40 p-3 text-xs">
          {String(err?.message || err)}
        </pre>
      </div>
    );
  }
}