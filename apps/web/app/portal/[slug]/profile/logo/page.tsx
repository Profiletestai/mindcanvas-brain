// apps/web/app/portal/[slug]/profile/logo/page.tsx
// Profile → Organisation logo (mockup: no upload pipeline wired yet).
import {
  ProfileShell,
  ProfileCard,
  primaryBtnClass,
  ghostBtnClass,
} from "../_components/ui";
import PreviewBanner from "../_components/PreviewBanner";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <ProfileShell>
      <PreviewBanner note="Logo upload is not wired up yet." />
      <ProfileCard
        title="Organisation logo"
        description="Appears across your organisation and client-facing pages."
      >
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/[0.02] px-6 py-14 text-center">
          <svg
            width="34"
            height="34"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-white/30"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
          <p className="mt-4 text-[15px] font-semibold text-white">Upload your logo</p>
          <p className="mt-1 text-[12.5px] text-white/40">
            PNG or SVG · Transparent background · 1000×400px recommended · Max 2MB
          </p>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button type="button" className={primaryBtnClass} disabled>
            Upload logo
          </button>
          <button type="button" className={ghostBtnClass} disabled>
            Remove logo
          </button>
        </div>
      </ProfileCard>
    </ProfileShell>
  );
}
