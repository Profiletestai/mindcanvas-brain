// apps/web/app/t/[token]/report/page.tsx
import ReportGateClient from "./ReportGateClient";

export const dynamic = "force-dynamic";

export default function ReportPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams?: { tid?: string; src?: string };
}) {
  const tid = typeof searchParams?.tid === "string" ? searchParams.tid : "";
  const src = typeof searchParams?.src === "string" ? searchParams.src : "";
  return <ReportGateClient token={params.token} tid={tid} src={src} />;
}


