// apps/web/app/portal/[slug]/links/CreatedTestLinksTable.tsx
// Redesigned "Created test links" table (per Figma). Reads the same
// /api/admin/links data as the create form and refreshes when a link is
// created or deleted (via the "links:changed" window event).
"use client";

import { useCallback, useEffect, useState } from "react";
import { getBaseUrl } from "@/lib/baseUrl";
import CreateTestLinkButton from "@/components/portal/CreateTestLinkButton";
import EditTestLinkModal from "@/components/portal/EditTestLinkModal";
import type { ModelOption } from "@/components/portal/CreateTestLinkModal";
import type { ReportVariant } from "@/components/portal/create-test-link/types";

type LinkRow = {
  id: string;
  token: string;
  created_at: string | null;
  show_results: boolean | null;
  is_active: boolean | null;
  link_name: string | null;
  test_name: string;
  test_id: string | null;
  use_count: number;
  max_uses: number | null;
  expires_at: string | null;

  contact_owner: string | null;
  email_report: boolean;

  next_steps_url: string | null;
  redirect_url: string | null;
  hidden_results_message: string | null;

  report_variant?: ReportVariant | null;
  report_paywall_enabled?: boolean;
  report_price_cents?: number | null;
  report_currency?: "GBP" | "USD" | "EUR" | "ZAR";
};

