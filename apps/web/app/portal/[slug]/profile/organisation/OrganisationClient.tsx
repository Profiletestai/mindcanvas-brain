// apps/web/app/portal/[slug]/profile/organisation/OrganisationClient.tsx
// Organisation details. WIRED fields: name, website_url, industry (persisted via
// PATCH /api/portal/org/profile). Country & organisation type are mockup-only.
"use client";

import { useState } from "react";
import { useOrgProfile } from "@/hooks/useOrgProfile";
import { FormStatus } from "@/components/portal/FormStatus";
import {
  ProfileShell,
  ProfileCard,
  Field,
  inputClass,
  primaryBtnClass,
} from "../_components/ui";

// Mockup-only options (no backing column yet).
const COUNTRIES = ["Australia", "United Kingdom", "United States", "Canada", "New Zealand"];
const ORG_TYPES = ["Coach or consultant", "Agency", "In-house team", "Enterprise"];

// Only these two selects are mockups — the rest of the card is persisted, so
// they are labelled inline rather than banner-ing the whole page.
function PreviewHint() {
  return (
    <p className="mt-1.5 text-[11.5px] font-light text-amber-300/80">
      Preview — this field isn&apos;t saved yet.
    </p>
  );
}

export default function OrganisationClient({ slug }: { slug: string }) {
  const { org, busy, error, saved, update, save } = useOrgProfile(slug);

  // Mockup fields — not persisted.
  const [country, setCountry] = useState("Australia");
  const [orgType, setOrgType] = useState("Coach or consultant");

  function handleSave() {
    if (!org) return;
    void save({
      name: org.name,
      website_url: org.website_url,
      industry: org.industry,
    });
  }

  return (
    <ProfileShell>
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
          {/* Mockup field */}
          <Field label="Country" htmlFor="org-country">
            <select
              id="org-country"
              className={inputClass}
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <PreviewHint />
          </Field>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label="Industry" htmlFor="org-industry">
            <input
              id="org-industry"
              className={inputClass}
              value={org?.industry ?? ""}
              disabled={!org}
              onChange={(e) => update("industry", e.target.value)}
            />
          </Field>
          {/* Mockup field */}
          <Field label="Organisation type" htmlFor="org-type">
            <select
              id="org-type"
              className={inputClass}
              value={orgType}
              onChange={(e) => setOrgType(e.target.value)}
            >
              {ORG_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <PreviewHint />
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
