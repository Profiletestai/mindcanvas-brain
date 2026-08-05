import { NextResponse } from "next/server";
import { getAdminClient, getAppOrigin } from "@/app/_lib/portal";
import { findUserByEmail } from "@/app/_lib/findUserByEmail";
import { emailSchema } from "@/app/(v2)/onboarding/v2/_lib/schema";
import { sendPasswordResetEmail } from "@/lib/server/passwordResetEmail";

export const dynamic = "force-dynamic";

const THROTTLE_MAX = 3;
const THROTTLE_WINDOW_MS = 15 * 60 * 1000;

// Soft guard only: this map lives in the process memory of a single instance,
// so it does not survive restarts and is not shared across serverless
// instances. It blunts casual enumeration-by-timing and mail flooding; it is
// not a hard rate limit.
declare global {
  // eslint-disable-next-line no-var
  var __pw_forgot_throttle__: Map<string, number[]> | undefined;
}

function isThrottled(email: string): boolean {
  const store: Map<string, number[]> = (global.__pw_forgot_throttle__ ??=
    new Map<string, number[]>());
  const now = Date.now();
  const hits = (store.get(email) ?? []).filter(
    (t: number) => now - t < THROTTLE_WINDOW_MS
  );

  // Opportunistic cleanup so the map cannot grow without bound.
  if (store.size > 5000) {
    for (const [k, v] of store) {
      if (v.every((t: number) => now - t >= THROTTLE_WINDOW_MS)) store.delete(k);
    }
  }

  if (hits.length >= THROTTLE_MAX) {
    store.set(email, hits);
    return true;
  }
  hits.push(now);
  store.set(email, hits);
  return false;
}

export async function POST(req: Request) {
  const raw = await req.json().catch(() => ({}));
  const parsed = emailSchema.safeParse((raw as any)?.email);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid email format",
      },
      { status: 400 }
    );
  }
  const email = parsed.data as string;

  // Everything below is deliberately silent: the response is identical whether
  // or not an account exists, so this endpoint cannot be used to enumerate
  // accounts. Failures are logged server-side only, never returned.
  try {
    if (isThrottled(email)) {
      return NextResponse.json({ ok: true });
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      const admin = await getAdminClient();
      const { data, error } = await admin.auth.admin.generateLink({
        type: "recovery",
        email,
      });

      if (error) {
        console.error("[password/forgot] generateLink failed", error.message);
      } else {
        const hashedToken = (data as any)?.properties?.hashed_token as
          | string
          | undefined;

        if (!hashedToken) {
          console.error("[password/forgot] generateLink returned no token");
        } else {
          const origin = await getAppOrigin();
          // We build our own URL instead of using data.properties.action_link
          // so no Supabase redirect allowlist entry is needed.
          const resetUrl = `${origin}/api/portal/password/recover?token_hash=${encodeURIComponent(
            hashedToken
          )}`;
          const sent = await sendPasswordResetEmail({ to: email, resetUrl });
          if (!sent.ok) {
            console.error("[password/forgot] email send failed", sent.error);
          }
        }
      }
    }
  } catch (e: any) {
    console.error("[password/forgot] unexpected error", e?.message || e);
  }

  return NextResponse.json({ ok: true });
}
