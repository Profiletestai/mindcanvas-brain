import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/_lib/supabaseAdmin";
import { signupSchema } from "@/app/(v2)/onboarding/v2/_lib/schema";
import { findUserByEmail } from "@/app/_lib/findUserByEmail";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => ({}));
    const parsed = signupSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const { first_name, last_name, email } = parsed.data;

    const admin = supabaseAdmin();

    const existing = await findUserByEmail(email);
    if (existing?.email_confirmed_at) {
      return NextResponse.json(
        { ok: false, error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const { error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: { first_name, last_name },
    });

    // 422 = user already exists (unverified) — idempotent, continue to OTP send.
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
