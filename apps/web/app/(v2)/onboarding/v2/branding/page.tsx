"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ColorSwatch } from "../_components/ColorSwatch";
import { api, isErr } from "../_lib/api";

const DEFAULTS = {
  primary: "#2d8fc4",
  secondary: "#64bae2",
  background: "#0b1324",
  text: "#ffffff",
};

export default function BrandingPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [primary, setPrimary] = useState(DEFAULTS.primary);
  const [secondary, setSecondary] = useState(DEFAULTS.secondary);
  const [background, setBackground] = useState(DEFAULTS.background);
  const [text, setText] = useState(DEFAULTS.text);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const orgRes = await api.getOrg();
      if (cancelled) return;
      if (!isErr(orgRes) && orgRes.org) {
        const o = orgRes.org;
        if (o.brand_primary) setPrimary(o.brand_primary);
        if (o.brand_secondary) setSecondary(o.brand_secondary);
        if (o.brand_background) setBackground(o.brand_background);
        if (o.brand_text) setText(o.brand_text);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const submit = async (skip: boolean) => {
    setErr(null);
    setBusy(true);
    const body = skip
      ? {}
      : {
          primary_colour: primary,
          secondary_colour: secondary,
          background_colour: background,
          text_colour: text,
        };
    const res = await api.patchBranding(body);
    setBusy(false);
    if (isErr(res)) {
      setErr(res.error);
      return;
    }
    router.push("/onboarding/v2/welcome");
  };

  if (!ready) return <div className="py-8 text-center text-white/70">Loading…</div>;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-center">Branding settings</h1>
      <p className="mt-2 text-center text-sm text-white/70">
        Set the basic colours for your organisation. This can be updated later.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(false);
        }}
        className="mt-8 space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ColorSwatch label="Primary colour" value={primary} onChange={setPrimary} />
          <ColorSwatch label="Secondary colour" value={secondary} onChange={setSecondary} />
          <ColorSwatch label="Background colour" value={background} onChange={setBackground} />
          <ColorSwatch label="Text colour" value={text} onChange={setText} />
        </div>

        {err && <div className="text-sm text-rose-400">{err}</div>}

        <div className="flex flex-col-reverse sm:flex-row gap-3">
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => router.push("/onboarding/v2/plan")}
            className="sm:w-1/4"
          >
            Back
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => submit(true)}
            className="sm:w-1/4"
          >
            Skip for now
          </Button>
          <Button type="submit" disabled={busy} className="flex-1">
            {busy ? "Saving…" : "Save and continue"}
          </Button>
        </div>
      </form>
    </div>
  );
}
