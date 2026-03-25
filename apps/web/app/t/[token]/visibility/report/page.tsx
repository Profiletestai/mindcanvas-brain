//apps/web/app/t/[token]/visibility/report/page.tsx
import VisibilityReportClient from "./VisibilityReportClient";

export default async function Page({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams?: { tid?: string; sid?: string; src?: string };
}) {
  return (
    <VisibilityReportClient
      token={params.token}
      tid={searchParams?.tid}
      sid={searchParams?.sid}
      src={searchParams?.src}
    />
  );
}