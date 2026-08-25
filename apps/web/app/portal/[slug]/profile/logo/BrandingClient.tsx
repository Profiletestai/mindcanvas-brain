"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { FormStatus } from "@/components/portal/FormStatus";
import { useOrgProfile } from "@/hooks/useOrgProfile";
import { Field, ProfileCard, ProfileShell, ghostBtnClass, inputClass, primaryBtnClass } from "../_components/ui";

const FALLBACKS = { brand_primary: "#0F172A", brand_secondary: "#38BDF8", brand_accent: "#22C55E", brand_text: "#FFFFFF" };

export default function BrandingClient({ slug }: { slug: string }) {
  const { org, busy, error, saved, update, save } = useOrgProfile(slug);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    if (!org) return;
    if (file.size > 2 * 1024 * 1024) { setUploadError("Logo must be 2MB or smaller."); return; }
    setUploading(true); setUploadError(null);
    try {
      const form = new FormData(); form.append("file", file); form.append("orgId", org.id);
      const response = await fetch("/api/branding/logo", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || "Logo upload failed");
      update("logo_url", data.url);
      await save({ logo_url: data.url });
    } catch (cause) { setUploadError(cause instanceof Error ? cause.message : "Logo upload failed"); }
    finally { setUploading(false); if (input.current) input.current.value = ""; }
  }

  function saveColours() {
    if (!org) return;
    void save({ brand_primary: org.brand_primary, brand_secondary: org.brand_secondary, brand_accent: org.brand_accent, brand_text: org.brand_text });
  }

  return <ProfileShell title="Branding" subtitle="Your logo and colours appear on public test pages, reports and automated emails.">
    <FormStatus error={error || uploadError} saved={saved} />
    <ProfileCard title="Organisation logo" description="Use a transparent PNG or SVG, maximum 2MB.">
      <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white p-6">
        {org?.logo_url ? <Image src={org.logo_url} alt={`${org.name} logo`} width={320} height={120} className="max-h-28 w-auto object-contain" unoptimized /> : <p className="text-sm text-slate-500">Upload your logo</p>}
      </div>
      <input ref={input} type="file" accept="image/png,image/svg+xml,image/jpeg" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); }} />
      <div className="mt-4 flex gap-3"><button type="button" className={primaryBtnClass} disabled={!org || uploading} onClick={() => input.current?.click()}>{uploading ? "Uploading…" : org?.logo_url ? "Replace" : "Upload logo"}</button>{org?.logo_url && <button type="button" className={ghostBtnClass} disabled={busy} onClick={() => { update("logo_url", null); void save({ logo_url: null }); }}>Remove</button>}</div>
      {org && <div className="mt-6 grid gap-4 md:grid-cols-2"><div className="flex h-24 items-center justify-center rounded-xl bg-white p-4">{org.logo_url ? <Image src={org.logo_url} alt="Light contrast preview" width={180} height={60} className="max-h-14 w-auto" unoptimized /> : <span className="text-xs font-bold text-slate-900">{org.name}</span>}</div><div className="flex h-24 items-center justify-center rounded-xl bg-[#06182a] p-4">{org.logo_url ? <Image src={org.logo_url} alt="Dark contrast preview" width={180} height={60} className="max-h-14 w-auto" unoptimized /> : <span className="text-xs font-bold text-white">{org.name}</span>}</div></div>}
    </ProfileCard>
    <ProfileCard title="Brand colours" description="Used for buttons, headings and client-facing accents.">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">{(["brand_primary", "brand_secondary", "brand_accent", "brand_text"] as const).map((key) => <Field key={key} label={key.replace("brand_", "")} htmlFor={key}><div className="flex gap-2"><input type="color" className="h-10 w-12 rounded border-0 bg-transparent" value={org?.[key] || FALLBACKS[key]} disabled={!org} onChange={(e) => update(key, e.target.value.toUpperCase())} /><input id={key} className={inputClass} value={org?.[key] || FALLBACKS[key]} disabled={!org} onChange={(e) => update(key, e.target.value)} /></div></Field>)}</div>
      <div className="mt-6"><button type="button" className={primaryBtnClass} disabled={!org || busy} onClick={saveColours}>{busy ? "Saving…" : "Save changes"}</button></div>
    </ProfileCard>
    {org && <ProfileCard title="Where your branding appears" description="Live previews using the colours above."><div className="grid gap-4 lg:grid-cols-3"><div className="rounded-xl bg-white p-5 text-slate-900"><p className="text-xs font-bold">{org.name}</p><p className="mt-4 text-sm font-semibold">Your assessment is ready</p><button style={{ background: org.brand_secondary || FALLBACKS.brand_secondary }} className="mt-4 rounded-lg px-3 py-2 text-xs font-semibold text-white">Start assessment</button></div><div className="rounded-xl bg-white p-5 text-slate-900"><p className="text-xs font-bold">{org.name}</p><p className="mt-4 text-sm font-semibold">Your strategic report</p><div style={{ background: org.brand_secondary || FALLBACKS.brand_secondary }} className="mt-5 h-1 rounded-full" /></div><div className="rounded-xl bg-white p-5 text-slate-900"><p className="text-xs font-bold">{org.name}</p><p className="mt-4 text-sm font-semibold">Your report is ready</p><p className="mt-2 text-xs text-slate-500">Thanks for completing your assessment.</p></div></div></ProfileCard>}
  </ProfileShell>;
}
