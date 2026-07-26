"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PLAN_CARDS } from "@/app/(v2)/choose-plan/planContent";
import { api, isErr } from "../_lib/api";
import { StepCard } from "../_components/StepCard";
import { WELCOME_PATH } from "../_lib/progress";
import { engineListLabel, type EngineKey } from "../_lib/engines";
import type { PortalOrg } from "@/types/database.types";

type Summary = {
  engines: EngineKey[];
  tier: number | null;
  /** Allocated, not remaining — this screen reports what the plan includes. */
  trialTests: number;
};

export default function OrganisationCreatedPage() {
  const router = useRouter();
  const [org, setOrg] = useState<PortalOrg | null>(null);
  const [summary, setSummary] = useState<Summary>({
    engines: [],
    tier: null,
    trialTests: 0,
  });
  const [ready, setReady] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [orgRes, planRes, trialRes] = await Promise.all([
        api.getOrg(),
        api.getPlanSelection(),
        api.getTrials(),
      ]);
      if (cancelled) return;

      if (!isErr(orgRes) && orgRes.org) setOrg(orgRes.org);

      const selection = !isErr(planRes) ? planRes.selection : null;
      setSummary({
        engines: selection?.engines ?? [],
        tier: selection?.tier ?? null,
        trialTests: !isErr(trialRes) ? trialRes.total_allocated : 0,
      });
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onContinue() {
    setAdvancing(true);
    const res = await api.completeStep(6);
    if (isErr(res)) {
      setAdvancing(false);
      return;
    }
    router.push(WELCOME_PATH);
  }

  if (!ready) {
    return <div className="py-8 text-center text-white/70">Loading…</div>;
  }

  const tierName =
    PLAN_CARDS.find((c) => c.tier === summary.tier)?.name ??
    (summary.tier ? `Tier ${summary.tier}` : null);

  return (
    <StepCard
      titleNoWrap={false}
      title={
        <>
          Organisation{" "}
          <span style={{ color: "rgb(84, 175, 224)" }}>Created</span>
        </>
      }
      subtitle={`${org?.name ?? "Your organisation"} is ready to go.`}
    >
      <div
        className="mt-8 rounded-[18px] border"
        style={{
          background: "#fff",
          borderColor: "rgb(228,238,248)",
          padding: "24px",
          boxShadow: "0px 2px 12px 0px rgba(13,45,94,0.06)",
        }}
      >
        <div
          className="rounded-[14px] border"
          style={{
            background: "rgb(240,246,255)",
            borderColor: "rgb(208,224,240)",
            padding: "20px 24px",
          }}
        >
          <Row label="Engines" value={engineListLabel(summary.engines) || "—"} />
          <Divider />
          <Row label="Subscription" value={tierName ? `${tierName} plan` : "—"} />
          <Divider />
          <Row label="Billing frequency" value="Monthly" />
          <Divider />
          <Row label="Trial tests included" value={String(summary.trialTests)} />
        </div>

        <button
          type="button"
          onClick={onContinue}
          disabled={advancing}
          className={`mt-6 w-full h-[54px] rounded-[12px] text-white font-bold tracking-wide ${
            advancing ? "cursor-not-allowed opacity-40" : "cursor-pointer"
          }`}
          style={{
            background:
              "linear-gradient(180deg, rgb(6,94,144) 0%, rgb(42,137,190) 100%)",
            fontSize: "15px",
            letterSpacing: "0.2px",
            boxShadow: "0px 4px 16px 0px rgba(37,99,200,0.35)",
          }}
        >
          {advancing ? "Loading…" : "Continue to MindCanvas"}
        </button>
      </div>
    </StepCard>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span style={{ fontSize: "14px", color: "rgb(154,176,200)" }}>{label}</span>
      <span
        className="text-right"
        style={{ fontSize: "14px", color: "rgb(90,122,158)" }}
      >
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <div style={{ height: "1px", background: "rgba(180,204,232,0.45)" }} />;
}
