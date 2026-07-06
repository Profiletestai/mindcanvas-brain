// apps/web/app/portal/[slug]/profile/billing/page.tsx
// Profile → Billing (mockup: static figures; real billing lives at /portal/billing).
import { ProfileShell, primaryBtnClass, ghostBtnClass } from "../_components/ui";
import { PortalCard } from "@/components/portal/PortalCard";
import { Badge } from "@/components/portal/Badge";
import { sectionLabelClass } from "@/components/portal/ui";

export const dynamic = "force-dynamic";

const detailRows: { label: string; value: React.ReactNode }[] = [
  {
    label: "Current plan",
    value: (
      <span className="inline-flex items-center gap-2">
        Starter — up to 10 submissions/mo
        <Badge tone="emerald">Active</Badge>
      </span>
    ),
  },
  { label: "Monthly price", value: <span className="text-[#54AFE0]">$197.00 / month</span> },
  { label: "Included submissions", value: "10 per month" },
  { label: "Used this month", value: <span className="text-amber-400">8 of 10</span> },
  { label: "Additional credits", value: <span className="text-emerald-400">+5 credits available</span> },
  { label: "Reset date", value: "1 June 2026" },
  { label: "Card on file", value: "Visa •••• 4242 · Exp 08/27" },
  { label: "Billing contact", value: "billing@acmeconsulting.com" },
];

const usageLevels = [
  { name: "Starter", sub: "Up to 10 submissions/mo", price: "$147/mo", current: true },
  { name: "Pro", sub: "Up to 35 submissions/mo", price: "$347/mo", current: false },
  { name: "Niche", sub: "Up to 50 submissions/mo", price: "$547/mo", current: false },
  { name: "Enterprise", sub: "Custom volume and terms", price: "$997/mo", current: false },
];

const invoices = [
  { month: "May 2026", detail: "Growth plan · 18 submissions used", amount: "$197.00" },
  { month: "April 2026", detail: "Growth plan · 23 submissions used", amount: "$197.00" },
  { month: "March 2026", detail: "Growth plan · 11 submissions used", amount: "$197.00" },
  { month: "February 2026", detail: "Growth plan · First billing month", amount: "$197.00" },
];

export default function Page() {
  return (
    <ProfileShell>
      {/* Status banner */}
      <div className="flex items-center justify-between gap-4 rounded-[20px] border border-emerald-500/[0.22] bg-emerald-500/10 p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </span>
          <div>
            <p className="text-[14px] font-bold text-emerald-400">Billing active</p>
            <p className="text-[12.5px] text-white/50">
              Growth plan · Card ••••4242 on file · Next charge 1 June 2026
            </p>
          </div>
        </div>
        <button type="button" className={ghostBtnClass} disabled>
          Manage billing
        </button>
      </div>

      {/* Billing details */}
      <PortalCard title="Billing details">
        <div className="divide-y divide-white/[0.06]">
          {detailRows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-4 py-3">
              <span className="text-[13px] text-white/50">{r.label}</span>
              <span className="text-right text-[13.5px] font-semibold text-white">{r.value}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button type="button" className={ghostBtnClass} disabled>
            Update card
          </button>
          <button type="button" className={primaryBtnClass} disabled>
            Upgrade to Pro
          </button>
        </div>

        {/* Choose usage level */}
        <p className={`mt-8 mb-3 ${sectionLabelClass}`}>Choose usage level</p>
        <div className="space-y-3">
          {usageLevels.map((l) => (
            <div
              key={l.name}
              className={[
                "flex items-center justify-between rounded-2xl border px-5 py-4",
                l.current
                  ? "border-emerald-500/50 bg-emerald-500/[0.06]"
                  : "border-white/[0.08] bg-white/[0.02]",
              ].join(" ")}
            >
              <div>
                <p className="flex items-center gap-2 text-[15px] font-bold text-white">
                  {l.name}
                  {l.current && <Badge tone="emerald">Current</Badge>}
                </p>
                <p className="text-[12.5px] text-white/40">{l.sub}</p>
              </div>
              <span className="text-[15px] font-bold text-[#54AFE0]">{l.price}</span>
            </div>
          ))}
        </div>
      </PortalCard>

      {/* Invoices */}
      <PortalCard title="Invoices" description="Your billing history." bodyClassName="mt-4">
        <div className="divide-y divide-white/[0.06]">
          {invoices.map((inv) => (
            <div key={inv.month} className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="text-[14px] font-semibold text-white">{inv.month}</p>
                <p className="text-[12.5px] text-white/40">{inv.detail}</p>
              </div>
              <div className="flex items-center gap-5">
                <span className="text-[14px] font-semibold text-white">{inv.amount}</span>
                <span className="cursor-not-allowed text-[13px] font-medium text-[#54AFE0]/70">
                  Download PDF
                </span>
              </div>
            </div>
          ))}
        </div>
      </PortalCard>
    </ProfileShell>
  );
}
