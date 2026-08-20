// apps/web/app/portal/[slug]/mcas/links/McasLinksClient.tsx
"use client";

import { useCallback, useEffect, useState } from "react";

type McasLink = {
  id: string;
  name: string;
  status: string;
  publicToken: string;
  reusableUrl: string;
  reportVersion: "lite" | "full";
  usageLimitType: "unlimited" | "limited";
  usageLimitCount: number | null;
  createdAt: string;
  totalApplications: number;
  completedApplications: number;
  openApplications: number;
};

type Props = {
  orgSlug: string;
  canWrite: boolean;
};

export default function McasLinksClient({ orgSlug, canWrite }: Props) {
  const [links, setLinks] = useState<McasLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [contactOwnerName, setContactOwnerName] = useState("");
  const [reportVersion, setReportVersion] = useState<"lite" | "full">("full");
  const [showResults, setShowResults] = useState(false);
  const [nextStepsUrl, setNextStepsUrl] = useState("");
  const [usageLimitType, setUsageLimitType] = useState<"unlimited" | "limited">(
    "unlimited",
  );
  const [usageLimitCount, setUsageLimitCount] = useState("");
  const [saving, setSaving] = useState(false);

  const base = `/api/portal/${encodeURIComponent(orgSlug)}/mcas/links`;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(base, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }

      setLinks(json.links as McasLink[]);
    } catch (caught) {
      setLinks([]);
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function createLink(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          contactOwnerName: contactOwnerName.trim() || null,
          reportVersion,
          showResults,
          nextStepsUrl: nextStepsUrl.trim() || null,
          usageLimitType,
          usageLimitCount:
            usageLimitType === "limited"
              ? Number.parseInt(usageLimitCount, 10) || null
              : null,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }

      setNotice(`Link created: ${json.link.url}`);
      setName("");
      setContactOwnerName("");
      setNextStepsUrl("");
      setUsageLimitCount("");

      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSaving(false);
    }
  }

  async function patchLink(linkId: string, patch: Record<string, unknown>) {
    setError(null);
    setNotice(null);

    try {
      const res = await fetch(`${base}/${encodeURIComponent(linkId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }

      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
        </div>
      ) : null}

      {canWrite ? (
        <form
          onSubmit={createLink}
          className="space-y-4 rounded-xl border border-gray-200 bg-white p-5"
        >
          <h2 className="text-base font-semibold">New MCAS link</h2>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">
              Test name / purpose <span className="text-red-600">*</span>
            </span>
            <input
              className="w-full rounded border border-gray-300 p-2 text-sm"
              placeholder="e.g. Sales Rep — Q3 intake"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Contact owner</span>
            <input
              className="w-full rounded border border-gray-300 p-2 text-sm"
              placeholder="Who owns this hiring process"
              value={contactOwnerName}
              onChange={(e) => setContactOwnerName(e.target.value)}
            />
          </label>

          <div className="rounded-lg border border-gray-200 p-3">
            <div className="mb-2 block text-sm font-medium">Report version</div>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setReportVersion("lite")}
                className={`rounded-lg border px-3 py-3 text-left text-sm transition ${
                  reportVersion === "lite"
                    ? "border-sky-500 bg-sky-50 text-sky-900"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                <div className="font-medium">Snapshot</div>
                <div className="mt-1 text-xs">
                  Core alignment and operating styles at a glance.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setReportVersion("full")}
                className={`rounded-lg border px-3 py-3 text-left text-sm transition ${
                  reportVersion === "full"
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                <div className="font-medium">Full report</div>
                <div className="mt-1 text-xs opacity-80">
                  Full readiness, confidence and flag detail.
                </div>
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={showResults}
              onChange={(e) => setShowResults(e.target.checked)}
            />
            <span>Show results to the candidate after completion</span>
          </label>

          {showResults ? (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">
                Next steps URL <span className="text-red-600">*</span>
              </span>
              <input
                type="url"
                className="w-full rounded border border-gray-300 p-2 text-sm"
                placeholder="https://your-site.com/book-a-call"
                value={nextStepsUrl}
                onChange={(e) => setNextStepsUrl(e.target.value)}
                required
              />
            </label>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Usage limit</span>
              <select
                className="w-full rounded border border-gray-300 p-2 text-sm"
                value={usageLimitType}
                onChange={(e) =>
                  setUsageLimitType(e.target.value as "unlimited" | "limited")
                }
              >
                <option value="unlimited">Unlimited</option>
                <option value="limited">Limited</option>
              </select>
            </label>

            {usageLimitType === "limited" ? (
              <label className="block text-sm">
                <span className="mb-1 block font-medium">
                  Maximum completions
                </span>
                <input
                  type="number"
                  min={1}
                  className="w-full rounded border border-gray-300 p-2 text-sm"
                  value={usageLimitCount}
                  onChange={(e) => setUsageLimitCount(e.target.value)}
                  required
                />
              </label>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create link"}
          </button>
        </form>
      ) : null}

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-3">
          <h2 className="text-base font-semibold">Links</h2>
        </div>

        {loading ? (
          <div className="px-5 py-6 text-sm text-gray-500">Loading…</div>
        ) : links.length === 0 ? (
          <div className="px-5 py-6 text-sm text-gray-500">
            No MCAS links yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-2">Name</th>
                <th className="px-5 py-2">Status</th>
                <th className="px-5 py-2">Report</th>
                <th className="px-5 py-2">Completed</th>
                <th className="px-5 py-2">Link</th>
                {canWrite ? <th className="px-5 py-2" /> : null}
              </tr>
            </thead>

            <tbody>
              {links.map((link) => (
                <tr key={link.id} className="border-t border-gray-100">
                  <td className="px-5 py-3 font-medium">{link.name}</td>
                  <td className="px-5 py-3 capitalize">{link.status}</td>
                  <td className="px-5 py-3 capitalize">{link.reportVersion}</td>
                  <td className="px-5 py-3">
                    {link.completedApplications}
                    {link.usageLimitType === "limited" && link.usageLimitCount
                      ? ` / ${link.usageLimitCount}`
                      : ""}
                  </td>
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      className="text-sky-700 underline"
                      onClick={() =>
                        void navigator.clipboard
                          .writeText(link.reusableUrl)
                          .then(() => setNotice("Link copied."))
                      }
                    >
                      Copy
                    </button>
                  </td>
                  {canWrite ? (
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        className="text-gray-700 underline"
                        onClick={() =>
                          void patchLink(link.id, {
                            status: link.status === "active" ? "paused" : "active",
                          })
                        }
                      >
                        {link.status === "active" ? "Pause" : "Activate"}
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
