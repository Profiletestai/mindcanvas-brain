"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  listSubAccounts,
  updateSubAccount,
  humanError,
  isErr,
  type Action,
  type SubAccountItem,
} from "./_lib/api";

type Tab = "all" | "active" | "suspended" | "archived";

const TAB_FILTER: Record<Tab, string[] | null> = {
  all: null,
  active: ["active", "pending_activation"],
  suspended: ["suspended"],
  archived: ["archived"],
};

const TAB_LABEL: Record<Tab, string> = {
  all: "All",
  active: "Active",
  suspended: "Suspended",
  archived: "Archived",
};

function statusPillClass(status: string | null): string {
  switch (status) {
    case "active":
      return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
    case "pending_activation":
      return "bg-sky-500/20 text-sky-300 border-sky-500/30";
    case "suspended":
      return "bg-amber-500/20 text-amber-300 border-amber-500/30";
    case "archived":
      return "bg-white/10 text-white/60 border-white/15";
    default:
      return "bg-white/10 text-white/60 border-white/15";
  }
}

function statusLabel(status: string | null): string {
  switch (status) {
    case "active":
      return "Active";
    case "pending_activation":
      return "Pending";
    case "suspended":
      return "Suspended";
    case "archived":
      return "Archived";
    default:
      return status || "—";
  }
}

