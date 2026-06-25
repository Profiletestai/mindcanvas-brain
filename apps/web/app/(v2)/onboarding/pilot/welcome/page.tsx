"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, isErr } from "../_lib/api";
import { StepCard } from "@/app/(v2)/onboarding/v2/_components/StepCard";

const PILOT_ALLOWANCE = 13;

function formatDate(iso: string | null): string {
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

export default function PilotWelcomePage() {
  const router = useRouter();
  const started = useRef(false);
  const [state, setState] = useState<"activating" | "ready" | "error">("activating");
  const [pilotEnd, setPilotEnd] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<string>("/portal");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const res = await api.activate();
      if (isErr(res)) {
        setErrMsg(res.error);
        setState("error");
        return;
      }
      setPilotEnd(res.pilot_end_date);
      setDashboard(res.redirect);
      setState("ready");
    })();
  }, []);

  if (state === "activating") {
    return (
      <div className="py-8 text-center text-white/70">Activating your pilot…</div>
    );
  }

  if (state === "error") {
    return (
      <StepCard
        title={
          <>
            Something went <span style={{ color: "rgb(224, 84, 84)" }}>wrong</span>
          </>
        }
        subtitle="We couldn't activate your pilot. Please try again."
      >
        <div className="mt-6 text-sm text-rose-500 text-center">{errMsg}</div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 w-full h-[52px] rounded-[12px] text-white font-bold cursor-pointer"
          style={{
            background:
              "linear-gradient(180deg, rgb(6,94,144) 0%, rgb(42,137,190) 100%)",
            fontSize: "15px",
          }}
        >
          Try again
        </button>
      </StepCard>
    );
  }

  return (
    <StepCard
      titleNoWrap={false}
      title={
        <>
          Your pilot is <span style={{ color: "rgb(84, 175, 224)" }}>live</span>
        </>
      }
      subtitle="You're all set to start using the Growth Engine Diagnostic."
    >
      <div
        className="mt-8 rounded-[18px] border"
        style={{
          background: "#fff",
          borderColor: "rgb(228,238,248)",
          padding: "44px 28px 44px 28px",
          boxShadow: "0px 2px 12px 0px rgba(13,45,94,0.06)",
        }}
      >
        <div className="flex justify-center">
          <div
            className="flex items-center justify-center"
            style={{
              height: "72px",
              width: "72px",
              borderRadius: "9999px",
              background: "#fff",
              border: "2px solid rgb(170,220,180)",
              fontSize: "34px",
              lineHeight: 1,
              boxShadow: "0px 2px 10px 0px rgba(13,45,94,0.08)",
            }}
          >
            🚀
          </div>
        </div>

        <div
          className="mt-6 rounded-[14px]"
          style={{ background: "rgb(240,246,255)", padding: "26px 28px" }}
        >
          <Row label="Included test" value="Growth Engine Diagnostic (GED)" />
          <Divider />
          <Row label="Submissions" value={`${PILOT_ALLOWANCE} included`} />
          <Divider />
          <Row label="Pilot ends" value={formatDate(pilotEnd)} />
          <Divider />
          <Row
            label="Billing"
            value={
              <span style={{ color: "rgb(120,144,176)", fontWeight: 500 }}>
                Free during the pilot
              </span>
            }
          />
        </div>

        <button
          type="button"
          onClick={() => router.push(dashboard)}
          className="mt-5 w-full h-[60px] rounded-[14px] text-white font-bold tracking-wide cursor-pointer"
          style={{
            background:
              "linear-gradient(180deg, rgb(6,94,144) 0%, rgb(42,137,190) 100%)",
            fontSize: "16px",
            letterSpacing: "0.2px",
            boxShadow: "0px 6px 20px 0px rgba(37,99,200,0.30)",
          }}
        >
          Go to dashboard
        </button>
      </div>
    </StepCard>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span style={{ fontSize: "15px", color: "rgb(90,122,158)" }}>{label}</span>
      <span
        className="text-right"
        style={{ fontSize: "15px", color: "rgb(24,44,62)", fontWeight: 700 }}
      >
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <div style={{ height: "1px", background: "rgba(180,204,232,0.45)" }} />;
}
