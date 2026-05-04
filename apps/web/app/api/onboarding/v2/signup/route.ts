import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/_lib/supabaseAdmin";
import type { SignupRequestBody } from "../_lib/types";

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
