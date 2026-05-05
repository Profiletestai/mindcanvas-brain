// apps/web/app/portal/[slug]/links/LinksClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { getBaseUrl } from "@/lib/baseUrl";

type Test = {
  id: string;
  name: string;
  test_type?: string | null;
  is_active?: boolean | null;
};

type ReportVariant = "lite" | "full";

type LinkRow = {
  id: string;
  token: string;
  created_at: string | null;
  show_results: boolean | null;
  is_active: boolean | null;
  expires_at: string | null;

  test_id: string | null;
  test_name: string;
  link_name: string | null;

  contact_owner: string | null;
  email_report: boolean;

  redirect_url: string | null;
  next_steps_url: string | null;

  use_count: number;
  max_uses: number | null;

  report_variant?: ReportVariant | null;
};

export default function LinksClient(props: {
  orgId: string;
  orgSlug: string;
  orgName: string;
}) {
  const { orgId, orgSlug, orgName } = props;

  const [tests, setTests] = useState<Test[]>([]);
  const [links, setLinks] = useState<LinkRow[]>([]);

  const [testId, setTestId] = useState("");
  const [testDisplayName, setTestDisplayName] = useState("");
  const [contactOwner, setContactOwner] = useState("");
  const [showResults, setShowResults] = useState(true);
  const [emailReport, setEmailReport] = useState(true);

  const [recipientEmail, setRecipientEmail] = useState("");
  const [sendEmail, setSendEmail] = useState(false);

  const [redirectUrl, setRedirectUrl] = useState("");
  const [hiddenResultsMessage, setHiddenResultsMessage] = useState("");
  const [nextStepsUrl, setNextStepsUrl] = useState("");

  const [reportVariant, setReportVariant] = useState<ReportVariant>("full");

  const [usageLimitMode, setUsageLimitMode] = useState<"unlimited" | "limited">(
    "unlimited"
  );
  const [maxUses, setMaxUses] = useState<string>("");

  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingLinks, setLoadingLinks] = useState(false);

  const baseUrl = getBaseUrl();

  const fetchJSON = async (url: string) => {
    const r = await fetch(`${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`);
    const j = await r.json();
    if (!r.ok || (j && j.error)) throw new Error(j?.error || `HTTP ${r.status}`);
    return j;
  };

  useEffect(() => {
    fetchJSON(`/api/admin/tests?orgId=${orgId}`)
      .then((d) => setTests(Array.isArray(d) ? d : []))
      .catch((e: any) => {
        setTests([]);
        setStatus(`Tests load error: ${e.message}`);
        console.error("tests error", e);
      });
  }, [orgId]);

  const refreshLinks = () => {
    setLoadingLinks(true);
    fetchJSON(`/api/admin/links?orgId=${orgId}`)
      .then((d) => setLinks(Array.isArray(d) ? d : []))
      .catch((e: any) => {
        setLinks([]);
        setStatus(`Links load error: ${e.message}`);
        console.error("links error", e);
      })
      .finally(() => setLoadingLinks(false));
  };

  useEffect(refreshLinks, [orgId]);

  const selectedTest = useMemo(
    () => tests.find((t) => t.id === testId) || null,
    [tests, testId]
  );

  const supportsLiteReport = useMemo(() => {
    const slugOk = orgSlug === "whatswhats-global";
    const testOk = /visibility ladder/i.test(selectedTest?.name || "");
    return slugOk && testOk;
  }, [orgSlug, selectedTest]);

  useEffect(() => {
    if (!supportsLiteReport && reportVariant === "lite") {
      setReportVariant("full");
    }
  }, [supportsLiteReport, reportVariant]);

  const fullLink = (token: string) => `${baseUrl}/t/${token}`;
  const embedLink = (token: string) => `${baseUrl}/t/${token}/embed`;

  const embedCode = (token: string) =>
    `<iframe src="${embedLink(
      token
    )}" style="width:100%;height:900px;border:0;border-radius:16px;overflow:hidden;" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;

  const htmlButton = (url: string) =>
    `<a href="${url}" style="background:#111;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;text-align:center;display:inline-block;">Start your test</a>`;

  const doCopy = async (text: string, label?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(label || "Copied!");
      setTimeout(() => setStatus(null), 2000);
    } catch {
      setStatus("Copy failed");
    }
  };

  const downloadTxt = (content: string, filename: string) => {
    try {
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setStatus("Download failed");
      setTimeout(() => setStatus(null), 2000);
    }
  };

  const isValidUrl = (value: string) => {
    const v = value.trim();
    if (!v) return false;
    try {
      new URL(v);
      return true;
    } catch {
      return false;
    }
  };

  const resetForm = () => {
    setTestId("");
    setTestDisplayName("");
    setContactOwner("");
    setShowResults(true);
    setEmailReport(true);
    setRecipientEmail("");
    setSendEmail(false);
    setRedirectUrl("");
    setHiddenResultsMessage("");
    setNextStepsUrl("");
    setReportVariant("full");
    setUsageLimitMode("unlimited");
    setMaxUses("");
  };

  const generate = async () => {
    setLoading(true);
    setStatus(null);

    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidRe.test(testId)) {
      setStatus("Please select a valid test (missing ID). Try reselecting.");
      setLoading(false);
      return;
    }

    if (!isValidUrl(nextStepsUrl)) {
      setStatus("Next steps URL is required.");
      setLoading(false);
      return;
    }

    if (!showResults && !isValidUrl(redirectUrl)) {
      setStatus("Redirect URL is required when results are hidden.");
      setLoading(false);
      return;
    }

    let parsedMaxUses: number | null = null;
    if (usageLimitMode === "limited") {
      const n = parseInt(maxUses, 10);
      if (!Number.isInteger(n) || n < 1) {
        setStatus("Usage limit must be a whole number of 1 or more.");
        setLoading(false);
        return;
      }
      parsedMaxUses = n;
    }

    try {
      const messageToSave =
        !showResults && hiddenResultsMessage.trim().length > 0
          ? hiddenResultsMessage.trim()
          : null;

      const finalReportVariant: ReportVariant = supportsLiteReport ? reportVariant : "full";

      const res = await fetch("/api/admin/create-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          testId,
          testDisplayName,
          contactOwner,
          showResults,
          emailReport,
          hiddenResultsMessage: messageToSave,
          redirectUrl: !showResults ? redirectUrl.trim() : null,
          nextStepsUrl: nextStepsUrl.trim(),
          report_variant: finalReportVariant,
          max_uses: parsedMaxUses,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      let message = "Link created!";
      const token: string | undefined = data?.token;

      const shouldSendEmail = sendEmail && !!recipientEmail && !!token;

      if (shouldSendEmail) {
        const url = fullLink(token);
        const emailTestName =
          testDisplayName || selectedTest?.name || "Profile Test";

        try {
          const emailRes = await fetch("/api/portal/links/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orgId,
              orgSlug,
              email: recipientEmail,
              linkUrl: url,
              orgName,
              testName: emailTestName,
            }),
          });

          const emailJson = await emailRes.json().catch(() => ({} as any));

          if (!emailRes.ok || emailJson?.error) {
            console.error("send-email error", emailRes.status, emailJson);
            message = "Link created, but sending the email failed.";
          } else if (emailJson?.skipped) {
            message = "Link created (email skipped — OneSignal not configured).";
          } else {
            message = "Link created and email sent!";
          }
        } catch (err) {
          console.error("send-email error", err);
          message = "Link created, but sending the email failed.";
        }
      }

      setStatus(message);
      await new Promise((r) => setTimeout(r, 500));
      refreshLinks();
      resetForm();
    } catch (e: any) {
      setStatus(e?.message || "Error creating link");
      console.error("create-link error", e);
    } finally {
      setLoading(false);
    }
  };

  const deleteLink = async (linkId: string) => {
    if (!linkId) return;
    const confirmDelete = window.confirm(
      "Delete this link? The URL will stop working for anyone who has it."
    );
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/tests/links/${linkId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      setLinks((prev) => prev.filter((l) => l.id !== linkId));
      setStatus("Link deleted");
      setTimeout(() => setStatus(null), 2000);
    } catch (e: any) {
      console.error("delete-link error", e);
      setStatus(e?.message || "Failed to delete link");
    }
  };

  const showHiddenMessageField = !showResults;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <div>
        <div className="mb-3">
          <h2 className="text-lg font-semibold">Generate Test Link</h2>
          <p className="text-sm text-gray-600">
            Generate a test link and optionally send it to a recipient.
          </p>
        </div>

        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Select test</span>
            <select
              className="w-full rounded border border-gray-300 bg-white p-2 text-sm"
              value={testId}
              onChange={(e) => setTestId(e.target.value)}
            >
              <option value="">Select test...</option>
              {tests.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.test_type ? ` (${t.test_type})` : ""}
                </option>
              ))}
            </select>
            {!tests.length && (
              <span className="mt-1 block text-xs text-gray-500">
                No tests found for this organisation. Create one under the{" "}
                <em>Tests</em> tab.
              </span>
            )}
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Test name / Test purpose</span>
            <input
              type="text"
              className="w-full rounded border border-gray-300 p-2 text-sm"
              placeholder="e.g. QSC Leaders — Sales team intake"
              value={testDisplayName}
              onChange={(e) => setTestDisplayName(e.target.value)}
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Contact owner's name</span>
            <input
              type="text"
              className="w-full rounded border border-gray-300 p-2 text-sm"
              placeholder="e.g. Sarah Ndlovu"
              value={contactOwner}
              onChange={(e) => setContactOwner(e.target.value)}
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Recipient email (optional)</span>
            <input
              type="email"
              className="w-full rounded border border-gray-300 p-2 text-sm"
              placeholder="e.g. person@example.com"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
            />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
            />
            <span>
              Send this link to the recipient via email{" "}
              <span className="text-gray-500">(OneSignal)</span>
            </span>
          </label>

          <div className="rounded-lg border border-gray-200 p-3">
            <div className="mb-2 block font-medium text-sm">Report version</div>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  if (supportsLiteReport) setReportVariant("lite");
                }}
                disabled={!supportsLiteReport}
                title={
                  supportsLiteReport
                    ? "Use the lite report"
                    : "Lite report is only available for Visibility Ladder right now"
                }
                className={`rounded-lg border px-3 py-3 text-left text-sm transition ${
                  reportVariant === "lite" && supportsLiteReport
                    ? "border-sky-500 bg-sky-50 text-sky-900"
                    : supportsLiteReport
                    ? "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    : "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                }`}
              >
                <div className="font-medium">Lite report</div>
                <div className="mt-1 text-xs">
                  Best for lead generation and first-touch assessments.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setReportVariant("full")}
                className={`rounded-lg border px-3 py-3 text-left text-sm transition ${
                  reportVariant === "full"
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                <div className="font-medium">Full report</div>
                <div className="mt-1 text-xs opacity-80">
                  Premium strategic interpretation and full roadmap.
                </div>
              </button>
            </div>

            {!supportsLiteReport ? (
              <p className="mt-2 text-xs text-gray-500">
                Lite report is currently only available for Visibility Ladder.
              </p>
            ) : (
              <p className="mt-2 text-xs text-gray-500">
                This controls which report version the test taker receives after completing the test.
              </p>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={showResults}
              onChange={(e) => setShowResults(e.target.checked)}
            />
            <span>
              Show results to taker <span className="text-gray-500">after completion</span>
            </span>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={emailReport}
              onChange={(e) => setEmailReport(e.target.checked)}
            />
            <span>Email the report</span>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">
              Next steps URL <span className="text-red-600">*</span>
            </span>
            <input
              type="url"
              className="w-full rounded border border-gray-300 p-2 text-sm"
              placeholder="e.g. https://your-site.com/book-a-call"
              value={nextStepsUrl}
              onChange={(e) => setNextStepsUrl(e.target.value)}
            />
            <span className="mt-1 block text-xs text-gray-500">
              This is always required and will be saved as the next-step destination for this link.
            </span>
          </label>

          {reportVariant === "lite" && supportsLiteReport && !nextStepsUrl.trim() && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Lite reports work best with a next steps URL so people can upgrade, book, or buy the full report.
            </div>
          )}

          {!showResults && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">
                Redirect URL <span className="text-red-600">*</span>
              </span>
              <input
                type="url"
                className="w-full rounded border border-gray-300 p-2 text-sm"
                placeholder="e.g. https://your-site.com/thank-you"
                value={redirectUrl}
                onChange={(e) => setRedirectUrl(e.target.value)}
              />
              <span className="mt-1 block text-xs text-gray-500">
                If results are hidden, the test taker will be redirected here after completing the test.
              </span>
            </label>
          )}

          {showHiddenMessageField && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">
                Message to show instead of results (optional)
              </span>
              <textarea
                className="min-h-[80px] w-full rounded border border-gray-300 p-2 text-sm"
                placeholder="e.g. Thank you for completing this assessment. Your facilitator will share your insights during the upcoming workshop."
                value={hiddenResultsMessage}
                onChange={(e) => setHiddenResultsMessage(e.target.value)}
              />
              <span className="mt-1 block text-xs text-gray-500">
                This message may be shown to the test taker when results are hidden.
              </span>
            </label>
          )}

          <div className="rounded-lg border border-gray-200 p-3">
            <div className="mb-2 block font-medium text-sm">Usage limit</div>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setUsageLimitMode("unlimited")}
                className={`rounded-lg border px-3 py-3 text-left text-sm transition ${
                  usageLimitMode === "unlimited"
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                <div className="font-medium">Unlimited</div>
                <div className="mt-1 text-xs opacity-80">
                  Anyone with the link can complete the test, no cap.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setUsageLimitMode("limited")}
                className={`rounded-lg border px-3 py-3 text-left text-sm transition ${
                  usageLimitMode === "limited"
                    ? "border-sky-500 bg-sky-50 text-sky-900"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                <div className="font-medium">Limited</div>
                <div className="mt-1 text-xs">
                  Cap the number of completed submissions.
                </div>
              </button>
            </div>

            {usageLimitMode === "limited" && (
              <label className="mt-3 block text-sm">
                <span className="mb-1 block font-medium">
                  Max completed submissions{" "}
                  <span className="text-red-600">*</span>
                </span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  className="w-full rounded border border-gray-300 p-2 text-sm"
                  placeholder="e.g. 50"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                />
                <span className="mt-1 block text-xs text-gray-500">
                  Once this many people complete the test, the link will block
                  new completions.
                </span>
              </label>
            )}
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={generate}
            className="mt-2 w-full rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
          >
            {loading ? "Generating..." : "Generate link"}
          </button>

          {status && <p className="mt-2 text-sm text-gray-700">{status}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent links — {orgName}</h2>
          <button
            type="button"
            onClick={refreshLinks}
            className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-60"
            disabled={loadingLinks}
            title="Reload"
          >
            {loadingLinks ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">
                  Test name / Test purpose
                </th>
                <th className="px-3 py-2 text-left font-medium">Test</th>
                <th className="px-3 py-2 text-left font-medium">Report</th>
                <th className="px-3 py-2 text-left font-medium">Uses</th>
                <th className="px-3 py-2 text-left font-medium">Created</th>
                <th className="px-3 py-2 text-left font-medium">Results</th>
                <th className="px-3 py-2 text-left font-medium">Redirect link</th>
                <th className="px-3 py-2 text-left font-medium">Link</th>
                <th className="px-3 py-2 text-left font-medium">Copy</th>
                <th className="px-3 py-2 text-left font-medium">Actions</th>
              </tr>
            </thead>

            <tbody>
              {links.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-6 text-center text-gray-500">
                    No links yet.
                  </td>
                </tr>
              )}

              {links.map((r, idx) => {
                const url = fullLink(r.token);
                const rowBg = idx % 2 === 0 ? "bg-white" : "bg-gray-50";

                const redirectOrNext =
                  (r.show_results ? r.next_steps_url : r.redirect_url) || "";

                const variant: ReportVariant =
                  r.report_variant === "lite" ? "lite" : "full";

                return (
                  <tr key={r.id} className={`${rowBg} border-t`}>
                    <td className="px-3 py-2 align-top">
                      <div className="font-medium">
                        {r.link_name || "Untitled link"}
                      </div>
                      {r.contact_owner && (
                        <div className="text-xs text-gray-500">
                          Owner: {r.contact_owner}
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-2 align-top">
                      <div className="text-sm text-gray-900">{r.test_name || "—"}</div>
                    </td>

                    <td className="px-3 py-2 align-top">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          variant === "lite"
                            ? "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200"
                            : "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200"
                        }`}
                      >
                        {variant === "lite" ? "Lite" : "Full"}
                      </span>
                    </td>

                    <td className="px-3 py-2 align-top">
                      <div className="text-sm text-gray-900 tabular-nums">
                        {typeof r.use_count === "number" ? r.use_count : 0}
                        {r.max_uses ? ` / ${r.max_uses}` : ""}
                      </div>
                      {!r.max_uses && (
                        <div className="text-xs text-gray-500">Unlimited</div>
                      )}
                    </td>

                    <td className="px-3 py-2 align-top">
                      {r.created_at
                        ? new Date(r.created_at).toLocaleString()
                        : "—"}
                    </td>

                    <td className="px-3 py-2 align-top">
                      {r.show_results ? "Shown" : "Hidden"}
                      {!r.email_report && (
                        <div className="text-xs text-gray-500">
                          Report not emailed
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-2 align-top">
                      {redirectOrNext ? (
                        <button
                          type="button"
                          className="text-blue-600 underline"
                          onClick={() => window.open(redirectOrNext, "_blank")}
                          title={redirectOrNext}
                        >
                          Open
                        </button>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                      {redirectOrNext ? (
                        <div className="mt-1 max-w-[220px] truncate text-xs text-gray-500">
                          {redirectOrNext}
                        </div>
                      ) : null}
                    </td>

                    <td className="px-3 py-2 align-top">
                      <button
                        type="button"
                        onClick={() => window.open(url, "_blank")}
                        className="text-blue-600 underline"
                      >
                        Open link
                      </button>
                    </td>

                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                          onClick={() => doCopy(url, "URL copied")}
                        >
                          URL
                        </button>

                        <button
                          className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                          onClick={() =>
                            downloadTxt(
                              embedCode(r.token),
                              `mindcanvas-embed-${r.token}.txt`
                            )
                          }
                          title="Download the embed code as a .txt file"
                        >
                          Download embed
                        </button>

                        <button
                          className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                          onClick={() => doCopy(htmlButton(url), "Snippet copied")}
                        >
                          Snippet
                        </button>
                      </div>
                    </td>

                    <td className="px-3 py-2 align-top">
                      <button
                        type="button"
                        onClick={() => deleteLink(r.id)}
                        className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {status && <p className="mt-2 text-xs text-gray-500">{status}</p>}
      </div>
    </div>
  );
}