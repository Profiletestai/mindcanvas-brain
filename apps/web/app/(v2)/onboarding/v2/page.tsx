"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, isErr } from "./_lib/api";
import { pathForStep } from "./_lib/progress";

export default function OnboardingV2Entry() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await api.progress();
      if (cancelled) return;
      if (isErr(res)) {
        router.replace("/onboarding/v2/account");
        return;
      }
      router.replace(pathForStep(res.step, res.org_slug));
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="py-12 text-center text-white/70">Loading…</div>
  );
}
