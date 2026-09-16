// apps/web/app/admin/referrals/reconciliations/page.tsx

import ReconciliationClient from "./ReconciliationClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ReferralReconciliationsPage() {
  return <ReconciliationClient />;
}