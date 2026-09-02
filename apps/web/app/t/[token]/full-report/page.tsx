// apps/web/app/t/[token]/full-report/page.tsx
//
// Report 2 — the Inevitable Standard Full Diagnostic Report. Reached from the
// Diagnostic Snapshot's "Explore Your Full Revenue-To-Freedom Pathway" CTA
// (/t/<token>/full-report?tid=<tid>). The client fetches the same
// /api/public/test/[token]/result endpoint the snapshot uses, which already
// gates on the test being an Inevitable Standard test and errors gracefully
// otherwise.
import InevitableStandardFullDiagnosticClient from "./InevitableStandardFullDiagnosticClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function InevitableStandardFullReportPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams?: { tid?: string };
}) {
  return (
    <InevitableStandardFullDiagnosticClient
      token={params.token}
      tid={typeof searchParams?.tid === "string" ? searchParams.tid : ""}
    />
  );
}
