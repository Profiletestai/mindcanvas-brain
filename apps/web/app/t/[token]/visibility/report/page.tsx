//apps/web/app/t/[token]/visibility/report/page.tsx
import VisibilityReportClient from "./VisibilityReportClient";

export const dynamic = "force-dynamic";

export default function VisibilityReportPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams?: { tid?: string; src?: string };
}) {
  const tid = typeof searchParams?.tid === "string" ? searchParams.tid : "";
  const src = typeof searchParams?.src === "string" ? searchParams.src : "";
  return <VisibilityReportClient token={params.token} tid={tid} src={src} />;
}