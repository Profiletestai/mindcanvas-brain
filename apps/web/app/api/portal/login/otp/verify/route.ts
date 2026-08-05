import { NextResponse } from "next/server";
import { getServerSupabase } from "@/app/_lib/portal";
import { resolvePostLoginNext } from "@/app/_lib/portal-postauth";
import { verifyOtpSchema } from "@/app/(v2)/onboarding/v2/_lib/schema";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => ({}));
    const parsed = verifyOtpSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const { email, token } = parsed.data;

    const sb = await getServerSupabase();
    const { data, error } = await sb.auth.verifyOtp({
      email,
      token,
      type: "email",
    });

    if (error || !data?.user) {
      return NextResponse.json(
        { ok: false, error: error?.message || "Invalid or expired code" },
        { status: 401 }
      );
    }

    const post = await resolvePostLoginNext(data.user.id);

    return NextResponse.json({
      ok: true,
      is_superadmin: post.is_superadmin,
      org_slug: post.org_slug,
      next: post.next,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
