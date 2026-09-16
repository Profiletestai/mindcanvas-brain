"use client";

import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type ReconciliationRow = {
  id: string;
  label: string | null;
  periodStart: string;
  periodEnd: string;
  partnerCount: number;
  signupCount: number;
  paidCustomerCount: number;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
};

type Payload = {
  ok: true;
  reconciliations: ReconciliationRow[];
};

type FormState = {
  label: string;
  periodStart: string;
  periodEnd: string;
  notes: string;
};

const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100";

function toLocalDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function startOfCurrentMonth() {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  );
}

function startOfNextMonth() {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    1
  );
}

const EMPTY_FORM: FormState = {
  label: "",
  periodStart: toLocalDateInputValue(
    startOfCurrentMonth()
  ),
  periodEnd: toLocalDateInputValue(
    startOfNextMonth()
  ),
  notes: "",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(
  value: string | null | undefined
) {
  if (!value) return "-";

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "-";
  }

  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function localDateStartIso(value: string) {
  const date = new Date(`${value}T00:00:00`);

  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </div>

      <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
        {value}
      </div>

      {helper ? (
        <div className="mt-2 text-xs leading-5 text-slate-500">
          {helper}
        </div>
      ) : null}
    </div>
  );
}

export default function ReconciliationClient() {
  const [data, setData] =
    useState<Payload | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [creating, setCreating] =
    useState(false);

  const [showCreate, setShowCreate] =
    useState(false);

  const [form, setForm] =
    useState<FormState>(EMPTY_FORM);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/admin/referrals/reconciliations",
        {
          cache: "no-store",
        }
      );

      const json = await response.json();

      if (!response.ok || json?.ok === false) {
        throw new Error(
          json?.error || `HTTP ${response.status}`
        );
      }

      setData(json as Payload);
    } catch (loadError) {
      setData(null);

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load reconciliations."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    const rows = data?.reconciliations ?? [];

    return {
      reconciliations: rows.length,
      signups: rows.reduce(
        (sum, row) => sum + row.signupCount,
        0
      ),
      paidCustomers: rows.reduce(
        (sum, row) => sum + row.paidCustomerCount,
        0
      ),
      partners: rows.reduce(
        (sum, row) => sum + row.partnerCount,
        0
      ),
    };
  }, [data]);

  function updateForm<K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function flash(message: string) {
    setSuccess(message);

    window.setTimeout(() => {
      setSuccess("");
    }, 3500);
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setError("");
    setShowCreate(true);
  }

  async function createReconciliation(
    event: FormEvent
  ) {
    event.preventDefault();

    const periodStart =
      localDateStartIso(form.periodStart);

    const periodEnd =
      localDateStartIso(form.periodEnd);

    if (!periodStart || !periodEnd) {
      setError(
        "Choose a valid start and end date."
      );
      return;
    }

    setCreating(true);
    setError("");

    try {
      const response = await fetch(
        "/api/admin/referrals/reconciliations",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            label: form.label,
            period_start: periodStart,
            period_end: periodEnd,
            notes: form.notes,
          }),
        }
      );

      const json = await response.json();

      if (!response.ok || json?.ok === false) {
        throw new Error(
          json?.error ||
            "Could not create reconciliation."
        );
      }

      setShowCreate(false);
      setForm(EMPTY_FORM);

      await load();

      flash(
        "Reconciliation snapshot created."
      );
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Could not create reconciliation."
      );
    } finally {
      setCreating(false);
    }
  }

  const reconciliations =
    data?.reconciliations ?? [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6 px-6 py-10">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href="/admin/referrals"
              className="text-sm font-medium text-sky-700 transition hover:text-sky-900"
            >
              ← Referral Tracking
            </Link>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Referral Reconciliation
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Create immutable period snapshots for manual
              referral reconciliation against Stripe. Historical
              snapshots do not change when live billing changes later.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700"
          >
            + Create reconciliation
          </button>
        </header>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Saved reconciliations"
            value={totals.reconciliations}
            helper="Immutable snapshots"
          />

          <StatCard
            label="Snapshot sign-ups"
            value={totals.signups}
            helper="Across saved periods"
          />

          <StatCard
            label="Snapshot paid customers"
            value={totals.paidCustomers}
            helper="Paid at time of snapshot"
          />

          <StatCard
            label="Partner records"
            value={totals.partners}
            helper="Period partner counts"
          />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-5">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Audit history
            </div>

            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              Saved reconciliation snapshots
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Partner Summary is the high-level commercial view.
              Conversion Detail contains the customer-level Stripe
              identifiers used for manual matching.
            </p>
          </div>

          {loading && !data ? (
            <div className="px-6 py-10 text-center text-sm text-slate-500">
              Loading reconciliations...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1050px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  <tr>
                    <th className="px-5 py-3">
                      Reconciliation
                    </th>
                    <th className="px-5 py-3">
                      Period
                    </th>
                    <th className="px-5 py-3 text-right">
                      Partners
                    </th>
                    <th className="px-5 py-3 text-right">
                      Sign-ups
                    </th>
                    <th className="px-5 py-3 text-right">
                      Paid
                    </th>
                    <th className="px-5 py-3">
                      Created
                    </th>
                    <th className="px-5 py-3">
                      Exports
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {reconciliations.map((row) => (
                    <tr
                      key={row.id}
                      className="align-top"
                    >
                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-900">
                          {row.label ||
                            "Referral reconciliation"}
                        </div>

                        <div className="mt-1 font-mono text-[11px] text-slate-400">
                          {row.id}
                        </div>

                        {row.notes ? (
                          <div className="mt-2 max-w-xs text-xs leading-5 text-slate-500">
                            {row.notes}
                          </div>
                        ) : null}
                      </td>

                      <td className="px-5 py-4 text-slate-700">
                        <div>
                          {formatDate(row.periodStart)}
                          {" → "}
                          {formatDate(row.periodEnd)}
                        </div>

                        <div className="mt-1 text-xs text-slate-400">
                          End date is exclusive
                        </div>
                      </td>

                      <td className="px-5 py-4 text-right font-medium text-slate-800">
                        {row.partnerCount}
                      </td>

                      <td className="px-5 py-4 text-right font-medium text-slate-800">
                        {row.signupCount}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                          {row.paidCustomerCount}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {formatDateTime(row.createdAt)}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <a
                            href={`/api/admin/referrals/reconciliations/${row.id}/export?type=partner_summary`}
                            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                          >
                            Partner Summary CSV
                          </a>

                          <a
                            href={`/api/admin/referrals/reconciliations/${row.id}/export?type=conversion_detail`}
                            className="inline-flex items-center justify-center rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 transition hover:bg-sky-100"
                          >
                            Conversion Detail CSV
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {reconciliations.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-5 py-10 text-center text-sm text-slate-500"
                      >
                        No reconciliation snapshots yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {showCreate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  Create reconciliation
                </h2>

                <p className="mt-1 text-sm leading-6 text-slate-500">
                  This permanently snapshots the referral and billing
                  state for the selected period.
                </p>
              </div>

              <button
                type="button"
                disabled={creating}
                onClick={() =>
                  setShowCreate(false)
                }
                className="text-2xl leading-none text-slate-400 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={createReconciliation}
              className="space-y-5 p-6"
            >
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Reconciliation label
                </label>

                <input
                  placeholder="e.g. September 2026 referral reconciliation"
                  value={form.label}
                  onChange={(event) =>
                    updateForm(
                      "label",
                      event.target.value
                    )
                  }
                  className={inputClass}
                />

                <p className="mt-2 text-xs text-slate-400">
                  Optional. A date-based label will be generated if
                  you leave this blank.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Period start
                  </label>

                  <input
                    required
                    type="date"
                    value={form.periodStart}
                    onChange={(event) =>
                      updateForm(
                        "periodStart",
                        event.target.value
                      )
                    }
                    className={inputClass}
                  />

                  <p className="mt-2 text-xs text-slate-400">
                    Inclusive
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Period end
                  </label>

                  <input
                    required
                    type="date"
                    value={form.periodEnd}
                    onChange={(event) =>
                      updateForm(
                        "periodEnd",
                        event.target.value
                      )
                    }
                    className={inputClass}
                  />

                  <p className="mt-2 text-xs text-slate-400">
                    Exclusive. For September, choose 1 October.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs leading-5 text-sky-800">
                Example: 1 September → 1 October captures all
                September sign-ups without overlapping the October
                reconciliation.
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Internal notes
                </label>

                <textarea
                  rows={4}
                  placeholder="Optional notes about this reconciliation..."
                  value={form.notes}
                  onChange={(event) =>
                    updateForm(
                      "notes",
                      event.target.value
                    )
                  }
                  className={inputClass}
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  disabled={creating}
                  onClick={() =>
                    setShowCreate(false)
                  }
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  {creating
                    ? "Creating snapshot..."
                    : "Create reconciliation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
