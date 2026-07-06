// apps/web/app/portal/[slug]/profile/checklist/page.tsx
// Profile → Setup checklist (mockup: static, all items complete).
import { ProfileShell, ProfileCard } from "../_components/ui";

export const dynamic = "force-dynamic";

const items = [
  "Account created",
  "Email verified",
  "Organisation created",
  "Logo uploaded",
  "First diagnostic completed",
  "Onboarding session booked",
  "First test link created",
  "Billing set up",
  "Community joined",
];

export default function Page() {
  return (
    <ProfileShell>
      <ProfileCard
        title="Setup checklist"
        description="Your MindCanvas account is fully set up."
      >
        <div className="rounded-2xl border border-emerald-500/[0.22] bg-emerald-500/10 px-5 py-4">
          <p className="text-[14px] font-bold text-emerald-400">
            🎉 All done — {items.length} of {items.length} complete
          </p>
          <p className="text-[12.5px] text-white/50">
            Your account is fully configured and live.
          </p>
        </div>

        <ul className="mt-5 divide-y divide-white/[0.06]">
          {items.map((label) => (
            <li key={label} className="flex items-center gap-3 py-3">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </span>
              <span className="text-[14px] text-white/80">{label}</span>
            </li>
          ))}
        </ul>
      </ProfileCard>
    </ProfileShell>
  );
}
