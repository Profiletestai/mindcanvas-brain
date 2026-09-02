// apps/web/components/portal/create-test-link/AdvancedFields.tsx
// The link options that used to live only on the advanced create form:
// next-steps URL, redirect URL, hidden-results message, contact owner,
// email-report toggle and report variant.
//
// Controlled component so the create wizard (react-hook-form) and the edit
// modal (local state) render exactly the same fields and the same rules.
"use client";

import OptionRow from "./OptionRow";
import type { AdvancedLinkValues } from "./types";
import { isValidUrl } from "@/lib/isValidUrl";

export const darkInputClass =
  "w-full rounded-xl border border-white/[0.12] bg-white/[0.03] px-4 py-3 text-[14px] text-white placeholder:text-white/30 outline-none focus:border-[#54AFE0]";

const fieldLabelClass =
  "mb-1.5 block text-[11px] font-semibold tracking-[0.02em] text-white/[0.62]";

const hintClass = "mt-1.5 text-[11.5px] font-light text-white/[0.36]";

export default function AdvancedFields({
  values,
  onChange,
  showResults,
  supportsLite,
}: {
  values: AdvancedLinkValues;
  onChange: <K extends keyof AdvancedLinkValues>(
    key: K,
    value: AdvancedLinkValues[K],
  ) => void;
  // Whether the test taker sees the report — drives the redirect/hidden fields.
  showResults: boolean;
  // Lite report is only offered for the orgs/tests that have one.
  supportsLite: boolean;
}) {
  const nextStepsInvalid =
    values.nextStepsUrl.trim().length > 0 && !isValidUrl(values.nextStepsUrl);
  const redirectInvalid =
    values.redirectUrl.trim().length > 0 && !isValidUrl(values.redirectUrl);

  return (
    <div className="space-y-5">
      {/* Next steps URL — always required; the report CTA target. */}
      <div>
        <label className={fieldLabelClass} htmlFor="adv-next-steps">
          Next steps URL <span className="text-rose-400">*</span>
        </label>
        <input
          id="adv-next-steps"
          type="url"
          inputMode="url"
          placeholder="https://your-site.com/book-a-call"
          className={darkInputClass}
          value={values.nextStepsUrl}
          onChange={(e) => onChange("nextStepsUrl", e.target.value)}
        />
        <p className={hintClass}>
          Where the report&apos;s call-to-action sends the test taker. Required.
        </p>
        {nextStepsInvalid && (
          <p className="mt-1.5 text-[11.5px] text-rose-400">
            Enter a full URL, including https://
          </p>
        )}
      </div>

      {/* Redirect + hidden message only apply when results are hidden. */}
      {!showResults && (
        <>
          <div>
            <label className={fieldLabelClass} htmlFor="adv-redirect">
              Redirect URL <span className="text-rose-400">*</span>
            </label>
            <input
              id="adv-redirect"
              type="url"
              inputMode="url"
              placeholder="https://your-site.com/thank-you"
              className={darkInputClass}
              value={values.redirectUrl}
              onChange={(e) => onChange("redirectUrl", e.target.value)}
            />
            <p className={hintClass}>
              Results are hidden for this experience, so the test taker is sent
              here after finishing.
            </p>
            {redirectInvalid && (
              <p className="mt-1.5 text-[11.5px] text-rose-400">
                Enter a full URL, including https://
              </p>
            )}
          </div>

          <div>
            <label className={fieldLabelClass} htmlFor="adv-hidden-message">
              Message shown instead of results
            </label>
            <textarea
              id="adv-hidden-message"
              placeholder="e.g. Thank you — your facilitator will share your insights in the upcoming workshop."
              className={`${darkInputClass} min-h-[86px] resize-y`}
              value={values.hiddenResultsMessage}
              onChange={(e) => onChange("hiddenResultsMessage", e.target.value)}
            />
            <p className={hintClass}>Optional.</p>
          </div>
        </>
      )}

      <div>
        <label className={fieldLabelClass} htmlFor="adv-contact-owner">
          Contact owner
        </label>
        <input
          id="adv-contact-owner"
          type="text"
          placeholder="e.g. Sarah Ndlovu"
          className={darkInputClass}
          value={values.contactOwner}
          onChange={(e) => onChange("contactOwner", e.target.value)}
        />
        <p className={hintClass}>
          Optional — who owns the relationship with these test takers.
        </p>
      </div>

      <OptionRow
        selected={values.emailReport}
        title="Email the report to the host"
        hint="Sends the completed report to your organisation"
        onClick={() => onChange("emailReport", !values.emailReport)}
      />

      {showResults && (
        <div className="rounded-xl border border-white/[0.1] bg-white/[0.025] p-4">
          <OptionRow
            selected={values.reportPaywallEnabled}
            title="Charge for the full report"
            hint="The test taker sees their results, then pays MindCanvas to unlock the full report"
            onClick={() => onChange("reportPaywallEnabled", !values.reportPaywallEnabled)}
          />
          {values.reportPaywallEnabled && (
            <div className="mt-4 grid grid-cols-[110px_1fr] gap-3">
              <select
                className={darkInputClass}
                value={values.reportCurrency}
                onChange={(e) => onChange("reportCurrency", e.target.value as any)}
              >
                <option value="GBP">GBP</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="ZAR">ZAR</option>
              </select>
              <input
                type="text"
                inputMode="decimal"
                placeholder="49.00"
                className={darkInputClass}
                value={values.reportPrice}
                onChange={(e) => onChange("reportPrice", e.target.value)}
              />
              <p className="col-span-2 text-[11.5px] font-light text-white/[0.36]">
                MindCanvas receives the payment. Access is granted only to the completed submission that was purchased.
              </p>
            </div>
          )}
        </div>
      )}

      {supportsLite && (
        <div>
          <div className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/[0.36]">
            Report version
          </div>
          <div className="space-y-2.5">
            <OptionRow
              selected={values.reportVariant === "full"}
              title="Full report"
              hint="Premium strategic interpretation and full roadmap"
              onClick={() => onChange("reportVariant", "full")}
            />
            <OptionRow
              selected={values.reportVariant === "lite"}
              title="Lite report"
              hint="Best for lead generation and first-touch assessments"
              onClick={() => onChange("reportVariant", "lite")}
            />
          </div>
          {values.reportVariant === "lite" &&
            !values.nextStepsUrl.trim() && (
              <p className="mt-2 rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-[11.5px] text-amber-300">
                Lite reports work best with a next steps URL so people can
                upgrade, book, or buy the full report.
              </p>
            )}
        </div>
      )}
    </div>
  );
}
