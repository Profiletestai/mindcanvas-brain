// apps/web/components/portal/EditTestLinkModal.tsx
// Edit an existing test link. Same modal shell as CreateTestLinkModal, but a
// single flat form rather than a stepper — it renders the same AdvancedFields
// the wizard's last step uses, so both surfaces stay in sync.
"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import AdvancedFields, {
  darkInputClass,
} from "./create-test-link/AdvancedFields";
import OptionRow from "./create-test-link/OptionRow";
import {
  EXPERIENCE_OPTIONS,
  supportsLiteReport,
  type AdvancedLinkValues,
  type ReportVariant,
} from "./create-test-link/types";
import { isValidUrl } from "@/lib/isValidUrl";

export type EditableLink = {
  id: string;
  link_name: string | null;
  test_name: string;
  show_results: boolean | null;
  email_report: boolean;
  contact_owner: string | null;
  next_steps_url: string | null;
  redirect_url: string | null;
  hidden_results_message: string | null;
  max_uses: number | null;
  expires_at: string | null;
  report_variant?: ReportVariant | null;
};

// yyyy-mm-dd for <input type="date">.
function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export default function EditTestLinkModal({
  orgId,
  orgSlug,
  link,
  onClose,
}: {
  orgId: string;
  orgSlug: string;
  link: EditableLink;
  onClose: () => void;
}) {
  const [name, setName] = useState(link.link_name ?? "");
  const [showResults, setShowResults] = useState(!!link.show_results);
  const [limitMode, setLimitMode] = useState<"none" | "count">(
    link.max_uses != null ? "count" : "none",
  );
  const [maxUses, setMaxUses] = useState(
    link.max_uses != null ? String(link.max_uses) : "",
  );
  const [expiresDate, setExpiresDate] = useState(toDateInput(link.expires_at));

  const [values, setValues] = useState<AdvancedLinkValues>({
    nextStepsUrl: link.next_steps_url ?? "",
    redirectUrl: link.redirect_url ?? "",
    hiddenResultsMessage: link.hidden_results_message ?? "",
    contactOwner: link.contact_owner ?? "",
    emailReport: !!link.email_report,
    reportVariant: link.report_variant === "lite" ? "lite" : "full",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supportsLite = supportsLiteReport(orgSlug, link.test_name);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const canSave = useMemo(() => {
    if (!isValidUrl(values.nextStepsUrl)) return false;
    if (!showResults && !isValidUrl(values.redirectUrl)) return false;
    if (limitMode === "count") {
      const n = parseInt(maxUses, 10);
      if (!Number.isInteger(n) || n < 1) return false;
    }
    return true;
  }, [values.nextStepsUrl, values.redirectUrl, showResults, limitMode, maxUses]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/links/${link.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          name: name.trim() || null,
          showResults,
          emailReport: values.emailReport,
          contactOwner: values.contactOwner.trim() || null,
          nextStepsUrl: values.nextStepsUrl.trim(),
          redirectUrl: showResults ? null : values.redirectUrl.trim(),
          hiddenResultsMessage:
            !showResults && values.hiddenResultsMessage.trim()
              ? values.hiddenResultsMessage.trim()
              : null,
          report_variant: supportsLite ? values.reportVariant : "full",
          max_uses: limitMode === "count" ? parseInt(maxUses, 10) : null,
          expiresAt: expiresDate
            ? new Date(expiresDate).toISOString()
            : null,
        }),
      });
      const data = await res.json().catch(() => ({}) as any);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      try {
        window.dispatchEvent(new CustomEvent("links:changed"));
      } catch {
        // ignore
      }
      onClose();
    } catch (e: any) {
      setError(e?.message || "Failed to save the link");
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-[#050914]/75 backdrop-blur-md"
        onClick={onClose}
      />

      <div
        className="relative flex max-h-[90vh] w-full max-w-[480px] flex-col overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#0a1e30] p-7 shadow-[0_40px_80px_0_rgba(0,0,0,0.5)]"
        style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
      >
        <span className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-[linear-gradient(to_right,#54AFE0_0%,#54AFE0_55%,transparent_100%)]" />

        <div className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-[#54AFE0]">
          {link.test_name}
        </div>
        <h2 className="mt-2 text-[21px] font-extrabold leading-[28px] tracking-[-0.3px] text-white">
          Edit test link
        </h2>

        <div className="mt-6 flex-1 space-y-5 overflow-y-auto pr-1">
          <div>
            <label
              className="mb-1.5 block text-[11px] font-semibold text-white/[0.62]"
              htmlFor="edit-link-name"
            >
              Link name
            </label>
            <input
              id="edit-link-name"
              className={darkInputClass}
              placeholder="e.g. QSC Leaders — Sales team intake"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <div className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/[0.36]">
              Test taker experience
            </div>
            <div className="space-y-2.5">
              {/* Only the show/hide split is persisted today, so editing
                  offers exactly that. */}
              <OptionRow
                selected={showResults}
                title={EXPERIENCE_OPTIONS[0].title}
                hint={EXPERIENCE_OPTIONS[0].hint}
                onClick={() => setShowResults(true)}
              />
              <OptionRow
                selected={!showResults}
                title={EXPERIENCE_OPTIONS[1].title}
                hint={EXPERIENCE_OPTIONS[1].hint}
                onClick={() => setShowResults(false)}
              />
            </div>
          </div>

          <div>
            <div className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/[0.36]">
              Link limits
            </div>
            <div className="space-y-2.5">
              <OptionRow
                selected={limitMode === "none"}
                title="No limit"
                hint="Unlimited submissions on this link"
                onClick={() => setLimitMode("none")}
              />
              <OptionRow
                selected={limitMode === "count"}
                title="Limit by number of submissions"
                hint="Link closes when the limit is reached"
                onClick={() => setLimitMode("count")}
              />
            </div>

            {limitMode === "count" && (
              <input
                type="number"
                min={1}
                step={1}
                placeholder="Max submissions, e.g. 50"
                className={`mt-3 ${darkInputClass}`}
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
              />
            )}

            <label
              className="mb-1.5 mt-4 block text-[11px] font-semibold text-white/[0.62]"
              htmlFor="edit-expires"
            >
              Close on date (optional)
            </label>
            <input
              id="edit-expires"
              type="date"
              className={`${darkInputClass} [color-scheme:dark]`}
              value={expiresDate}
              onChange={(e) => setExpiresDate(e.target.value)}
            />
          </div>

          <AdvancedFields
            values={values}
            onChange={(key, value) =>
              setValues((v) => ({ ...v, [key]: value }))
            }
            showResults={showResults}
            supportsLite={supportsLite}
          />
        </div>

        {error && <p className="mt-3 text-[13px] text-rose-400">{error}</p>}

        <div className="mt-6 space-y-2.5">
          <button
            type="button"
            disabled={!canSave || saving}
            onClick={save}
            className="inline-flex h-[38px] w-full items-center justify-center rounded-xl bg-[linear-gradient(101.83deg,#54AFE0_0%,#54AFE0_100%)] text-[13px] font-bold text-white shadow-[0_6px_20px_0_rgba(26,106,232,0.38)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-[38px] w-full items-center justify-center rounded-xl border border-white/[0.11] bg-white/[0.06] text-[13px] font-bold text-white/[0.62] transition hover:bg-white/[0.09]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
