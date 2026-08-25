// apps/web/app/portal/[slug]/profile/email/EmailSettingsClient.tsx
// Email settings — WIRED to org-profile report sender fields:
//   From name        → report_from_name
//   Reply-to email   → report_from_email
//   Footer details   → report_footer_notes
"use client";

import { useOrgProfile } from "@/hooks/useOrgProfile";
import { FormStatus } from "@/components/portal/FormStatus";
import {
  ProfileShell,
  ProfileCard,
  Field,
  inputClass,
  primaryBtnClass,
} from "../_components/ui";

export default function EmailSettingsClient({ slug }: { slug: string }) {
  const { org, busy, error, saved, update, save } = useOrgProfile(slug);

  function handleSave() {
    if (!org) return;
    void save({
      report_from_name: org.report_from_name,
      report_from_email: org.report_from_email,
      report_footer_notes: org.report_footer_notes,
      notification_email: org.notification_email,
    });
  }

  return (
    <ProfileShell title="Email & notifications" subtitle="Control how organisation emails appear and where internal alerts are delivered.">
      <ProfileCard
        title="Email settings"
        description="How your emails appear to test takers and report recipients."
      >
        <FormStatus error={error} saved={saved} />

        <Field label="From name" htmlFor="from-name">
          <input
            id="from-name"
            className={inputClass}
            placeholder="e.g. Daniel at Acme Consulting"
            value={org?.report_from_name ?? ""}
            disabled={!org}
            onChange={(e) => update("report_from_name", e.target.value)}
          />
        </Field>

        <div className="mt-5">
          <Field label="Reply-to email" htmlFor="reply-to">
            <input
              id="reply-to"
              type="email"
              className={inputClass}
              placeholder="daniel@acmeconsulting.com"
              value={org?.report_from_email ?? ""}
              disabled={!org}
              onChange={(e) => update("report_from_email", e.target.value)}
            />
          </Field>
        </div>

        <div className="mt-5">
          <Field label="Internal notification email" htmlFor="notification-email">
            <input id="notification-email" type="email" className={inputClass} placeholder="notifications@acmeconsulting.com" value={org?.notification_email ?? ""} disabled={!org} onChange={(e) => update("notification_email", e.target.value)} />
          </Field>
          <p className="mt-2 text-xs text-white/45">New assessment completion alerts are delivered here.</p>
        </div>

        <div className="mt-5">
          <Field label="Email footer details" htmlFor="footer">
            <textarea
              id="footer"
              rows={3}
              className={inputClass}
              placeholder="e.g. Acme Consulting · Sydney, Australia · acmeconsulting.com"
              value={org?.report_footer_notes ?? ""}
              disabled={!org}
              onChange={(e) => update("report_footer_notes", e.target.value)}
            />
          </Field>
        </div>

        <div className="mt-6">
          <button
            type="button"
            className={primaryBtnClass}
            disabled={busy || !org}
            onClick={handleSave}
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </ProfileCard>
    </ProfileShell>
  );
}
