"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, isErr } from "../_lib/api";
import { PATH_TO_STEP, pathForStep } from "../_lib/progress";

export function StepGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const expected = PATH_TO_STEP[pathname];
    if (expected === undefined) {
      setAllowed(true);
      return;
    }
    let cancelled = false;
    setAllowed(false);
    (async () => {
      const prog = await api.progress();
      if (cancelled) return;
      if (isErr(prog)) {
        if (pathname === "/onboarding/v2/account") {
          setAllowed(true);
          return;
        }
        if (
          pathname === "/onboarding/v2/verify" &&
          typeof window !== "undefined" &&
          sessionStorage.getItem("onb_email")
        ) {
          setAllowed(true);
          return;
        }
        router.replace("/onboarding/v2/account");
        return;
      }
      const currentNum = prog.step === "complete" ? 7 : prog.step;
      if (typeof expected === "number" && expected >= 3 && expected <= currentNum) {
        setAllowed(true);
        return;
      }
      if (prog.step !== expected) {
        router.replace(pathForStep(prog.step));
        return;
      }
      setAllowed(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!allowed) {
    return <div className="py-8 text-center text-white/70">Loading…</div>;
  }
  return <>{children}</>;
}
