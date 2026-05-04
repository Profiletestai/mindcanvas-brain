"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, inputClass } from "../_components/Field";
import { PhoneField } from "../_components/PhoneField";
import { api, isErr } from "../_lib/api";
import { isEmail } from "../_lib/schema";

export default function ContactPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [notifEmail, setNotifEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const orgRes = await api.getOrg();
      if (cancelled) return;
      if (!isErr(orgRes) && orgRes.org) {
        const o = orgRes.org;
        setFirst(o.primary_contact_first_name ?? "");
        setLast(o.primary_contact_last_name ?? "");
        setEmail(o.primary_contact_email ?? "");
        setPhone(o.phone_number ?? "");
        setSupportEmail(o.support_email ?? "");
        setNotifEmail(o.notification_email ?? "");
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
    if (!first.trim() || !last.trim() || !email.trim()) {
      setErr("Contact first name, last name, and email are required.");
      return;
    }
    if (!isEmail(email)) {
      setErr("Please enter a valid contact email.");
      return;
    }
    if (supportEmail.trim() && !isEmail(supportEmail)) {
      setErr("Support email is not valid.");
      return;
    }
    if (notifEmail.trim() && !isEmail(notifEmail)) {
      setErr("Notification email is not valid.");
      return;
    }
    setBusy(true);
    const finalSupport = supportEmail.trim() || email.trim();
    const finalNotif = notifEmail.trim() || email.trim();
    const res = await api.patchContact({
      contact_first_name: first.trim(),
      contact_last_name: last.trim(),
      contact_email: email.trim().toLowerCase(),
      phone_number: phone || undefined,
      support_email: finalSupport.toLowerCase(),
      notification_email: finalNotif.toLowerCase(),
    });
    setBusy(false);
    if (isErr(res)) {
      setErr(res.error);
      return;
    }
    router.push("/onboarding/v2/plan");
  };

  if (!ready) return <div className="py-8 text-center text-white/70">Loading…</div>;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-center">Primary contact details</h1>
      <p className="mt-2 text-center text-sm text-white/70">
        Add the main contact details for this organisation.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Contact first name" required>
            <input
              className={inputClass}
              value={first}
              onChange={(e) => setFirst(e.target.value)}
            />
          </Field>
          <Field label="Contact last name" required>
            <input
              className={inputClass}
              value={last}
              onChange={(e) => setLast(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Contact email" required>
          <input
            type="email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <Field label="Phone number">
          <PhoneField value={phone} onChange={setPhone} />
        </Field>

        <Field label="Support email" hint="Defaults to contact email if blank.">
          <input
            type="email"
            className={inputClass}
            value={supportEmail}
            onChange={(e) => setSupportEmail(e.target.value)}
          />
        </Field>

        <Field label="Notification email" hint="Defaults to contact email if blank.">
          <input
            type="email"
            className={inputClass}
            value={notifEmail}
            onChange={(e) => setNotifEmail(e.target.value)}
          />
        </Field>

        {err && <div className="text-sm text-rose-400">{err}</div>}

        <div className="flex flex-col-reverse sm:flex-row gap-3">
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => router.push("/onboarding/v2/organisation")}
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
