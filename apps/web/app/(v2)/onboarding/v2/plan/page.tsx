"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { PlanCard } from "../_components/PlanCard";
import { api, isErr } from "../_lib/api";
import { PLANS, type PlanTier } from "../_lib/plans";

export default function PlanPage() {
  const router = useRouter();
  const [tier, setTier] = useState<PlanTier>(1);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? sessionStorage.getItem("onb_tier") : null;
    if (stored) {
      const n = Number(stored);
      if (n === 1 || n === 2 || n === 3 || n === 4) setTier(n as PlanTier);
    }
    let cancelled = false;
    (async () => {
      const orgRes = await api.getOrg();
      if (cancelled) return;
      if (!isErr(orgRes) && orgRes.org) {
        if (orgRes.org.terms_accepted_at) setTerms(true);
        if (orgRes.org.privacy_accepted_at) setPrivacy(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!terms || !privacy) {
      setErr("Please accept the Terms and Privacy Policy.");
      return;
    }
    setBusy(true);
    const res = await api.patchPlan({
      tier,
      terms_accepted: true,
      privacy_accepted: true,
    });
    setBusy(false);
    if (isErr(res)) {
      setErr(res.error);
      return;
    }
    sessionStorage.setItem("onb_tier", String(tier));
    router.push("/onboarding/v2/branding");
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-center">
        Choose your starting plan
      </h1>
      <p className="mt-2 text-center text-sm text-white/70">
        Select the plan you want this organisation to start with.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PLANS.map((p) => (
            <PlanCard
              key={p.tier}
              plan={p}
              selected={tier === p.tier}
              onSelect={() => setTier(p.tier)}
            />
          ))}
        </div>

        <div className="space-y-2">
          <label className="flex items-start gap-2 text-sm text-white/80">
            <input
              type="checkbox"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              className="mt-0.5"
            />
            I accept the{" "}
            <a href="https://profiletest.ai/terms--conditions" target="_blank" className="underline">
              Terms and Conditions
            </a>
          </label>
          <label className="flex items-start gap-2 text-sm text-white/80">
            <input
              type="checkbox"
              checked={privacy}
              onChange={(e) => setPrivacy(e.target.checked)}
              className="mt-0.5"
            />
            I accept the{" "}
            <a href="https://profiletest.ai/privacy-policy" target="_blank" className="underline">
              Privacy Policy
            </a>
          </label>
        </div>

        {err && <div className="text-sm text-rose-400">{err}</div>}

        <div className="flex flex-col-reverse sm:flex-row gap-3">
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => router.push("/onboarding/v2/contact")}
            className="sm:w-1/3"
          >
            Back
          </Button>
          <Button type="submit" disabled={busy} className="flex-1">
            {busy ? "Saving…" : "Save and continue"}
          </Button>
        </div>
      </form>
    </div>
  );
}
