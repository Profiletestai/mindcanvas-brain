// apps/web/app/portal/[slug]/profile/organisation/OrganisationClient.tsx
// Launch organisation fields persisted via PATCH /api/portal/org/profile.
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

export default function OrganisationClient({ slug }: { slug: string }) {
  const { org, busy, error, saved, update, save } = useOrgProfile(slug);

  function handleSave() {
    if (!org) return;
    void save({
      name: org.name,
      website_url: org.website_url,
      industry: org.industry,
      primary_contact_name: org.primary_contact_name,
      primary_contact_email: org.primary_contact_email,
    });
  }

  return (
    <ProfileShell title="Organisation" subtitle="Shared details for your organisation, reports and public test pages.">
      <ProfileCard
        title="Organisation details"
        description="Details for your main MindCanvas workspace."
      >
        <FormStatus error={error} saved={saved} />

        <Field label="Organisation name" htmlFor="org-name">
          <input
            id="org-name"
            className={inputClass}
            value={org?.name ?? ""}
            disabled={!org}
            onChange={(e) => update("name", e.target.value)}
          />
        </Field>

        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label="Website" htmlFor="org-website">
            <input
              id="org-website"
              className={inputClass}
              placeholder="https://example.com"
              value={org?.website_url ?? ""}
              disabled={!org}
              onChange={(e) => update("website_url", e.target.value)}
            />
          </Field>
          <Field label="Industry" htmlFor="org-industry"><input id="org-industry" className={inputClass} value={org?.industry ?? ""} disabled={!org} onChange={(e) => update("industry", e.target.value)} /></Field>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label="Primary contact name" htmlFor="contact-name"><input id="contact-name" className={inputClass} value={org?.primary_contact_name ?? ""} disabled={!org} onChange={(e) => update("primary_contact_name", e.target.value)} /></Field>
          <Field label="Primary contact email" htmlFor="contact-email"><input id="contact-email" type="email" className={inputClass} value={org?.primary_contact_email ?? ""} disabled={!org} onChange={(e) => update("primary_contact_email", e.target.value)} /></Field>
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
