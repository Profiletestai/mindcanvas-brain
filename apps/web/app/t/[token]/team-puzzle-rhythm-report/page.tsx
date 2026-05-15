// apps/web/app/t/[token]/team-puzzle-rhythm-report/page.tsx
import TeamPuzzleRhythmReportClient from "./TeamPuzzleRhythmReportClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function TeamPuzzleRhythmReportPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams?: { tid?: string; src?: string };
}) {
  return (
    <TeamPuzzleRhythmReportClient
      token={params.token}
      tid={typeof searchParams?.tid === "string" ? searchParams.tid : ""}
      src={typeof searchParams?.src === "string" ? searchParams.src : ""}
    />
  );
}