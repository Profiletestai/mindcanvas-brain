import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/_lib/supabaseAdmin";
import { signupSchema } from "@/app/(v2)/onboarding/v2/_lib/schema";

export const dynamic = "force-dynamic";

async function findUserByEmail(email: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    "";
  const res = await fetch(
    `${url}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
    {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    }
  );
  if (!res.ok) return null;
  const json = (await res.json()) as {
    users?: Array<{ id: string; email?: string; email_confirmed_at?: string | null }>;
  };
  const match = (json.users || []).find(
    (u) => (u.email || "").toLowerCase() === email
  );
  return match ?? null;
}

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
