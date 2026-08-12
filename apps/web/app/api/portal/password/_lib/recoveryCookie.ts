import "server-only";

/**
 * Ticket that links /api/portal/password/recover to /api/portal/password/reset.
 *
 * It holds the Supabase access token minted by verifying the recovery token.
 * It is deliberately NOT a portal session cookie:
 *  - httpOnly, so page scripts can never read it;
 *  - path-scoped to the password endpoints, so it is only ever sent there;
 *  - short lived, and cleared as soon as the password is updated.
 *
 * That keeps the forgotten-password flow separate from the logged-in session:
 * an ordinary portal login cannot reach /reset, and a recovery link does not
 * log anyone into the portal.
 */
export const RECOVERY_COOKIE = "mc_pw_recovery";
export const RECOVERY_COOKIE_PATH = "/api/portal/password";
export const RECOVERY_TTL_SECONDS = 15 * 60;

export function recoveryCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: RECOVERY_COOKIE_PATH,
    maxAge,
  };
}
