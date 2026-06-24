"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, isErr } from "../_lib/api";
import { getPlan, type PlanTier } from "../_lib/plans";
import { StepCard } from "../_components/StepCard";
import type { PortalOrg } from "@/types/database.types";

type OrgStatus = "pending_activation" | "active" | "suspended" | "archived";

const STATUS_LABEL: Record<OrgStatus, string> = {
  pending_activation: "PENDING_ACTIVATION",
  active: "ACTIVE",
  suspended: "SUSPENDED",
  archived: "ARCHIVED",
};

const STATUS_STYLE: Record<
  OrgStatus,
  { bg: string; text: string; dot: string }
> = {
  pending_activation: {
    bg: "rgb(255,244,214)",
    text: "rgb(168,114,12)",
    dot: "rgb(214,158,46)",
  },
  active: {
    bg: "rgb(220,247,232)",
    text: "rgb(28,128,72)",
    dot: "rgb(46,168,96)",
  },
  suspended: {
    bg: "rgb(255,224,228)",
    text: "rgb(176,40,68)",
    dot: "rgb(214,62,90)",
  },
  archived: {
    bg: "rgb(228,234,244)",
    text: "rgb(90,108,134)",
    dot: "rgb(140,160,185)",
  },
};

export default function WelcomePage() {
  const router = useRouter();
  const [org, setOrg] = useState<PortalOrg | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const orgRes = await api.getOrg();
      if (cancelled) return;
      if (!isErr(orgRes)) setOrg(orgRes.org);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return <div className="py-8 text-center text-white/70">Loading…</div>;
  }

  const tierStr =
    typeof window !== "undefined" ? sessionStorage.getItem("onb_tier") : null;
  const tier = tierStr ? (Number(tierStr) as PlanTier) : null;
  const plan = getPlan(tier);
  const status = (org?.status as OrgStatus) ?? "pending_activation";
  const statusStyle = STATUS_STYLE[status] ?? STATUS_STYLE.pending_activation;
  const statusLabel = STATUS_LABEL[status] ?? status;

  return (
    <StepCard
      titleNoWrap={false}
      title={
        <>
          Your organisation has{" "}
          <br className="hidden sm:block" />
          been <span style={{ color: "rgb(84, 175, 224)" }}>created</span>
        </>
      }
      subtitle="You're all set to continue your setup."
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
            🎉
          </div>
        </div>

        <div
          className="mt-6 rounded-[14px]"
          style={{
            background: "rgb(240,246,255)",
            padding: "26px 28px",
          }}
        >
          <Row label="Organisation" value={org?.name ?? "—"} />
          <Divider />
          <Row
            label="Status"
            value={
              <span
                className="inline-flex items-center gap-1.5"
                style={{
                  background: statusStyle.bg,
                  color: statusStyle.text,
                  border: `1px solid ${statusStyle.dot}`,
                  borderRadius: "9999px",
                  padding: "5px 14px",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.5px",
                }}
              >
                <span
                  style={{
                    height: "6px",
                    width: "6px",
                    borderRadius: "9999px",
                    background: statusStyle.dot,
                  }}
                />
                {statusLabel}
              </span>
            }
          />
          <Divider />
          <Row label="Selected plan" value={plan ? plan.name : "—"} />
          <Divider />
          <Row
            label="Billing"
            value={
              <span style={{ color: "rgb(120,144,176)", fontWeight: 500 }}>
                Visible · disabled until activation
              </span>
            }
          />
        </div>

        <button
          type="button"
          onClick={() => router.push("/portal/login")}
          className="mt-6 w-full h-[60px] rounded-[14px] text-white font-bold tracking-wide cursor-pointer"
          style={{
            background:
              "linear-gradient(180deg, rgb(6,94,144) 0%, rgb(42,137,190) 100%)",
            fontSize: "16px",
            letterSpacing: "0.2px",
            boxShadow: "0px 6px 20px 0px rgba(37,99,200,0.30)",
          }}
        >
          Continue to setup
        </button>
      </div>
    </StepCard>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span
        style={{
          fontSize: "15px",
          color: "rgb(90,122,158)",
        }}
      >
        {label}
      </span>
      <span
        className="text-right"
        style={{
          fontSize: "15px",
          color: "rgb(24,44,62)",
          fontWeight: 700,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        height: "1px",
        background: "rgba(180,204,232,0.45)",
      }}
    />
  );
}
