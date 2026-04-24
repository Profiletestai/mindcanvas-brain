import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/_lib/supabaseAdmin";
import type { SignupRequestBody } from "../_lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body: Partial<SignupRequestBody> = await req.json().catch(() => ({}));
    const first_name = String(body?.first_name || "").trim();
    const last_name = String(body?.last_name || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();

    if (!first_name || !last_name || !email) {
      return NextResponse.json(
        { ok: false, error: "first_name, last_name, and email are required" },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { ok: false, error: "Invalid email format" },
        { status: 400 }
      );
    }

    const admin = supabaseAdmin();

    const { error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: { first_name, last_name },
    });

    // 422 = user already exists — idempotent, continue to OTP send.
    const alreadyExists =
      createError?.status === 422 ||
      (createError as { code?: string } | null)?.code === "email_exists";

    if (createError && !alreadyExists) {
      return NextResponse.json(
        { ok: false, error: createError.message },
        { status: 400 }
      );
    }

    const { error: otpError } = await admin.auth.signInWithOtp({ email });

    if (otpError) {
      return NextResponse.json(
        { ok: false, error: otpError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, message: "Verification code sent" });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
