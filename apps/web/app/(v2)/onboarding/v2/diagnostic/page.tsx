"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, isErr } from "../_lib/api";
import { StepCard } from "../_components/StepCard";
import { dashboardPath } from "../_lib/progress";
import type { EngineKey } from "../_lib/engines";

type DiagnosticRecommendation = {
  eyebrow: string;
  name: string;
  description: string;
  tags: string[];
};

const RECOMMENDATIONS: Record<EngineKey, DiagnosticRecommendation> = {
  sales: {
    eyebrow: "Recommended · Predictive Growth Intelligence",
    name: "Growth Engine Diagnostic",
    description:
      "Discover where your current growth model is strongest, where progress may be blocked and how MindCanvas can support your next stage.",
    tags: ["Approximately 12 minutes", "Uses 1 trial test"],
  },
  coaching: {
    eyebrow: "Recommended · Coaching Engine",
    name: "MindCanvas Profiling System",
    description:
      "Experience how MindCanvas reveals thinking, communication, decision-making and action patterns for a more personalised coaching journey.",
    tags: ["Behaviour profile", "Coaching insight", "Personalised report"],
  },
  people: {
    eyebrow: "Recommended · People Engine",
    name: "MindCanvas Alignment System",
    description:
      "See how MindCanvas identifies natural operating style, role alignment and the conditions in which a person is most likely to thrive.",
    tags: ["Operating style", "Role alignment", "Personalised report"],
  },
};

export default function DiagnosticPage() {
  const router = useRouter();
  const [recommendation, setRecommendation] =
    useState<DiagnosticRecommendation>(RECOMMENDATIONS.sales);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState<"start" | "skip" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await api.getPlanSelection();
      if (cancelled) return;
      if (!isErr(res)) {
        const firstEngine = res.selection?.engines[0];
        if (firstEngine) setRecommendation(RECOMMENDATIONS[firstEngine]);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function finish(destination: "start" | "skip") {
    if (pending) return;
    setPending(destination);
    setError("");
    const res = await api.completeStep(10);
    if (isErr(res)) {
      setError(res.error);
      setPending(null);
      return;
    }

    if (destination === "start" && res.org_slug) {
      router.push(`/portal/${encodeURIComponent(res.org_slug)}/tests`);
      return;
    }
    router.push(dashboardPath(res.org_slug));
  }

  if (!ready) {
    return <div className="py-8 text-center text-white/70">Loading…</div>;
  }

  return (
    <StepCard
      titleNoWrap={false}
      title={
        <>
          Complete your first{" "}
          <span style={{ color: "rgb(84, 175, 224)" }}>diagnostic</span>
        </>
      }
      subtitle="Start with the recommended diagnostic below and experience MindCanvas from a test taker’s perspective."
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
        <p
          className="font-bold uppercase"
          style={{
            color: "rgb(42,137,190)",
            fontSize: "10px",
            lineHeight: "16px",
            letterSpacing: "1px",
          }}
        >
          {recommendation.eyebrow}
        </p>

        <h3
          className="mt-2 font-bold"
          style={{
            color: "rgb(24,44,62)",
            fontSize: "24px",
            lineHeight: "30px",
          }}
        >
          {recommendation.name}
        </h3>

        <p
          className="mt-3"
          style={{
            color: "rgb(90,122,158)",
            fontSize: "13px",
            lineHeight: "21px",
          }}
        >
          {recommendation.description}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {recommendation.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border px-3 py-1"
              style={{
                background: "rgb(240,246,255)",
                borderColor: "rgb(208,224,240)",
                color: "rgb(90,122,158)",
                fontSize: "10px",
                fontWeight: 700,
              }}
            >
              {tag}
            </span>
          ))}
        </div>

        {error && (
          <p className="mt-4 text-sm text-rose-500" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => finish("start")}
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
          {pending === "start" ? "Loading…" : "Start diagnostic"}
        </button>

        <button
          type="button"
          onClick={() => finish("skip")}
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
          {pending === "skip" ? "Loading…" : "Skip for now"}
        </button>
      </div>
    </StepCard>
  );
}