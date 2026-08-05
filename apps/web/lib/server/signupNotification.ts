// apps/web/lib/server/signupNotification.ts
import "server-only";
import { sendTransactionalEmail } from "./onesignalEmail";

const SIGNUP_NOTIFY_EMAIL =
  process.env.SIGNUP_NOTIFY_EMAIL || "support@profiletest.ai";

export type SignupSource = "default" | "pilot";

export interface SignupNotificationArgs {
  firstName: string;
  lastName: string;
  email: string;
  source: SignupSource;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Sends an internal notification to the support inbox whenever a new account
 * is created via one of the MindCanvas signup links (default v2 or pilot).
 * Fire-and-forget: never throws, returns the send result for logging.
 */
export async function sendSignupNotification(args: SignupNotificationArgs) {
  const { firstName, lastName, email, source } = args;

  if (!SIGNUP_NOTIFY_EMAIL) {
    console.error(
      "[signupNotification] SIGNUP_NOTIFY_EMAIL is not set, skipping send.",
    );
    return { ok: false as const, error: "missing_recipient" };
  }

  const fullName = `${firstName} ${lastName}`.trim() || "(no name)";
  const timestamp = new Date().toISOString();
  const sourceLabel = source === "pilot" ? "Pilot" : "Default";

  const html = `
    <p>A new account was created via the <strong>${sourceLabel}</strong> signup link.</p>
    <table cellpadding="0" cellspacing="0" style="font-size:14px; line-height:1.8;">
      <tr><td style="padding-right:12px; color:#94a3b8;">Name</td><td>${escapeHtml(fullName)}</td></tr>
      <tr><td style="padding-right:12px; color:#94a3b8;">Email</td><td>${escapeHtml(email)}</td></tr>
      <tr><td style="padding-right:12px; color:#94a3b8;">Source</td><td>${sourceLabel}</td></tr>
      <tr><td style="padding-right:12px; color:#94a3b8;">Time (UTC)</td><td>${timestamp}</td></tr>
    </table>
  `;

  try {
    const result = await sendTransactionalEmail({
      to: SIGNUP_NOTIFY_EMAIL,
      subject: `New MindCanvas signup (${sourceLabel}): ${fullName}`,
      html,
      branding: { orgName: "MindCanvas" },
    });
    if (!result.ok) {
      console.error("[signupNotification] send failed", result);
    }
    return result;
  } catch (e) {
    console.error("[signupNotification] unexpected error", e);
    return { ok: false as const, error: "unexpected" };
  }
}
