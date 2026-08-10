// apps/web/app/portal/[slug]/profile/PersonalDetailsClient.tsx
// MOCKUP — Personal details form. Inputs are typeable but nothing is persisted;
// there is no self-service user-profile endpoint yet.
"use client";

import { useState } from "react";
import {
  ProfileShell,
  ProfileCard,
  Field,
  inputClass,
  primaryBtnClass,
} from "./_components/ui";
import PreviewBanner from "./_components/PreviewBanner";

export default function PersonalDetailsClient() {
  const [firstName, setFirstName] = useState("Daniel");
  const [lastName, setLastName] = useState("Acutt");
  const [email, setEmail] = useState("daniel@company.com");
  const [password, setPassword] = useState("");

  return (
    <ProfileShell>
      <PreviewBanner note="There is no self-service profile endpoint yet, so changes are not persisted." />
      <ProfileCard title="Personal details" description="Your name and login email.">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label="First name" htmlFor="first-name">
            <input
              id="first-name"
              className={inputClass}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </Field>
          <Field label="Last name" htmlFor="last-name">
            <input
              id="last-name"
              className={inputClass}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </Field>
        </div>

        <div className="mt-5">
          <Field label="Email address" htmlFor="email">
            <input
              id="email"
              type="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
        </div>

        <div className="mt-5">
          <Field label="Change password" htmlFor="password">
            <input
              id="password"
              type="password"
              placeholder="Enter new password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
        </div>

        <div className="mt-6">
          <button type="button" className={primaryBtnClass} disabled>
            Save changes
          </button>
        </div>
      </ProfileCard>
    </ProfileShell>
  );
}
