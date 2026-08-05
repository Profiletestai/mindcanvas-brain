import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resetPasswordSchema } from "@/app/(v2)/onboarding/v2/_lib/schema";
import {
  RECOVERY_COOKIE,
  recoveryCookieOptions,
} from "../_lib/recoveryCookie";

export const dynamic = "force-dynamic";

function expired() {
  const res = NextResponse.json(
    { ok: false, error: "expired" },
    { status: 401 }
  );
  res.cookies.set(RECOVERY_COOKIE, "", recoveryCookieOptions(0));
  return res;
}

export async function POST(req: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    // The recovery ticket set by /api/portal/password/recover is the ONLY thing
    // that authorises this call. A normal portal session is not enough — the
    // logged-in password change is a separate concern.
    const jar = await cookies();
    const token = jar.get(RECOVERY_COOKIE)?.value;
    if (!token) return expired();

    const raw = await req.json().catch(() => ({}));
    const parsed = resetPasswordSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: parsed.error.issues[0]?.message ?? "Invalid password",
        },
        { status: 400 }
      );
    }

    // GoTrue's user endpoint direct, with the recovery token as the bearer.
    // supabase-js has no way to pass an explicit JWT to auth.updateUser, and we
    // deliberately never load this token into a client that persists sessions.
    // This is the same call auth.updateUser makes, so Supabase's own password
    // policy and session-revocation settings still apply.
    const upd = await fetch(`${url}/auth/v1/user`, {
      method: "PUT",
      headers: {
        apikey: anon,
        Authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ password: parsed.data.password }),
      cache: "no-store",
    });

    if (!upd.ok) {
      if (upd.status === 401 || upd.status === 403) return expired();
      const body = (await upd.json().catch(() => null)) as any;
      return NextResponse.json(
        {
          ok: false,
          error:
            body?.msg || body?.error_description || "Couldn't update password",
        },
        { status: 400 }
      );
    }

    // Revoke the recovery session so its token cannot be replayed.
    await fetch(`${url}/auth/v1/logout`, {
      method: "POST",
      headers: { apikey: anon, Authorization: `Bearer ${token}` },
      cache: "no-store",
    }).catch(() => {});

    const res = NextResponse.json({ ok: true });
    res.cookies.set(RECOVERY_COOKIE, "", recoveryCookieOptions(0));
    return res;
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
