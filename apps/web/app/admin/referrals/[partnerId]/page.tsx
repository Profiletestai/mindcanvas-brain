// apps/web/app/admin/referrals/[partnerId]/page.tsx

import PartnerDetailClient from "./PartnerDetailClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    partnerId: string;
  }>;
};

export default async function ReferralPartnerDetailPage({
  params,
}: PageProps) {
  const { partnerId } = await params;

  return (
    <PartnerDetailClient
      partnerId={partnerId}
    />
  );
}