import { NextResponse } from "next/server";
import { supabaseAdmin, portalAdmin } from "@/app/_lib/supabaseAdmin";
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
    const acceptedAt = new Date().toISOString();

    const admin = supabaseAdmin();

    const existing = await findUserByEmail(email);

    if (existing?.email_confirmed_at) {
      // Block only when the user already has a fully activated org;
      // otherwise treat as resume and re-send the OTP.
      const { data: membership } = await portalAdmin()
        .from("user_orgs")
        .select("orgs(status)")
        .eq("user_id", existing.id)
        .maybeSingle<{ orgs: { status: string } | null }>();

      if (membership?.orgs?.status === "active") {
        return NextResponse.json(
          {
            ok: false,
            error: "An account with this email already exists. Please log in.",
          },
          { status: 409 }
        );
      }
    } else {
      const { error: createError } = await admin.auth.admin.createUser({
        email,
        email_confirm: false,
        user_metadata: {
          first_name,
          last_name,
          terms_accepted_at: acceptedAt,
          privacy_accepted_at: acceptedAt,
        },
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
