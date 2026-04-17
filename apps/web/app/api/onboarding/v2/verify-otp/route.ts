import { NextResponse } from "next/server";
import { getServerSupabase } from "@/app/_lib/portal";
import type { VerifyOtpRequestBody } from "../_lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body: Partial<VerifyOtpRequestBody> = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();
    const token = String(body?.token || "").trim();

    if (!email || !token) {
      return NextResponse.json(
        { ok: false, error: "email and token are required" },
        { status: 400 }
      );
    }

    const sb = await getServerSupabase();
    const { data, error } = await sb.auth.verifyOtp({ email, token, type: "email" });

    if (error || !data?.user) {
      return NextResponse.json(
        { ok: false, error: "Invalid or expired code" },
        { status: 401 }
      );
    }

    return NextResponse.json({ ok: true, user_id: data.user.id });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
