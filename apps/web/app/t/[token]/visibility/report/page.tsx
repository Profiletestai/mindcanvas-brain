//apps/web/app/t/[token]/visibility/report/page.tsx
import { notFound } from "next/navigation";
import VisibilityReportClient from "./VisibilityReportClient";

export const dynamic = "force-dynamic";

export default function VisibilityReportPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { tid?: string; src?: string };
}) {
  const token = String(params?.token || "").trim();
  const tid = typeof searchParams?.tid === "string" ? searchParams.tid.trim() : "";
  const src =
    typeof searchParams?.src === "string" && searchParams.src.trim()
      ? searchParams.src.trim()
      : undefined;

  if (!token || !tid) {
    return notFound();
  }

  return <VisibilityReportClient token={token} tid={tid} src={src} />;
}