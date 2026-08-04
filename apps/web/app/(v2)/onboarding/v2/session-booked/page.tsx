"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, isErr } from "../_lib/api";
import { StepCard } from "../_components/StepCard";
import { DIAGNOSTIC_PATH, dashboardPath } from "../_lib/progress";

export default function SessionBookedPage() {
  const router = useRouter();
  const [pending, setPending] = useState<"diagnostic" | "dashboard" | null>(
    null,
  );
  const [error, setError] = useState("");

  async function continueToDiagnostic() {
    if (pending) return;
    setPending("diagnostic");
    setError("");
    const res = await api.completeStep(9);
    if (isErr(res)) {
      setError(res.error);
      setPending(null);
      return;
    }
    router.push(DIAGNOSTIC_PATH);
  }

  async function continueToDashboard() {
    if (pending) return;
    setPending("dashboard");
    setError("");
    const res = await api.completeStep(10);
    if (isErr(res)) {
      setError(res.error);
      setPending(null);
      return;
    }
    router.push(dashboardPath(res.org_slug));
  }

  return (
    <StepCard
      titleNoWrap={false}
      title={
        <>
          Your onboarding session is{" "}
          <span style={{ color: "rgb(84, 175, 224)" }}>booked</span>
        </>
      }
      subtitle="We’ve sent the session details and calendar confirmation to your email."
    >
      <div
        className="mt-8 rounded-[18px] border text-center"
        style={{
          background: "#fff",
          borderColor: "rgb(228,238,248)",
          padding: "30px 24px 24px",
          boxShadow: "0px 2px 12px 0px rgba(13,45,94,0.06)",
        }}
      >
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
          style={{
            background: "rgba(34,197,94,0.12)",
            color: "rgb(22,163,74)",
            fontSize: "28px",
          }}
          aria-hidden
        >
          ✓
        </div>

        <h3
          className="mt-5 font-bold"
          style={{
            color: "rgb(24,44,62)",
            fontSize: "18px",
            lineHeight: "24px",
          }}
        >
          Before your session
        </h3>

        <p
          className="mx-auto mt-3 max-w-[440px]"
          style={{
            color: "rgb(90,122,158)",
            fontSize: "13px",
            lineHeight: "21px",
          }}
        >
          Complete your first diagnostic to experience MindCanvas from a test
          taker’s perspective. This will give us useful context for your
          onboarding session.
        </p>

        {error && (
          <p className="mt-4 text-sm text-rose-500" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={continueToDiagnostic}
          disabled={pending !== null}
          className={`mt-6 h-[54px] w-full rounded-[12px] font-bold text-white ${
            pending ? "cursor-not-allowed opacity-40" : "cursor-pointer"
          }`}
          style={{
            background:
              "linear-gradient(180deg, rgb(6,94,144) 0%, rgb(42,137,190) 100%)",
            fontSize: "15px",
            boxShadow: "0px 4px 16px 0px rgba(37,99,200,0.35)",
          }}
        >
          {pending === "diagnostic"
            ? "Loading…"
            : "Complete your first diagnostic"}
        </button>

        <button
          type="button"
          onClick={continueToDashboard}
          disabled={pending !== null}
          className={`mt-3 h-[50px] w-full rounded-[12px] border font-semibold ${
            pending ? "cursor-not-allowed opacity-40" : "cursor-pointer"
          }`}
          style={{
            background: "#fff",
            borderColor: "rgb(208,224,240)",
            color: "rgb(42,137,190)",
            fontSize: "14px",
          }}
        >
          {pending === "dashboard" ? "Loading…" : "Go to dashboard"}
        </button>
      </div>
    </StepCard>
  );
}