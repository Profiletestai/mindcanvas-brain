"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

import PortalPageHeader from "@/components/portal/PortalPageHeader";

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

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function statusClasses(status: string): string {
  if (status === "active") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  }

  if (status === "paused") {
    return "border-amber-400/30 bg-amber-400/10 text-amber-100";
  }

  return "border-white/15 bg-white/[0.06] text-white/65";
}

export default function McasLinksClient({
  orgSlug,
  canWrite,
}: Props) {
  const [links, setLinks] = useState<McasLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [contactOwnerName, setContactOwnerName] =
    useState("");
  const [reportVersion, setReportVersion] =
    useState<"lite" | "full">("full");
  const [showResults, setShowResults] =
    useState(false);
  const [nextStepsUrl, setNextStepsUrl] =
    useState("");
  const [usageLimitType, setUsageLimitType] =
    useState<"unlimited" | "limited">(
      "unlimited"
    );
  const [usageLimitCount, setUsageLimitCount] =
    useState("");
  const [saving, setSaving] = useState(false);
  const [updatingLinkId, setUpdatingLinkId] =
    useState<string | null>(null);

  const base =
    `/api/portal/${encodeURIComponent(orgSlug)}/mcas/links`;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(base, {
        cache: "no-store",
      });

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok || !data?.ok) {
        throw new Error(
          data?.error || `HTTP ${response.status}`
        );
      }

      setLinks(data.links as McasLink[]);
    } catch (caught) {
      setLinks([]);
      setError(
        caught instanceof Error
          ? caught.message
          : String(caught)
      );
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function resetForm() {
    setName("");
    setContactOwnerName("");
    setReportVersion("full");
    setShowResults(false);
    setNextStepsUrl("");
    setUsageLimitType("unlimited");
    setUsageLimitCount("");
  }

  function closeCreateModal() {
    if (saving) return;

    setCreateOpen(false);
    setError(null);
    resetForm();
  }

  async function createLink(event: FormEvent) {
    event.preventDefault();

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(base, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          contactOwnerName:
            contactOwnerName.trim() || null,
          reportVersion,
          showResults,
          nextStepsUrl:
            nextStepsUrl.trim() || null,
          usageLimitType,
          usageLimitCount:
            usageLimitType === "limited"
              ? Number.parseInt(
                  usageLimitCount,
                  10
                ) || null
              : null,
        }),
      });

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok || !data?.ok) {
        throw new Error(
          data?.error || `HTTP ${response.status}`
        );
      }

      setNotice("MCAS test link created.");
      setCreateOpen(false);
      resetForm();

      await refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : String(caught)
      );
    } finally {
      setSaving(false);
    }
  }

  async function patchLink(
    linkId: string,
    patch: Record<string, unknown>
  ) {
    setUpdatingLinkId(linkId);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(
        `${base}/${encodeURIComponent(linkId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(patch),
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok || !data?.ok) {
        throw new Error(
          data?.error || `HTTP ${response.status}`
        );
      }

      await refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : String(caught)
      );
    } finally {
      setUpdatingLinkId(null);
    }
  }

  async function copyLink(url: string) {
    setError(null);
    setNotice(null);

    try {
      await navigator.clipboard.writeText(url);
      setNotice("MCAS test link copied.");
    } catch {
      setError(
        "Unable to copy the link. Please open it and copy it from the browser."
      );
    }
  }

  return (
    <div className="space-y-6 text-slate-100">
      <PortalPageHeader
        title="MCAS test links"
        subtitle="Create assessment links, share them with candidates, and manage active recruitment campaigns."
        actions={
          canWrite ? (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setNotice(null);
                setCreateOpen(true);
              }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#2d8fc4] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#2d8fc4]/20 transition hover:bg-[#247baa]"
            >
              <span aria-hidden="true">＋</span>
              Create MCAS link
            </button>
          ) : null
        }
      />

      {error ? (
        <div className="rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          {notice}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] backdrop-blur">
        <div className="border-b border-white/10 px-6 py-5">
          <h2 className="text-base font-semibold text-white">
            Created MCAS links
          </h2>

          <p className="mt-1 text-sm text-white/55">
            Review candidate activity, copy assessment
            links, or pause campaigns that are no
            longer accepting submissions.
          </p>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-white/55">
            Loading MCAS links…
          </div>
        ) : links.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#64bae2]/25 bg-[#64bae2]/10 text-xl text-[#64bae2]">
              ⛓
            </div>

            <h3 className="mt-4 text-base font-semibold text-white">
              No MCAS links yet
            </h3>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/55">
              Create a dedicated assessment link for
              your next role or candidate intake.
            </p>

            {canWrite ? (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#2d8fc4] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#247baa]"
              >
                Create your first MCAS link
              </button>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-white/40">
                  <th className="px-6 py-4 font-medium">
                    Link
                  </th>

                  <th className="px-4 py-4 font-medium">
                    Status
                  </th>

                  <th className="px-4 py-4 font-medium">
                    Report
                  </th>

                  <th className="px-4 py-4 font-medium">
                    Candidates
                  </th>

                  <th className="px-4 py-4 font-medium">
                    Created
                  </th>

                  <th className="px-6 py-4 text-right font-medium">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {links.map((link) => {
                  const updating =
                    updatingLinkId === link.id;

                  return (
                    <tr
                      key={link.id}
                      className="border-b border-white/10 last:border-b-0"
                    >
                      <td className="px-6 py-5">
                        <p className="font-medium text-white">
                          {link.name}
                        </p>

                        <p className="mt-1 max-w-[280px] truncate text-xs text-white/40">
                          {link.reusableUrl}
                        </p>
                      </td>

                      <td className="px-4 py-5">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${statusClasses(
                            link.status
                          )}`}
                        >
                          {link.status}
                        </span>
                      </td>

                      <td className="px-4 py-5 capitalize text-white/70">
                        {link.reportVersion === "lite"
                          ? "Snapshot"
                          : "Full report"}
                      </td>

                      <td className="px-4 py-5">
                        <p className="font-medium text-white">
                          {
                            link.completedApplications
                          }{" "}
                          completed
                        </p>

                        <p className="mt-1 text-xs text-white/40">
                          {link.openApplications} open
                          {link.usageLimitType ===
                            "limited" &&
                          link.usageLimitCount
                            ? ` · Limit ${link.usageLimitCount}`
                            : " · No link limit"}
                        </p>
                      </td>

                      <td className="px-4 py-5 text-white/60">
                        {formatDate(link.createdAt)}
                      </td>

                      <td className="px-6 py-5">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              void copyLink(
                                link.reusableUrl
                              )
                            }
                            className="text-sm font-medium text-[#64bae2] transition hover:text-white"
                          >
                            Copy link
                          </button>

                          <a
                            href={link.reusableUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-medium text-[#64bae2] transition hover:text-white"
                          >
                            Open
                          </a>

                          {canWrite ? (
                            <button
                              type="button"
                              disabled={updating}
                              onClick={() =>
                                void patchLink(
                                  link.id,
                                  {
                                    status:
                                      link.status ===
                                      "active"
                                        ? "paused"
                                        : "active",
                                  }
                                )
                              }
                              className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/75 transition hover:border-white/25 hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {updating
                                ? "Updating…"
                                : link.status ===
                                    "active"
                                  ? "Pause"
                                  : "Activate"}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {createOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#020914]/85 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-mcas-link-title"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              closeCreateModal();
            }
          }}
        >
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-[#64bae2]/25 bg-[#071c2d] shadow-2xl shadow-black/50">
            <form onSubmit={createLink}>
              <div className="flex items-start justify-between border-b border-white/10 px-6 py-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#64bae2]">
                    New assessment campaign
                  </p>

                  <h2
                    id="create-mcas-link-title"
                    className="mt-2 text-xl font-semibold text-white"
                  >
                    Create an MCAS link
                  </h2>

                  <p className="mt-1 text-sm text-white/55">
                    Configure the candidate experience
                    and link usage.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={saving}
                  aria-label="Close"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-xl text-white/60 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
                >
                  ×
                </button>
              </div>

              <div className="space-y-6 px-6 py-6">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-white">
                    Test name or purpose{" "}
                    <span className="text-red-300">
                      *
                    </span>
                  </span>

                  <input
                    className="min-h-11 w-full rounded-xl border border-white/15 bg-[#06182a] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#64bae2] focus:ring-2 focus:ring-[#64bae2]/15"
                    placeholder="e.g. Sales Representative — Q3 intake"
                    value={name}
                    onChange={(event) =>
                      setName(event.target.value)
                    }
                    required
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-white">
                    Contact owner
                  </span>

                  <input
                    className="min-h-11 w-full rounded-xl border border-white/15 bg-[#06182a] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#64bae2] focus:ring-2 focus:ring-[#64bae2]/15"
                    placeholder="Who owns this hiring process?"
                    value={contactOwnerName}
                    onChange={(event) =>
                      setContactOwnerName(
                        event.target.value
                      )
                    }
                  />
                </label>

                <fieldset>
                  <legend className="mb-3 text-sm font-medium text-white">
                    Report version
                  </legend>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() =>
                        setReportVersion("lite")
                      }
                      className={`rounded-2xl border p-4 text-left transition ${
                        reportVersion === "lite"
                          ? "border-[#64bae2] bg-[#64bae2]/10"
                          : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
                      }`}
                    >
                      <span className="font-medium text-white">
                        Snapshot
                      </span>

                      <span className="mt-1 block text-xs leading-5 text-white/50">
                        Core alignment and operating
                        styles at a glance.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setReportVersion("full")
                      }
                      className={`rounded-2xl border p-4 text-left transition ${
                        reportVersion === "full"
                          ? "border-[#64bae2] bg-[#64bae2]/10"
                          : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
                      }`}
                    >
                      <span className="font-medium text-white">
                        Full report
                      </span>

                      <span className="mt-1 block text-xs leading-5 text-white/50">
                        Full readiness, confidence and
                        flag detail.
                      </span>
                    </button>
                  </div>
                </fieldset>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={showResults}
                      onChange={(event) =>
                        setShowResults(
                          event.target.checked
                        )
                      }
                      className="mt-0.5 h-4 w-4 rounded border-white/25 bg-[#06182a] text-[#2d8fc4] focus:ring-[#64bae2]"
                    />

                    <span>
                      <span className="block text-sm font-medium text-white">
                        Show results to the candidate
                      </span>

                      <span className="mt-1 block text-xs leading-5 text-white/45">
                        Display the candidate-facing
                        result immediately after
                        completion.
                      </span>
                    </span>
                  </label>
                </div>

                {showResults ? (
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-white">
                      Next steps URL{" "}
                      <span className="text-red-300">
                        *
                      </span>
                    </span>

                    <input
                      type="url"
                      className="min-h-11 w-full rounded-xl border border-white/15 bg-[#06182a] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#64bae2] focus:ring-2 focus:ring-[#64bae2]/15"
                      placeholder="https://your-site.com/book-a-call"
                      value={nextStepsUrl}
                      onChange={(event) =>
                        setNextStepsUrl(
                          event.target.value
                        )
                      }
                      required
                    />
                  </label>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-white">
                      Link usage limit
                    </span>

                    <select
                      className="min-h-11 w-full rounded-xl border border-white/15 bg-[#06182a] px-4 py-3 text-sm text-white outline-none transition focus:border-[#64bae2] focus:ring-2 focus:ring-[#64bae2]/15"
                      value={usageLimitType}
                      onChange={(event) =>
                        setUsageLimitType(
                          event.target.value as
                            | "unlimited"
                            | "limited"
                        )
                      }
                    >
                      <option value="unlimited">
                        Unlimited
                      </option>

                      <option value="limited">
                        Limited
                      </option>
                    </select>
                  </label>

                  {usageLimitType === "limited" ? (
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-white">
                        Maximum completions
                      </span>

                      <input
                        type="number"
                        min={1}
                        className="min-h-11 w-full rounded-xl border border-white/15 bg-[#06182a] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#64bae2] focus:ring-2 focus:ring-[#64bae2]/15"
                        value={usageLimitCount}
                        onChange={(event) =>
                          setUsageLimitCount(
                            event.target.value
                          )
                        }
                        required
                      />
                    </label>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-white/10 px-6 py-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={saving}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#2d8fc4] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#247baa] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? "Creating link…"
                    : "Create MCAS link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
