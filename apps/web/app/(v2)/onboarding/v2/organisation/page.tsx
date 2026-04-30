"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, inputClass, selectClass } from "../_components/Field";
import { CountrySelect } from "../_components/CountrySelect";
import { LogoUploader } from "../_components/LogoUploader";
import { api, isErr } from "../_lib/api";
import { isHttpUrl } from "../_lib/schema";
import { BILLING_REGIONS } from "../_lib/regions";

export default function OrganisationPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const orgRes = await api.getOrg();
      if (cancelled) return;
      if (!isErr(orgRes) && orgRes.org) {
        const o = orgRes.org;
        setName(o.name ?? "");
        setAddress(o.address ?? "");
        setCountry(o.country ?? "");
        setRegion(o.billing_region ?? "");
        setWebsite(o.website_url ?? "");
        setIndustry(o.industry ?? "");
        setLogoUrl(o.logo_url ?? null);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!name.trim() || !country || !region) {
      setErr("Organisation name, country, and billing region are required.");
      return;
    }
    if (website.trim() && !isHttpUrl(website)) {
      setErr("Website must be an http(s) URL.");
      return;
    }
    setBusy(true);
    const res = await api.createOrg({
      name: name.trim(),
      country,
      billing_region: region,
      address: address.trim() || undefined,
      website_url: website.trim() || undefined,
      industry: industry.trim() || undefined,
      logo_url: logoUrl || undefined,
    });
    setBusy(false);
    if (isErr(res)) {
      setErr(res.error);
      return;
    }
    router.push("/onboarding/v2/contact");
  };

  if (!ready) return <div className="py-8 text-center text-white/70">Loading…</div>;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-center">Tell us about your organisation</h1>
      <p className="mt-2 text-center text-sm text-white/70">
        Add the core details for your main organisation.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <LogoUploader value={logoUrl} onChange={setLogoUrl} />

        <Field label="Organisation name" required>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <Field label="Address">
          <input
            className={inputClass}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Country" required>
            <CountrySelect value={country} onChange={setCountry} />
          </Field>
          <Field label="Billing region" required>
            <select
              className={selectClass}
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            >
              <option value="">Select a region…</option>
              {BILLING_REGIONS.map((r) => (
                <option key={r.code} value={r.code} className="text-black">
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Website">
          <input
            type="url"
            placeholder="https://example.com"
            className={inputClass}
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </Field>

        <Field label="Industry">
          <input
            className={inputClass}
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="e.g. Healthcare, Education"
          />
        </Field>

        {err && <div className="text-sm text-rose-400">{err}</div>}

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Saving…" : "Save and continue"}
        </Button>
      </form>
    </div>
  );
}
