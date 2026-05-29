// apps/web/app/api/admin/mcas/test-lab/create/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const title = String(body?.title || body?.job_title || "").trim();

    const description = String(
      body?.description || body?.job_description || ""
    ).trim();

    if (!title) {
      return NextResponse.json(
        { ok: false, error: "Job title is required" },
        { status: 400 }
      );
    }

    const token = base64UrlEncode(
      JSON.stringify({
        title,
        job_title: title,
        description,
        job_description: description,
        created_at: new Date().toISOString(),
        source: "mcas_internal_test_lab",
      })
    );

    return NextResponse.json({
      ok: true,
      run_id: token,
      url: `/admin/mcas/test-lab/${token}`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}
