//supabase/functions/send-auth-email/index.ts
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

type AuthUser = {
  id: string;
  email?: string;
  new_email?: string;
  user_metadata?: Record<string, unknown>;
};

type EmailData = {
  token?: string;
  token_hash?: string;
  token_new?: string;
  token_hash_new?: string;
  redirect_to?: string;
  email_action_type?: string;
  site_url?: string;
};

type HookPayload = {
  user: AuthUser;
  email_data: EmailData;
};

const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID")?.trim() || "";

const ONESIGNAL_API_KEY =
  Deno.env.get("ONESIGNAL_REST_API_KEY")?.trim() ||
  Deno.env.get("ONESIGNAL_API_KEY")?.trim() ||
  "";

const SEND_EMAIL_HOOK_SECRET =
  Deno.env.get("SEND_EMAIL_HOOK_SECRET")?.trim() || "";

const FROM_NAME =
  Deno.env.get("AUTH_EMAIL_FROM_NAME")?.trim() || "Profiletest.ai";

const FROM_ADDRESS =
  Deno.env.get("AUTH_EMAIL_FROM_ADDRESS")?.trim() ||
  "noreply@profiletest.ai";

const REPLY_TO =
  Deno.env.get("AUTH_EMAIL_REPLY_TO")?.trim() ||
  "support@profiletest.ai";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function firstName(user: AuthUser): string {
  const value = user.user_metadata?.first_name;

  return typeof value === "string" && value.trim()
    ? value.trim()
    : "there";
}

function emailCopy(
  actionType: string,
  token: string,
  user: AuthUser
): {
  subject: string;
  heading: string;
  introduction: string;
} {
  switch (actionType) {
    case "recovery":
      return {
        subject: "Reset your Profiletest.ai password",
        heading: "Reset your password",
        introduction:
          "Use the verification code below to continue resetting your Profiletest.ai password.",
      };

    case "email_change":
      return {
        subject: "Confirm your Profiletest.ai email change",
        heading: "Confirm your email change",
        introduction:
          "Use the verification code below to confirm the change to your Profiletest.ai email address.",
      };

    case "invite":
      return {
        subject: "You have been invited to Profiletest.ai",
        heading: "Your Profiletest.ai invitation",
        introduction:
          "Use the verification code below to accept your invitation and continue.",
      };

    case "reauthentication":
      return {
        subject: "Confirm your Profiletest.ai identity",
        heading: "Confirm it’s you",
        introduction:
          "Use the verification code below to confirm your identity.",
      };

    case "magiclink":
    case "signup":
    default:
      return {
        subject: "Your Profiletest.ai verification code",
        heading: "Verify your email address",
        introduction:
          "Use the verification code below to verify your email address and continue setting up your Profiletest.ai account.",
      };
  }
}

function buildHtml(args: {
  actionType: string;
  token: string;
  user: AuthUser;
}): string {
  const copy = emailCopy(args.actionType, args.token, args.user);

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(copy.subject)}</title>
  </head>

  <body style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#172033;">
    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      style="background:#f4f7fb;padding:32px 16px;"
    >
      <tr>
        <td align="center">
          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e6ebf2;"
          >
            <tr>
              <td style="padding:28px 32px;background:#0f172a;color:#ffffff;">
                <div style="font-size:22px;font-weight:700;">
                  Profiletest.ai
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:36px 32px;">
                <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">
                  Hi ${escapeHtml(firstName(args.user))},
                </p>

                <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;color:#0f172a;">
                  ${escapeHtml(copy.heading)}
                </h1>

                <p style="margin:0 0 26px;font-size:16px;line-height:1.6;color:#475569;">
                  ${escapeHtml(copy.introduction)}
                </p>

                <div
                  style="margin:0 0 26px;padding:20px;text-align:center;background:#f1f5f9;border-radius:12px;font-size:32px;font-weight:700;letter-spacing:8px;color:#0f172a;"
                >
                  ${escapeHtml(args.token)}
                </div>

                <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#64748b;">
                  If you did not request this email, you can safely ignore it.
                </p>

                <p style="margin:0;font-size:14px;line-height:1.6;color:#64748b;">
                  For assistance, contact
                  <a
                    href="mailto:${escapeHtml(REPLY_TO)}"
                    style="color:#2563eb;"
                  >
                    ${escapeHtml(REPLY_TO)}
                  </a>.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:20px 32px;background:#f8fafc;font-size:12px;line-height:1.5;color:#64748b;">
                This is an essential account and security email from Profiletest.ai.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
}

async function sendOneSignalEmail(args: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const response = await fetch(
    "https://onesignal.com/api/v1/notifications",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Basic ${ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_email_tokens: [args.to],
        email_subject: args.subject,
        email_body: args.html,
        email_from_name: FROM_NAME,
        email_from_address: FROM_ADDRESS,
        email_reply_to_address: REPLY_TO,
        include_unsubscribed: true,
        disable_email_click_tracking: true,
      }),
    }
  );

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `OneSignal returned ${response.status}: ${responseText.slice(0, 400)}`
    );
  }

  let responseData: Record<string, unknown> = {};

  try {
    responseData = responseText ? JSON.parse(responseText) : {};
  } catch {
    // A successful non-JSON response is still accepted.
  }

  if (
    Array.isArray(responseData.errors) &&
    responseData.errors.length > 0
  ) {
    throw new Error(
      `OneSignal rejected the email: ${JSON.stringify(
        responseData.errors
      ).slice(0, 400)}`
    );
  }
}

async function deliverEmail(args: {
  to: string;
  token: string;
  actionType: string;
  user: AuthUser;
}): Promise<void> {
  if (!args.to || !args.token) {
    throw new Error("Auth email recipient or token is missing.");
  }

  const copy = emailCopy(args.actionType, args.token, args.user);

  await sendOneSignalEmail({
    to: args.to,
    subject: copy.subject,
    html: buildHtml({
      actionType: args.actionType,
      token: args.token,
      user: args.user,
    }),
  });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (
    !ONESIGNAL_APP_ID ||
    !ONESIGNAL_API_KEY ||
    !SEND_EMAIL_HOOK_SECRET
  ) {
    console.error("[send-auth-email] Required secrets are missing.");

    return Response.json(
      {
        error: {
          message: "Required email configuration is missing.",
        },
      },
      { status: 500 }
    );
  }

  const body = await request.text();
  const headers = Object.fromEntries(request.headers);

  try {
    const hookSecret = SEND_EMAIL_HOOK_SECRET.replace(
      "v1,whsec_",
      ""
    );

    const webhook = new Webhook(hookSecret);

    const { user, email_data } = webhook.verify(
      body,
      headers
    ) as HookPayload;

    const actionType =
      email_data.email_action_type?.trim() || "signup";

    if (
      actionType === "email_change" &&
      user.new_email &&
      email_data.token_new
    ) {
      if (user.email && email_data.token) {
        await deliverEmail({
          to: user.email,
          token: email_data.token,
          actionType,
          user,
        });
      }

      await deliverEmail({
        to: user.new_email,
        token: email_data.token_new,
        actionType,
        user,
      });
    } else {
      await deliverEmail({
        to: user.email || "",
        token: email_data.token || email_data.token_new || "",
        actionType,
        user,
      });
    }

    console.log(
      `[send-auth-email] Email sent action=${actionType} user_id=${user.id}`
    );

    return Response.json({}, { status: 200 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unexpected hook error";

    console.error(`[send-auth-email] ${message}`);

    return Response.json(
      {
        error: {
          message,
        },
      },
      { status: 500 }
    );
  }
});