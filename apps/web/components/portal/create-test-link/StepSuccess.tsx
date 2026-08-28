// apps/web/components/portal/create-test-link/StepSuccess.tsx
"use client";

import { useState } from "react";
import { getBaseUrl } from "@/lib/baseUrl";
import { darkInputClass } from "./AdvancedFields";

export default function StepSuccess({
  createdToken,
  copied,
  onCopy,
  orgId,
  orgSlug,
  testName,
}: {
  createdToken: string | null;
  copied: boolean;
  onCopy: () => void;
  orgId: string;
  orgSlug: string;
  testName?: string | null;
}) {
  const url = createdToken ? `${getBaseUrl()}/t/${createdToken}` : null;

  // "Send link by email" — the only UI for /api/portal/links/send-email now
  // that the advanced create form is gone.
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  const sendEmail = async () => {
    if (!url || !email.trim()) return;
    setSending(true);
    setEmailStatus(null);
    try {
      const res = await fetch("/api/portal/links/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          orgSlug,
          email: email.trim(),
          linkUrl: url,
          testName: testName || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}) as any);
      if (!res.ok || json?.error) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }
      setEmailStatus(
        json?.skipped ? "Email skipped — sending is not configured." : "Email sent!",
      );
      setEmail("");
    } catch (e: any) {
      setEmailStatus(e?.message || "Failed to send the email");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col items-center py-4 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full border border-[#22C55E]/[0.22] bg-[#22C55E]/10 text-[#22C55E]">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      <h3 className="mt-4 text-[16px] font-extrabold text-white">
        Test link created
      </h3>
      <p className="mt-1 text-[12.5px] font-light text-white/[0.62]">
        You can now activate, copy, and share your test links.
      </p>

      {url && (
        <div className="mt-5 flex w-full items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] py-2.5 pl-3.5 pr-2.5">
          <span className="truncate font-mono text-[11.5px] text-white/[0.62]">
            {url}
          </span>
          <button
            type="button"
            onClick={onCopy}
            className="shrink-0 rounded-md border border-[#54AFE0]/[0.22] bg-[#54AFE0]/10 px-2.5 py-1 text-[10.5px] font-bold text-[#54AFE0] transition hover:bg-[#54AFE0]/20"
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
      )}

      {url && !showEmail && (
        <button
          type="button"
          onClick={() => setShowEmail(true)}
          className="mt-4 text-[12.5px] font-medium text-[#54AFE0] transition hover:text-white"
        >
          Send this link by email →
        </button>
      )}

      {url && showEmail && (
        <div className="mt-4 w-full text-left">
          <label
            className="mb-1.5 block text-[11px] font-semibold text-white/[0.62]"
            htmlFor="success-email"
          >
            Send to
          </label>
          <div className="flex gap-2">
            <input
              id="success-email"
              type="email"
              autoFocus
              placeholder="person@example.com"
              className={darkInputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              type="button"
              disabled={sending || !email.trim()}
              onClick={sendEmail}
              className="shrink-0 rounded-xl border border-[#54AFE0]/[0.22] bg-[#54AFE0]/10 px-3.5 text-[12px] font-bold text-[#54AFE0] transition hover:bg-[#54AFE0]/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
          {emailStatus && (
            <p className="mt-1.5 text-[11.5px] text-white/[0.62]">
              {emailStatus}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
