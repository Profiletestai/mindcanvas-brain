"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { api, isErr } from "../_lib/api";
import { getPlan, type PlanTier } from "../_lib/plans";
import type { PortalOrg } from "@/types/database.types";

type OrgStatus = "pending_activation" | "active" | "suspended" | "archived";

const STATUS_LABEL: Record<OrgStatus, string> = {
  pending_activation: "Pending activation",
  active: "Active",
  suspended: "Suspended",
  archived: "Archived",
};

const STATUS_STYLE: Record<OrgStatus, { bg: string; text: string; dot: string }> = {
  pending_activation: { bg: "bg-amber-500/15", text: "text-amber-300", dot: "bg-amber-400" },
  active: { bg: "bg-emerald-500/15", text: "text-emerald-300", dot: "bg-emerald-400" },
  suspended: { bg: "bg-rose-500/15", text: "text-rose-300", dot: "bg-rose-400" },
  archived: { bg: "bg-white/10", text: "text-white/60", dot: "bg-white/40" },
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

  if (!ready) return <div className="py-8 text-center text-white/70">Loading…</div>;

  const tierStr = sessionStorage.getItem("onb_tier");
  const tier = tierStr ? (Number(tierStr) as PlanTier) : null;
  const plan = getPlan(tier);

  return (
    <div className="text-center">
      <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-2xl">
        ✓
      </div>
      <h1 className="mt-4 text-2xl font-semibold">Your organisation has been created</h1>
      <p className="mt-2 text-sm text-white/70">You&apos;re all set to continue your setup.</p>

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 text-left space-y-3">
        <Row label="Organisation" value={org?.name ?? "—"} />
        <Row
          label="Status"
          value={(() => {
            const status = (org?.status as OrgStatus) ?? "pending_activation";
            const style = STATUS_STYLE[status] ?? STATUS_STYLE.pending_activation;
            const label = STATUS_LABEL[status] ?? status;
            return (
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs ${style.bg} ${style.text}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                {label}
              </span>
            );
          })()}
        />
        <Row label="Selected plan" value={plan ? `${plan.name} — ${plan.priceLabel}` : "—"} />
      </div>

      <Button
        type="button"
        onClick={() => router.push("/portal/login")}
        className="mt-6 w-full"
      >
        Continue to setup
      </Button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-white/60">{label}</span>
      <span className="text-sm text-white font-medium">{value}</span>
    </div>
  );
}
