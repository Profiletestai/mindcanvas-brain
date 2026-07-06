// apps/web/hooks/useOrgProfile.ts
// Loads + saves the portal org profile (GET/PATCH /api/portal/org/profile).
// Shared by the Profile → Organisation and Email settings forms.
"use client";

import { useCallback, useEffect, useState } from "react";
import type { OrgSettings } from "@/types/orgSettings";

export function useOrgProfile(slug: string) {
  const [org, setOrg] = useState<OrgSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/portal/org/profile?slug=${slug}`);
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.error || "Failed to load organisation");
        if (!cancelled) setOrg(json.org);
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Something went wrong");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Optimistically patch a single field in local state.
  const update = useCallback(
    <K extends keyof OrgSettings>(key: K, value: OrgSettings[K]) => {
      setOrg((prev) => (prev ? { ...prev, [key]: value } : prev));
      setSaved(false);
    },
    [],
  );

  // Persist the given subset of fields (id is attached automatically).
  const save = useCallback(
    async (fields: Partial<OrgSettings>) => {
      if (!org) return;
      setBusy(true);
      setError(null);
      setSaved(false);
      try {
        const res = await fetch("/api/portal/org/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: org.id, ...fields }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.error || "Failed to save");
        setOrg(json.org);
        setSaved(true);
      } catch (e: any) {
        setError(e.message || "Something went wrong");
      } finally {
        setBusy(false);
      }
    },
    [org],
  );

  return { org, busy, error, saved, update, save };
}
