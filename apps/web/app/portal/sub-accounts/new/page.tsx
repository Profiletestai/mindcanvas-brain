import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function SubAccountsNewIndex({
  searchParams,
}: {
  searchParams: { parentOrgId?: string };
}) {
  const qs = searchParams.parentOrgId
    ? `?parentOrgId=${encodeURIComponent(searchParams.parentOrgId)}`
    : "";
  redirect(`/portal/sub-accounts/new/organisation${qs}`);
}
