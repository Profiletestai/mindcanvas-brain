// apps/web/app/admin/referrals/page.tsx

import ReferralDashboardClient from "./ReferralDashboardClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ReferralDashboardPage() {
  return <ReferralDashboardClient />;
}