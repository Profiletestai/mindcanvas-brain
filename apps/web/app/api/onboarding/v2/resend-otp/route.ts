//apps/web/app/api/onboarding/v2/resend-otp/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/_lib/supabaseAdmin";
import { emailSchema } from "@/app/(v2)/onboarding/v2/_lib/schema";
import { findUserByEmail } from "@/app/_lib/findUserByEmail";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => ({}));

    const parsed = emailSchema.safeParse(raw?.email);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: parsed.error.issues[0]?.message ?? "Invalid email address",
        },
        { status: 400 }
      );
    }

    const email = parsed.data;
    const existingUser = await findUserByEmail(email);

    if (!existingUser) {
      return NextResponse.json(
        {
          ok: false,
          error: "We could not find a signup for this email address.",
        },
        { status: 404 }
      );
    }

    if (existingUser.email_confirmed_at) {
      return NextResponse.json(
        {
          ok: false,
          error: "This email address has already been verified.",
        },
        { status: 409 }
      );
    }

    const admin = supabaseAdmin();

    const { error } = await admin.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      },
    });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "A new verification code has been sent.",
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unexpected error";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}