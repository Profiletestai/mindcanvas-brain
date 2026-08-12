// apps/web/lib/server/passwordResetEmail.ts
import "server-only";
import { sendTransactionalEmail } from "./onesignalEmail";

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@profiletest.ai";

export interface PasswordResetEmailArgs {
  to: string;
  resetUrl: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Sends the branded MindCanvas password-reset email.
 * The URL points at our own recovery route handler, which exchanges the
 * Supabase recovery token for a session before redirecting to the reset form.
 * Fire-and-forget: never throws, returns the send result for logging.
 */
export async function sendPasswordResetEmail(args: PasswordResetEmailArgs) {
  const { to, resetUrl } = args;
  const safeUrl = escapeHtml(resetUrl);

  const html = `
    <h2 style="font-size:18px; margin:0 0 12px; color:#f8fafc;">Reset your password</h2>
    <p style="margin:0 0 20px;">
      We received a request to reset the password for your MindCanvas account.
      Click the button below to choose a new one.
    </p>
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 24px;">
      <tr>
        <td align="center" style="border-radius:12px; background:linear-gradient(180deg, rgb(6,94,144) 0%, rgb(42,137,190) 100%); background-color:rgb(42,137,190);">
          <a href="${safeUrl}"
             style="display:inline-block; padding:14px 28px; font-size:15px; font-weight:700; letter-spacing:0.2px; color:#ffffff; text-decoration:none; border-radius:12px;">
            Reset password
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 8px; font-size:13px; color:#94a3b8;">
      If the button doesn't work, copy and paste this link into your browser:
    </p>
    <p style="margin:0 0 24px; font-size:12px; word-break:break-all;">
      <a href="${safeUrl}" style="color:#7dd3fc;">${safeUrl}</a>
    </p>
    <p style="margin:0 0 8px; font-size:13px; color:#94a3b8;">
      This link expires in 1 hour and can only be used once.
    </p>
    <p style="margin:0 0 8px; font-size:13px; color:#94a3b8;">
      If you didn't request this, you can safely ignore this email — your password won't change.
    </p>
    <p style="margin:0; font-size:13px; color:#94a3b8;">
      Need help? Contact us at
      <a href="mailto:${SUPPORT_EMAIL}" style="color:#7dd3fc;">${SUPPORT_EMAIL}</a>.
    </p>
  `;

  const text = [
    "Reset your password",
    "",
    "We received a request to reset the password for your MindCanvas account.",
    "Open the link below to choose a new one:",
    resetUrl,
    "",
    "This link expires in 1 hour and can only be used once.",
    "If you didn't request this, you can safely ignore this email — your password won't change.",
    "",
    `Need help? Contact us at ${SUPPORT_EMAIL}.`,
  ].join("\n");

  try {
    return await sendTransactionalEmail({
      to,
      subject: "Reset your MindCanvas password",
      html,
      text,
    });
  } catch (e: any) {
    console.error("[passwordResetEmail] send failed", e?.message || e);
    return { ok: false as const, error: "send_failed" };
  }
}
