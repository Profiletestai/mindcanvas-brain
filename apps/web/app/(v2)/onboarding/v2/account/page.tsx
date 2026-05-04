"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, inputClass } from "../_components/Field";
import { api, isErr } from "../_lib/api";
import { isEmail } from "../_lib/schema";

export default function AccountPage() {
  const router = useRouter();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!first.trim() || !last.trim() || !email.trim()) {
      setErr("All fields are required.");
      return;
    }
    if (!isEmail(email)) {
      setErr("Please enter a valid email address.");
      return;
    }
    setBusy(true);
    const res = await api.signup({
      first_name: first.trim(),
      last_name: last.trim(),
      email: email.trim().toLowerCase(),
    });
    setBusy(false);
    if (isErr(res)) {
      setErr(res.error);
      return;
    }
    sessionStorage.setItem("onb_email", email.trim().toLowerCase());
    sessionStorage.setItem("onb_first_name", first.trim());
    sessionStorage.setItem("onb_last_name", last.trim());
    router.push("/onboarding/v2/verify");
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-center">Create your account</h1>
      <p className="mt-2 text-center text-sm text-white/70">
        Let&apos;s get your organisation set up.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="First name" required>
            <input
              className={inputClass}
              value={first}
              onChange={(e) => setFirst(e.target.value)}
              autoComplete="given-name"
            />
          </Field>
          <Field label="Last name" required>
            <input
              className={inputClass}
              value={last}
              onChange={(e) => setLast(e.target.value)}
              autoComplete="family-name"
            />
          </Field>
        </div>
        <Field
          label="Email"
          required
          hint="We'll send a one-time verification code to your email."
        >
          <input
            type="email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </Field>

        {err && <div className="text-sm text-rose-400">{err}</div>}

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Sending…" : "Send verification code"}
        </Button>
      </form>
    </div>
  );
}
