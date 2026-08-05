"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type BillingSummary = {
  ok: boolean;
  billing: {
    billing_source?: string | null;
    is_pilot?: boolean;
    pilot_end_date?: string | null;
    pilot_grace_ends_at?: string | null;
  } | null;
};

type Phase = "active" | "grace";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function PilotGracePopup() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("active");
  const [pilotEnd, setPilotEnd] = useState<string | null>(null);
  const [graceEnd, setGraceEnd] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (typeof window === "undefined") return;
    (async () => {
      const res = await fetch("/api/billing/summary", {
        credentials: "include",
        cache: "no-store",
      });
      if (cancelled || !res.ok) return;
      const data = (await res
        .json()
        .catch(() => null)) as BillingSummary | null;
      const b = data?.billing;

      // A converted legacy organisation follows the compulsory
      // legacy billing flow, even if an old pilot entitlement remains.
      if (
        !b ||
        b.billing_source === "legacy" ||
        !b.is_pilot ||
        !b.pilot_end_date
      ) {
        return;
      }

      const now = Date.now();
      const end = new Date(b.pilot_end_date).getTime();
      const grace = b.pilot_grace_ends_at
        ? new Date(b.pilot_grace_ends_at).getTime()
        : end + 48 * 60 * 60 * 1000;

      // Past the grace window the sweeper suspends the org; nothing to prompt.
      if (now >= grace) return;

      const nextPhase: Phase = now >= end ? "grace" : "active";

      // Active pilot: nag at most once per login — consume the one-shot marker
      // the login page sets, and bail if we're not arriving fresh from a login.
      // Grace: skip the marker entirely so it shows on every full page load.
      if (nextPhase === "active") {
        if (sessionStorage.getItem("mc_just_logged_in") !== "1") return;
        sessionStorage.removeItem("mc_just_logged_in");
      }

      setPhase(nextPhase);
      setPilotEnd(b.pilot_end_date);
      setGraceEnd(b.pilot_grace_ends_at ?? new Date(grace).toISOString());
      setOpen(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!open) return null;

  const dismiss = () => setOpen(false);

  const hoursLeftInGrace = graceEnd
    ? Math.max(
        0,
        Math.ceil((new Date(graceEnd).getTime() - Date.now()) / 3_600_000),
      )
    : 0;

  const isGrace = phase === "grace";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(13,28,54,0.55)" }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-[460px] rounded-[18px] bg-white"
        style={{
          boxShadow: "0px 20px 60px rgba(13,45,94,0.35)",
          padding: "32px 28px",
        }}
      >
        <div
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1"
          style={{
            background: isGrace ? "rgb(255,224,228)" : "rgb(255,244,214)",
            color: isGrace ? "rgb(176,40,68)" : "rgb(168,114,12)",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.5px",
          }}
        >
          {isGrace ? "PILOT ENDED" : "PILOT ACTIVE"}
        </div>

        <h2
          className="mt-4 font-extrabold"
          style={{
            fontSize: "22px",
            lineHeight: "28px",
            color: "rgb(18,38,64)",
          }}
        >
          {isGrace
            ? "Subscribe now to keep your access"
            : "You're on the Mind Canvas pilot"}
        </h2>

        <p
          className="mt-3"
          style={{
            fontSize: "14px",
            lineHeight: "21px",
            color: "rgb(90,122,158)",
          }}
        >
          {isGrace ? (
            <>
              Your pilot ended on <strong>{formatDate(pilotEnd)}</strong>. You
              have{" "}
              <strong>
                about {hoursLeftInGrace} hour{hoursLeftInGrace === 1 ? "" : "s"}
              </strong>{" "}
              left to subscribe before your organisation is suspended.
            </>
          ) : (
            <>
              Your pilot runs until <strong>{formatDate(pilotEnd)}</strong>.
              Subscribe to a plan any time to keep your access — you&apos;ll
              also get a 48-hour grace period after the pilot ends.
            </>
          )}
        </p>

        <button
          type="button"
          onClick={() => router.push("/choose-plan")}
          className="mt-6 w-full h-[52px] rounded-[12px] text-white font-bold cursor-pointer"
          style={{
            background:
              "linear-gradient(180deg, rgb(6,94,144) 0%, rgb(42,137,190) 100%)",
            fontSize: "15px",
            boxShadow: "0px 4px 16px 0px rgba(37,99,200,0.35)",
          }}
        >
          Subscribe to a plan
        </button>

        <button
          type="button"
          onClick={dismiss}
          className="mt-3 w-full h-[44px] rounded-[12px] font-semibold cursor-pointer"
          style={{ color: "rgb(90,122,158)", fontSize: "14px" }}
        >
          {isGrace ? "Remind me later" : "Maybe later"}
        </button>
      </div>
    </div>
  );
}