export default function CreatedTestLinksTable({
  orgId,
  orgSlug,
  models,
}: {
  orgId: string;
  orgSlug: string;
  models: ModelOption[];
}) {
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<LinkRow | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const baseUrl = getBaseUrl();
  const fullLink = (token: string) => `${baseUrl}/t/${token}`;

  const refresh = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/links?orgId=${orgId}&t=${Date.now()}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok || (j && j.error))
          throw new Error(j?.error || `HTTP ${r.status}`);
        return j;
      })
      .then((d) => {
        setLinks(Array.isArray(d) ? d : []);
        setError(null);
      })
      .catch((e: any) => {
        setLinks([]);
        setError(e?.message || "Failed to load links");
      })
      .finally(() => setLoading(false));
  }, [orgId]);

  useEffect(() => {
    refresh();
    const onChanged = () => refresh();
    window.addEventListener("links:changed", onChanged);
    return () => window.removeEventListener("links:changed", onChanged);
  }, [refresh]);

  const copy = async (id: string, token: string) => {
    try {
      await navigator.clipboard.writeText(fullLink(token));
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    } catch {
      // ignore
    }
  };

  // Deactivate is the soft delete — the row and its submissions stay, the
  // public URL stops resolving.
  const setActive = async (r: LinkRow, isActive: boolean) => {
    if (
      !isActive &&
      !window.confirm(
        "Deactivate this link? The URL will stop working for anyone who has it.",
      )
    ) {
      return;
    }

    setTogglingId(r.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/links/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, isActive }),
      });
      const data = await res.json().catch(() => ({}) as any);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      refresh();
    } catch (e: any) {
      setError(e?.message || "Failed to update the link");
    } finally {
      setTogglingId(null);
    }
  };

  const experienceLabel = (r: LinkRow) =>
    r.show_results ? "Report shown after" : "Host review first";

  const limitLabel = (r: LinkRow) =>
    r.max_uses != null ? `${r.max_uses} max` : "No limit";

  return (
    <div className="space-y-3">
      {/* Section header — sits outside the table card (per Figma) */}
      <div className="flex items-center justify-between px-1">
        <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#647789]">
          Your test links
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="text-[13px] font-medium text-white/40 transition hover:text-white disabled:opacity-50"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <CreateTestLinkButton
            orgId={orgId}
            orgSlug={orgSlug}
            models={models}
            variant="link"
            label="Create new"
          />
        </div>
      </div>

      {error && links.length > 0 && (
        <p className="px-1 text-[12.5px] text-rose-400">{error}</p>
      )}

      {/* Table card */}
      <div className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#0e2a45] backdrop-blur-[24px]">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/[0.07] text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-[#647789]">
                <th className="px-6 py-4">Name</th>
                <th className="px-5 py-4">Model</th>
                <th className="px-5 py-4">Test taker experience</th>
                <th className="px-5 py-4">Limit</th>
                <th className="px-5 py-4">Submissions</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {links.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-white/[0.05] transition hover:bg-white/[0.025]"
                >
                  {/* Name + url */}
                  <td className="px-6 py-4">
                    <div className="text-[15px] font-semibold text-white">
                      {r.link_name || "Untitled link"}
                    </div>
                    <div className="mt-0.5 text-[12px] text-slate-500">
                      {fullLink(r.token).replace(/^https?:\/\//, "")}
                    </div>
                  </td>

                  {/* Model */}
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center whitespace-nowrap rounded-full border border-[#3d6ea8]/50 px-3.5 py-1.5 text-[13px] font-medium text-[#4a9cff]">
                      {r.test_name}
                    </span>
                  </td>

                  {/* Experience */}
                  <td className="whitespace-nowrap px-5 py-4 text-[14px] text-slate-300">
                    {experienceLabel(r)}
                  </td>

                  {/* Limit */}
                  <td className="whitespace-nowrap px-5 py-4 text-[14px] text-slate-400">
                    {limitLabel(r)}
                  </td>

                  {/* Submissions */}
                  <td className="whitespace-nowrap px-5 py-4 text-[14px] tabular-nums text-white">
                    {r.use_count}
                    {r.max_uses != null ? (
                      <span className="text-slate-500"> / {r.max_uses}</span>
                    ) : null}
                  </td>

                  {/* Status */}
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center whitespace-nowrap rounded-full border px-3 py-1 text-[12px] font-semibold ${
                        r.is_active
                          ? "border-emerald-500/40 bg-emerald-500/[0.08] text-emerald-400"
                          : "border-amber-500/40 bg-amber-500/[0.08] text-amber-400"
                      }`}
                    >
                      {r.is_active ? "Live" : "Inactive"}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => copy(r.id, r.token)}
                        className="inline-flex h-[30px] items-center whitespace-nowrap rounded-md border border-white/[0.12] bg-white/[0.05] px-3.5 text-[12px] font-medium text-slate-200 transition hover:bg-white/10"
                      >
                        {copiedId === r.id ? "Copied!" : "Copy link"}
                      </button>
                      <a
                        href={fullLink(r.token)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-[30px] items-center whitespace-nowrap rounded-md border border-white/[0.12] bg-white/[0.05] px-3.5 text-[12px] font-medium text-slate-200 transition hover:bg-white/10"
                      >
                        Open
                      </a>
                      <button
                        type="button"
                        onClick={() => setEditing(r)}
                        className="inline-flex h-[30px] items-center whitespace-nowrap rounded-md border border-white/[0.12] bg-white/[0.05] px-3.5 text-[12px] font-medium text-slate-200 transition hover:bg-white/10"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={togglingId === r.id}
                        onClick={() => setActive(r, !r.is_active)}
                        className={`inline-flex h-[30px] items-center whitespace-nowrap rounded-md border px-3.5 text-[12px] font-medium transition disabled:opacity-50 ${
                          r.is_active
                            ? "border-amber-500/40 bg-amber-500/[0.08] text-amber-300 hover:bg-amber-500/15"
                            : "border-emerald-500/40 bg-emerald-500/[0.08] text-emerald-300 hover:bg-emerald-500/15"
                        }`}
                      >
                        {togglingId === r.id
                          ? "Saving…"
                          : r.is_active
                            ? "Deactivate"
                            : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {links.length === 0 && (
                <tr>
                  <td
                    className="px-6 py-10 text-center text-slate-500"
                    colSpan={7}
                  >
                    {loading
                      ? "Loading…"
                      : error
                        ? error
                        : "No test links yet. Create one with the button above."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <EditTestLinkModal
          orgId={orgId}
          orgSlug={orgSlug}
          link={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
