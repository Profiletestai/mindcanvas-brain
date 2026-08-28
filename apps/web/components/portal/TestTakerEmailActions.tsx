"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  orgSlug: string;
  testId: string;
  takerId: string;
  compact?: boolean;
};

type SendType = "send_test_link" | "report";

const LABELS: Record<SendType, string> = {
  send_test_link: "Send Test Link",
  report: "Send Report Email",
};

export default function TestTakerEmailActions({
  orgSlug,
  testId,
  takerId,
  compact,
}: Props) {
  const [busyType, setBusyType] = useState<SendType | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const send = async (type: SendType) => {
    setBusyType(type);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch(
        `/api/portal/${orgSlug}/communications/send`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, testId, takerId }),
        }
      );

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        // ignore JSON parse errors
      }

      if (!res.ok) {
        const detail =
          data?.error ||
          data?.message ||
          data?.detail ||
          `HTTP ${res.status}`;
        setError(detail);
      } else {
        setMessage(`"${LABELS[type]}" email sent.`);
      }
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setBusyType(null);
    }
  };

  const btnBase =
    "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-sky-500";
  const btnNeutral =
    btnBase +
    " border-slate-300 bg-white text-slate-800 hover:bg-slate-50";

  // Compact: single dark "tag" icon button matching the table's action row,
  // with a small popover exposing the two send actions.
  if (compact) {
    return (
      <div ref={menuRef} className="relative">
        <button
          type="button"
          title="Send email"
          disabled={!!busyType}
          onClick={() => setOpen((v) => !v)}
          className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] border border-white/[0.08] bg-white/[0.04] text-white/[0.36] transition hover:bg-white/[0.07] hover:text-white/70 disabled:opacity-60"
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
            <path d="M7.85718 7.85715H13L17.2857 12.1429L12.1429 17.2857L7.85718 13V7.85715Z" />
            <path d="M10.4287 11.2857C10.9021 11.2857 11.2858 10.902 11.2858 10.4286C11.2858 9.9552 10.9021 9.57144 10.4287 9.57144C9.95529 9.57144 9.57153 9.9552 9.57153 10.4286C9.57153 10.902 9.95529 11.2857 10.4287 11.2857Z" />
          </svg>
        </button>

        {open && (
          <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-[10px] border border-white/[0.08] bg-[#0e2138] py-1 shadow-xl shadow-black/50">
            <button
              type="button"
              disabled={!!busyType}
              onClick={() => {
                send("send_test_link");
                setOpen(false);
              }}
              className="block w-full px-3 py-2 text-left text-[13px] text-slate-200 transition hover:bg-white/[0.06] disabled:opacity-60"
            >
              {busyType === "send_test_link" ? "Sending…" : "Send Test Link"}
            </button>
            <button
              type="button"
              disabled={!!busyType}
              onClick={() => {
                send("report");
                setOpen(false);
              }}
              className="block w-full px-3 py-2 text-left text-[13px] text-slate-200 transition hover:bg-white/[0.06] disabled:opacity-60"
            >
              {busyType === "report" ? "Sending…" : "Send Report Email"}
            </button>
          </div>
        )}

        {(message || error) && (
          <p
            className={`absolute right-0 top-full mt-1 whitespace-nowrap text-[11px] ${
              error ? "text-red-400" : "text-emerald-400"
            }`}
          >
            {error || message}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      <div className={compact ? "flex flex-wrap gap-1" : "flex flex-wrap gap-2"}>
        <button
          type="button"
          className={btnNeutral}
          disabled={!!busyType}
          onClick={() => send("send_test_link")}
        >
          {busyType === "send_test_link" ? "Sending…" : "Send Test Link"}
        </button>

        <button
          type="button"
          className={btnNeutral}
          disabled={!!busyType}
          onClick={() => send("report")}
        >
          {busyType === "report" ? "Sending…" : "Send Report"}
        </button>
      </div>

      {(message || error) && (
        <p
          className={`text-[11px] ${
            error ? "text-red-600" : "text-emerald-600"
          }`}
        >
          {error || message}
        </p>
      )}
    </div>
  );
}