function payerLabel(mode: SubAccountItem["payer_mode"]): string {
  if (mode === "parent_paid") return "Parent pays";
  if (mode === "self_paid") return "Self-pays";
  return "—";
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

function rowActions(status: string | null): Action[] {
  if (status === "active" || status === "pending_activation")
    return ["suspend", "archive"];
  if (status === "suspended") return ["reactivate", "archive"];
  return [];
}

export default function SubAccountsClient({
  orgSlug,
  parentOrgId,
}: {
  orgSlug: string;
  parentOrgId: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const tab = ((sp?.get("tab") as Tab) || "all") as Tab;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [items, setItems] = useState<SubAccountItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr("");
    const res = await listSubAccounts(parentOrgId);
    if (isErr(res)) {
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      setErr(humanError(res.error));
      setLoading(false);
      return;
    }
    setItems(res.items);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentOrgId]);

  async function act(childOrgId: string, action: Action) {
    setBusyId(childOrgId);
    setErr("");
    const res = await updateSubAccount(childOrgId, action);
    if (isErr(res)) {
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      setErr(humanError(res.error, action));
      setBusyId(null);
      if (res.error === "child_not_found") void load();
      return;
    }
    setBusyId(null);
    setConfirmArchive(null);
    await load();
  }

  const counts = useMemo(
    () => ({
      all: items.length,
      active: items.filter(
        (i) =>
          i.org_status === "active" || i.org_status === "pending_activation",
      ).length,
      suspended: items.filter((i) => i.org_status === "suspended").length,
      archived: items.filter((i) => i.org_status === "archived").length,
    }),
    [items],
  );

  const filtered = useMemo(() => {
    const f = TAB_FILTER[tab];
    return f ? items.filter((i) => i.org_status && f.includes(i.org_status)) : items;
  }, [items, tab]);

  function setTab(next: Tab) {
    const params = new URLSearchParams(sp?.toString() ?? "");
    if (next === "all") params.delete("tab");
    else params.set("tab", next);
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }

  const createHref = `/portal/sub-accounts/new/organisation?parentOrgId=${encodeURIComponent(
    parentOrgId,
  )}&parentOrgSlug=${encodeURIComponent(orgSlug)}`;

  return (
    <div className="mx-auto max-w-[1200px]">
      <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Sub-accounts</h1>
            <p className="mt-1 text-sm text-white/70">
              Manage licensee organisations under your account.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href={createHref}
              className="inline-flex items-center justify-center h-10 px-4 rounded-xl font-semibold text-white"
              style={{
                background:
                  "linear-gradient(180deg, rgb(6,94,144) 0%, rgb(42,137,190) 100%)",
                boxShadow: "0px 4px 16px 0px rgba(37,99,200,0.35)",
              }}
            >
              + Create sub-account
            </Link>
          </div>
        </div>
      </section>

      <div className="mt-4 flex gap-2 flex-wrap">
        {(Object.keys(TAB_LABEL) as Tab[]).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`text-sm rounded-xl px-3 py-1.5 border transition ${
                active
                  ? "bg-white/[0.12] border-white/25 text-white"
                  : "bg-white/[0.04] border-white/10 text-white/70 hover:bg-white/[0.08]"
              }`}
            >
              {TAB_LABEL[t]}{" "}
              <span className="text-white/50">({counts[t]})</span>
            </button>
          );
        })}
      </div>

      {err && (
        <div className="mt-4 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 flex items-center justify-between gap-3">
          <span>{err}</span>
          <button
            type="button"
            onClick={() => setErr("")}
            className="text-rose-200/80 hover:text-rose-200 text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <section className="mt-4 rounded-3xl border border-white/10 bg-white/[0.06] backdrop-blur shadow-[0_0_0_1px_rgba(255,255,255,0.04)] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-white/70 text-sm">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-white/80">No sub-accounts yet.</p>
            <p className="mt-1 text-sm text-white/60">
              Create the first licensee organisation under your account.
            </p>
            <Link
              href={createHref}
              className="mt-5 inline-flex items-center justify-center h-10 px-4 rounded-xl font-semibold text-white"
              style={{
                background:
                  "linear-gradient(180deg, rgb(6,94,144) 0%, rgb(42,137,190) 100%)",
                boxShadow: "0px 4px 16px 0px rgba(37,99,200,0.35)",
              }}
            >
              + Create sub-account
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-white/70 text-sm">
            No {TAB_LABEL[tab].toLowerCase()} sub-accounts.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-white/60">
                <tr className="border-b border-white/10">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Payer</th>
                  <th className="px-5 py-3 font-medium">Owner</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const actions = rowActions(row.org_status);
                  const busy = busyId === row.child_org_id;
                  const ownerName =
                    [row.owner_first_name, row.owner_last_name]
                      .filter(Boolean)
                      .join(" ") || "—";
                  return (
                    <tr
                      key={row.child_org_id}
                      className="border-b border-white/5 last:border-b-0"
                    >
                      <td className="px-5 py-3 max-w-[260px]">
                        <div
                          className="truncate font-medium text-white"
                          title={row.name ?? ""}
                        >
                          {row.name || "—"}
                        </div>
                        {row.slug && (
                          <div
                            className="truncate text-xs text-white/50"
                            title={row.slug}
                          >
                            {row.slug}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs ${statusPillClass(
                            row.org_status,
                          )}`}
                        >
                          {statusLabel(row.org_status)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-white/80">
                        {payerLabel(row.payer_mode)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="text-white/90">{ownerName}</div>
                        {row.owner_email && (
                          <div className="text-xs text-white/50">
                            {row.owner_email}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-white/70 whitespace-nowrap">
                        {fmtDate(row.created_at)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {actions.length === 0 ? (
                          <span className="text-white/40">—</span>
                        ) : confirmArchive === row.child_org_id ? (
                          <div className="inline-flex items-center gap-2">
                            <span className="text-xs text-white/70">
                              Archive {row.name || "this sub-account"}? This
                              cannot be undone.
                            </span>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setConfirmArchive(null)}
                              className="text-xs rounded-lg px-2.5 py-1 border border-white/15 bg-white/[0.06] hover:bg-white/[0.1]"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => act(row.child_org_id, "archive")}
                              className="text-xs rounded-lg px-2.5 py-1 border border-rose-500/40 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30 disabled:opacity-50"
                            >
                              {busy ? "Archiving…" : "Archive"}
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2">
                            {actions.includes("suspend") && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  act(row.child_org_id, "suspend")
                                }
                                className="text-xs rounded-lg px-2.5 py-1 border border-white/15 bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-50"
                              >
                                {busy ? "…" : "Suspend"}
                              </button>
                            )}
                            {actions.includes("reactivate") && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  act(row.child_org_id, "reactivate")
                                }
                                className="text-xs rounded-lg px-2.5 py-1 border border-emerald-500/40 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-50"
                              >
                                {busy ? "…" : "Reactivate"}
                              </button>
                            )}
                            {actions.includes("archive") && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  setConfirmArchive(row.child_org_id)
                                }
                                className="text-xs rounded-lg px-2.5 py-1 border border-white/15 bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-50"
                              >
                                Archive
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
