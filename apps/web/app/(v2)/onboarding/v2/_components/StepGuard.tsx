"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, isErr } from "../_lib/api";
import { decideAccess, ONB_EMAIL_KEY } from "../_lib/progress";

export function StepGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<"loading" | "allowed">("loading");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    (async () => {
      const prog = await api.progress();
      if (cancelled) return;
      const hasOnbEmail =
        typeof window !== "undefined" &&
        !!sessionStorage.getItem(ONB_EMAIL_KEY);
      const decision = decideAccess({
        pathname,
        progress: isErr(prog) ? null : prog,
        hasOnbEmail,
      });
      if (decision.kind === "redirect") {
        router.replace(decision.to);
        return;
      }
      setStatus("allowed");
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (status === "loading") {
    return <div className="py-8 text-center text-white/70">Loading…</div>;
  }
  return <>{children}</>;
}
