import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAppOrigin } from "@/app/_lib/portal";
import {
  RECOVERY_COOKIE,
  RECOVERY_TTL_SECONDS,
  recoveryCookieOptions,
} from "../_lib/recoveryCookie";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const origin = await getAppOrigin();
  const invalidUrl = `${origin}/portal/reset-password?error=invalid`;

  const tokenHash = req.nextUrl.searchParams.get("token_hash");
  if (!tokenHash) return NextResponse.redirect(invalidUrl);

  // Throwaway client with no cookie storage on purpose: verifying the recovery
  // token must NOT sign the browser into the portal. Following the link only
  // gets you as far as the reset form; the access token stays server-side in
  // an httpOnly, path-scoped cookie that /reset is the only consumer of.
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );

  const { data, error } = await sb.auth.verifyOtp({
    type: "recovery",
    token_hash: tokenHash,
  });

  const accessToken = data?.session?.access_token;
  if (error || !accessToken) {
    // Never log the token itself.
    console.error(
      "[password/recover] verifyOtp failed",
      error?.message ?? "no session returned"
    );
    return NextResponse.redirect(invalidUrl);
  }

  const res = NextResponse.redirect(`${origin}/portal/reset-password`);
  res.cookies.set(
    RECOVERY_COOKIE,
    accessToken,
    recoveryCookieOptions(RECOVERY_TTL_SECONDS)
  );
  return res;
}
