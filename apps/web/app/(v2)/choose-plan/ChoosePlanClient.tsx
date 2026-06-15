"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, isErr } from "@/app/(v2)/onboarding/v2/_lib/api";
import { pathForStep } from "@/app/(v2)/onboarding/v2/_lib/progress";
import type { PlanCardContent } from "./planContent";
import { PlanCard, type Interval } from "./PlanCard";
import { CheckSvgIcon } from "./icons";

export type PlanCardData = PlanCardContent & {
  amountCents: number;
  selectable: boolean;
};

export function ChoosePlanClient({ cards }: { cards: PlanCardData[] }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [interval, setInterval] = useState<Interval>("month");
  const [busyTier, setBusyTier] = useState<number | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [prog, orgRes] = await Promise.all([api.progress(), api.getOrg()]);
      if (cancelled) return;
      if (isErr(prog)) {
        router.replace("/onboarding/v2/account");
        return;
      }
      if (prog.step !== "complete") {
        router.replace(pathForStep(prog.step));
        return;
      }
      if (
        !isErr(orgRes) &&
        orgRes.org &&
        orgRes.org.status !== "pending_activation"
      ) {
        router.replace("/portal/billing");
        return;
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function selectPlan(tier: number) {
    if (busyTier !== null) return;
    setBusyTier(tier);
    setErr("");
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const j = await res.json();
      if (!res.ok || !j?.url) {
        setErr(j?.error || "Could not start checkout");
        setBusyTier(null);
        return;
      }
      window.location.href = j.url as string;
    } catch (e: any) {
      setErr(String(e?.message || e));
      setBusyTier(null);
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen mc-bg flex items-center justify-center text-white/70">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen mc-bg">
      <style>{`
        @keyframes cp-rise {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div className="mx-auto max-w-[1720px] px-6 py-10 pt-[38px]">
        <header className="text-center [animation:cp-rise_480ms_ease_both]">
          <h1 className="text-[20px] font-extrabold leading-[32px] tracking-[-0.4px] text-white">
            Choose Plan
          </h1>
          <p className="mx-auto mt-[17px] max-w-[500px] text-[13px] leading-[21px] text-[rgb(148,170,196)]">
            All plans include a one-to-one onboarding call, monthly group
            coaching, your training library, and 10 kickstart free tests.
            Upgrade or change anytime.
          </p>

          <div className="mt-[34px] flex items-center justify-center gap-3">
            <span
              className={`text-[12px] leading-[19.2px] font-medium ${
                interval === "month" ? "text-[#EEF2F8]" : "text-[#3D5870]"
              }`}
            >
              Monthly
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={interval === "year"}
              aria-label="Toggle annual billing"
              disabled
              className="relative h-6 w-[42px] cursor-not-allowed rounded-full bg-[rgb(30,58,85)] opacity-50 transition-colors"
            >
              <span
                className={`absolute top-[2px] h-5 w-5 rounded-full bg-white transition-[left] duration-200 ${
                  interval === "year" ? "left-[20px]" : "left-[2px]"
                }`}
              />
            </button>
            <span
              className={`inline-flex items-center gap-2 text-[12px] leading-[19.2px] font-medium ${
                interval === "year" ? "text-[#EEF2F8]" : "text-[#3D5870]"
              }`}
            >
              Annual
              <span className="rounded-full border border-[rgba(34,197,94,0.2)] bg-[rgba(34,197,94,0.1)] px-[9px] py-[2px] text-[9px] leading-[14.4px] font-bold tracking-[0.5px] text-[#22C55E]">
                SAVE 15%
              </span>
            </span>
          </div>
        </header>

        {err && (
          <div className="mx-auto mt-8 max-w-[680px] rounded-[12px] border border-[rgba(214,62,90,0.5)] bg-[rgba(214,62,90,0.12)] px-4 py-3 text-center text-sm text-[rgb(255,170,185)]">
            {err}
          </div>
        )}

        <div className="mt-[50px] grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-[repeat(4,282px)] xl:justify-center xl:gap-3.5 items-stretch">
          {cards.map((card, i) => (
            <PlanCard
              key={card.tier}
              card={card}
              interval={interval}
              busy={busyTier === card.tier}
              disabled={busyTier !== null || !card.selectable}
              onSelect={() => selectPlan(card.tier)}
              animationDelay={120 + i * 90}
            />
          ))}
        </div>

        <div className="mx-auto mt-[34px] max-w-[648px] rounded-[12px] border border-[rgba(34,197,94,0.2)] bg-[rgba(34,197,94,0.05)] px-6 py-2.5 [animation:cp-rise_480ms_ease_520ms_both]">
          <div className="flex items-start gap-3">
            <CheckSvgIcon
              color="#22C55E"
              size={16}
              className="mt-[2px] shrink-0"
            />
            <p className="text-[12px] leading-[20.4px] text-[rgba(122,155,191,1)]">
              Your first{" "}
              <strong className="text-[rgba(238,242,248,1)]">
                10 tests are free
              </strong>{" "}
              — no payment required to get started. Billing only begins when
              you&apos;re ready to share test links with clients. You can change
              your plan at any time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
