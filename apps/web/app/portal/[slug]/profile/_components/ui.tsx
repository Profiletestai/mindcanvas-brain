// apps/web/app/portal/[slug]/profile/_components/ui.tsx
// Profile-section shell + re-exports of the shared portal primitives.
// The card/field/button primitives now live in components/portal so the
// dashboard, tests, and other portal surfaces share them.

import type { ReactNode } from "react";
import PortalPageHeader from "@/components/portal/PortalPageHeader";
import { JAKARTA_STYLE } from "@/components/portal/ui";

export {
  labelClass,
  inputClass,
  primaryBtnClass,
  ghostBtnClass,
} from "@/components/portal/ui";
// ProfileCard kept as an alias for the shared PortalCard (existing call sites).
export { PortalCard as ProfileCard, Field } from "@/components/portal/PortalCard";

// Wraps a profile sub-page: shared "Profile" heading + section content.
export function ProfileShell({ children, title = "Profile", subtitle = "Manage your account, organisation, billing, and settings." }: { children: ReactNode; title?: string; subtitle?: string }) {
  return (
    <div style={JAKARTA_STYLE} className="space-y-6 text-slate-100">
      <PortalPageHeader
        title={title}
        subtitle={subtitle}
      />
      {children}
    </div>
  );
}
