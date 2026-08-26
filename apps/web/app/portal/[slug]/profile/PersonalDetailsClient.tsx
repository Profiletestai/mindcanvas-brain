"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FormStatus } from "@/components/portal/FormStatus";
import { Field, ProfileCard, ProfileShell, ghostBtnClass, inputClass, primaryBtnClass } from "./_components/ui";

type Account = { email: string; first_name: string; last_name: string; phone: string; job_title: string; timezone: string; avatar_url: string; email_verified: boolean };
const TIMEZONES = ["Africa/Johannesburg", "Australia/Brisbane", "Australia/Sydney", "Europe/London", "America/New_York", "America/Los_Angeles"];

export default function PersonalDetailsClient() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { void (async () => {
    try {
      const response = await fetch("/api/portal/account", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Unable to load your account");
      setAccount(data.account);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load your account"); }
    finally { setBusy(false); }
  })(); }, []);

  function update<K extends keyof Account>(key: K, value: Account[K]) {
    setAccount((current) => current ? { ...current, [key]: value } : current);
    setSaved(false);
  }

  async function save(includePassword = false) {
    if (!account) return;
    setBusy(true); setError(null); setSaved(false);
    try {
      const response = await fetch("/api/portal/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...account, password: includePassword ? password : "" }) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Unable to save your account");
      setPassword(""); setShowPassword(false); setSaved(true);
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save your account"); }
    finally { setBusy(false); }
  }

  async function uploadAvatar(file: File) {
    setBusy(true); setError(null); setSaved(false);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/portal/account/avatar", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Unable to upload profile image");
      setAccount((current) => current ? { ...current, avatar_url: data.avatar_url } : current);
      setSaved(true); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to upload profile image"); }
    finally { setBusy(false); }
  }

  async function removeAvatar() {
    setBusy(true); setError(null); setSaved(false);
    try {
      const response = await fetch("/api/portal/account/avatar", { method: "DELETE" });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Unable to remove profile image");
      setAccount((current) => current ? { ...current, avatar_url: "" } : current);
      setSaved(true); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to remove profile image"); }
    finally { setBusy(false); }
  }

  return <ProfileShell title="My account" subtitle="Your personal details. Changes affect only your own login.">
    <FormStatus error={error} saved={saved} />
    <ProfileCard title="Profile" description="How you appear to your team inside MindCanvas.">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        {account?.avatar_url ? <img src={account.avatar_url} alt="Your profile" className="h-20 w-20 rounded-full border border-white/15 object-cover" /> : <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[#54afe0]/30 bg-[#54afe0]/15 text-xl font-bold text-[#64bae2]">{`${account?.first_name?.[0] ?? ""}${account?.last_name?.[0] ?? ""}`.toUpperCase() || "U"}</div>}
        <div className="flex flex-wrap gap-3">
          <label className={`${primaryBtnClass} cursor-pointer`}><span>{busy ? "Uploading…" : account?.avatar_url ? "Replace photo" : "Upload photo"}</span><input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadAvatar(file); event.currentTarget.value = ""; }} /></label>
          {account?.avatar_url && <button type="button" className={ghostBtnClass} disabled={busy} onClick={() => void removeAvatar()}>Remove photo</button>}
        </div>
        <p className="w-full text-xs text-white/45">JPG, PNG or WebP. Maximum 2MB.</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="First name" htmlFor="first-name"><input id="first-name" className={inputClass} value={account?.first_name ?? ""} disabled={!account || busy} onChange={(e) => update("first_name", e.target.value)} /></Field>
        <Field label="Last name" htmlFor="last-name"><input id="last-name" className={inputClass} value={account?.last_name ?? ""} disabled={!account || busy} onChange={(e) => update("last_name", e.target.value)} /></Field>
        <Field label="Phone number" htmlFor="phone"><input id="phone" className={inputClass} value={account?.phone ?? ""} disabled={!account || busy} onChange={(e) => update("phone", e.target.value)} /></Field>
        <Field label="Job title" htmlFor="job-title"><input id="job-title" className={inputClass} value={account?.job_title ?? ""} disabled={!account || busy} onChange={(e) => update("job_title", e.target.value)} /></Field>
        <Field label="Time zone" htmlFor="timezone"><select id="timezone" className={inputClass} value={account?.timezone ?? "Africa/Johannesburg"} disabled={!account || busy} onChange={(e) => update("timezone", e.target.value)}>{TIMEZONES.map((zone) => <option key={zone}>{zone}</option>)}</select></Field>
      </div>
      <div className="mt-6"><button type="button" className={primaryBtnClass} disabled={!account || busy} onClick={() => void save()}>{busy ? "Saving…" : "Save changes"}</button></div>
    </ProfileCard>
    <ProfileCard title="Email address" description="The address used to sign in and receive account notifications.">
      <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-semibold text-white">{account?.email || "Loading…"}</p><p className="mt-1 text-xs text-white/45">Email changes require a separate verification flow.</p></div><span className={account?.email_verified ? "rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300" : "rounded-full bg-amber-500/15 px-3 py-1 text-xs text-amber-300"}>{account?.email_verified ? "Verified" : "Unverified"}</span></div>
    </ProfileCard>
    <ProfileCard title="Security" description="Password controls for your login.">
      {!showPassword ? <button type="button" className={ghostBtnClass} onClick={() => setShowPassword(true)}>Change password</button> : <div className="max-w-lg space-y-4"><Field label="New password" htmlFor="new-password"><input id="new-password" type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" /></Field><p className="text-xs text-white/45">Use upper-case, lower-case and at least one number.</p><div className="flex gap-3"><button type="button" className={primaryBtnClass} disabled={busy || !password} onClick={() => void save(true)}>Update password</button><button type="button" className={ghostBtnClass} onClick={() => { setPassword(""); setShowPassword(false); }}>Cancel</button></div></div>}
    </ProfileCard>
  </ProfileShell>;
}
