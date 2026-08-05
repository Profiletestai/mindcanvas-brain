import { NextResponse } from "next/server";
import { getServerSupabase } from "@/app/_lib/portal";
import { findUserByEmail } from "@/app/_lib/findUserByEmail";
import { emailSchema } from "@/app/(v2)/onboarding/v2/_lib/schema";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => ({}));
    const parsed = emailSchema.safeParse(raw?.email);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid email" },
        { status: 400 }
      );
    }
    const email = parsed.data;

    const existing = await findUserByEmail(email);
    if (!existing || !existing.email_confirmed_at) {
      return NextResponse.json(
        { ok: false, error: "No account found for this email" },
        { status: 401 }
      );
    }

    const sb = await getServerSupabase();
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
