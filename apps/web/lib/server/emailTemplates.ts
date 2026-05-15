// apps/web/lib/server/emailTemplates.ts
import { createClient } from "@supabase/supabase-js";

export type EmailTemplateType =
  | "report"
  | "resend_report"
  | "test_owner_notification"
  | "send_test_link"
  | "test_taker_report";

export type EmailTemplate = {
  type: EmailTemplateType;
  subject: string;
  body_html: string;
  body_text?: string | null;
};

type DbTemplateRow = {
  org_id: string;
  type: string;
  subject: string;
  body_html: string;
  body_text?: string | null;
};

function supaAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    "";

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables for email templates");
  }

  return createClient(url, key, { db: { schema: "portal" } });
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function withDefaultContext(
  context: Record<string, string>
): Record<string, string> {
  const testName =
    clean(context.test_name) ||
    clean(context.assessment_name) ||
    "your assessment";

  const orgName = clean(context.org_name) || "MindCanvas";

  const supportEmail =
    clean(context.support_email) ||
    clean(context.email_reply_to_address) ||
    "support@profiletest.ai";

  const signoffName =
    clean(context.email_signoff_name) ||
    clean(context.founder_name) ||
    clean(context.owner_full_name) ||
    orgName;

  const fromName =
    clean(context.email_from_name) ||
    testName ||
    orgName ||
    "ProfileTest.ai";

  const fromAddress =
    clean(context.email_from_address) ||
    clean(process.env.ONESIGNAL_FROM_EMAIL) ||
    clean(process.env.EMAIL_FROM_ADDRESS) ||
    "hello@profiletest.ai";

  const replyToAddress =
    clean(context.email_reply_to_address) ||
    supportEmail ||
    fromAddress;

  return {
    ...context,

    first_name: clean(context.first_name) || "there",
    test_name: testName,
    assessment_name: testName,
    org_name: orgName,
    support_email: supportEmail,
    report_link: clean(context.report_link),
    test_link: clean(context.test_link),

    email_signoff_name: signoffName,
    founder_name: clean(context.founder_name) || signoffName,
    email_from_name: fromName,
    email_from_address: fromAddress,
    email_reply_to_address: replyToAddress,

    // Friendly aliases for future templates.
    "Test.Taker.First.Name": clean(context.first_name) || "there",
    "Test.Name": testName,
    "Assessment.Name": testName,
    "Report.Link": clean(context.report_link),
    "Organisation.Name": orgName,
    "Founder.Name": clean(context.founder_name) || signoffName,
  };
}

/**
 * Database enum compatibility.
 *
 * Your portal.email_template_type enum does not include "test_taker_report".
 * So when the submit route asks for "test_taker_report", we load the org's
 * "report" template from portal.email_templates.
 */
function getTemplateLookupTypes(type: EmailTemplateType): string[] {
  if (type === "test_taker_report") {
    return ["test_taker_report", "report"];
  }

  return [type];
}

/**
 * Default templates used if an org has not customized theirs yet.
 */
export function getDefaultTemplate(type: EmailTemplateType): EmailTemplate {
  switch (type) {
    case "report":
    case "test_taker_report":
      return {
        type,
        subject: "Your Assessment Results",
        body_html: `
<p>Dear {{first_name}},</p>

<p>
Congratulations on completing the <strong>{{test_name}}</strong>.
Below you will find the link to your personalised report, which has been customised to you based on the answers you provided during the assessment.
</p>

<p style="margin: 28px 0;">
  <a
    href="{{report_link}}"
    style="
      display:inline-block;
      padding:14px 22px;
      background:#2563eb;
      color:#ffffff;
      text-decoration:none;
      border-radius:6px;
      font-weight:700;
      letter-spacing:0.02em;
    "
  >
    CLICK HERE to access your unique report
  </a>
</p>

<p>
We highly recommend that you read the report and follow the next steps provided to learn more and implement the results.
</p>

<p style="margin-top:32px;">
Best regards,<br /><br />
<strong>{{email_signoff_name}}</strong><br />
Creator of the {{test_name}}
</p>

<p style="font-size:13px;color:#666;margin-top:24px;">
For any queries, please contact us at
<a href="mailto:{{support_email}}">{{support_email}}</a>.
</p>
        `.trim(),
        body_text: `
Dear {{first_name}},

Congratulations on completing the {{test_name}}.

Below you will find the link to your personalised report, which has been customised to you based on the answers you provided during the assessment.

Access your report here:
{{report_link}}

We highly recommend that you read the report and follow the next steps provided to learn more and implement the results.

Best regards,

{{email_signoff_name}}
Creator of the {{test_name}}

For any queries, please contact us at {{support_email}}.
        `.trim(),
      };

    case "resend_report":
      return {
        type,
        subject: "Your Assessment Results",
        body_html: `
<p>Dear {{first_name}},</p>

<p>
As requested, here is your link to access your personalised report for the
<strong>{{test_name}}</strong>.
</p>

<p style="margin: 28px 0;">
  <a
    href="{{report_link}}"
    style="
      display:inline-block;
      padding:14px 22px;
      background:#2563eb;
      color:#ffffff;
      text-decoration:none;
      border-radius:6px;
      font-weight:700;
      letter-spacing:0.02em;
    "
  >
    CLICK HERE to access your unique report
  </a>
</p>

<p style="margin-top:32px;">
Best regards,<br /><br />
<strong>{{email_signoff_name}}</strong><br />
Creator of the {{test_name}}
</p>

<p style="font-size:13px;color:#666;margin-top:24px;">
For any queries, please contact us at
<a href="mailto:{{support_email}}">{{support_email}}</a>.
</p>
        `.trim(),
        body_text: `
Dear {{first_name}},

As requested, here is your link to access your personalised report for the {{test_name}}.

Access your report here:
{{report_link}}

Best regards,

{{email_signoff_name}}
Creator of the {{test_name}}

For any queries, please contact us at {{support_email}}.
        `.trim(),
      };

    case "send_test_link":
      return {
        type,
        subject: "You’ve been invited to complete {{test_name}}",
        body_html: `
<p>Dear {{first_name}},</p>

<p>
You’ve been invited to complete the <strong>{{test_name}}</strong>.
</p>

<p style="margin: 28px 0;">
  <a
    href="{{test_link}}"
    style="
      display:inline-block;
      padding:14px 22px;
      background:#2563eb;
      color:#ffffff;
      text-decoration:none;
      border-radius:6px;
      font-weight:700;
    "
  >
    Start your assessment
  </a>
</p>

<p>
If the button above does not work, copy and paste the link below into your browser:
</p>

<p style="word-break:break-all;">
  {{test_link}}
</p>

<p>
Once completed, your personalised report will be generated based on your responses.
</p>

<p style="margin-top:32px;">
Best regards,<br /><br />
<strong>{{email_signoff_name}}</strong><br />
Creator of the {{test_name}}
</p>

<p style="font-size:13px;color:#666;margin-top:24px;">
For any queries, please contact us at
<a href="mailto:{{support_email}}">{{support_email}}</a>.
</p>
        `.trim(),
        body_text: `
Dear {{first_name}},

You’ve been invited to complete the {{test_name}}.

Start your assessment here:
{{test_link}}

Once completed, your personalised report will be generated based on your responses.

Best regards,

{{email_signoff_name}}
Creator of the {{test_name}}

For any queries, please contact us at {{support_email}}.
        `.trim(),
      };

    case "test_owner_notification":
      return {
        type,
        subject: "{{test_taker_full_name}} completed the {{test_name}}",
        body_html: `
<p>Hello,</p>

<p>
A test taker has just completed the <strong>{{test_name}}</strong>.
</p>

<ul>
  <li><strong>Test:</strong> {{test_name}}</li>
  <li><strong>Name:</strong> {{test_taker_full_name}}</li>
  <li><strong>Email:</strong> {{test_taker_email}}</li>
  <li><strong>Mobile:</strong> {{test_taker_mobile}}</li>
  <li><strong>Organisation / Company:</strong> {{test_taker_org}}</li>
</ul>

<p>
<strong>Internal Test Taker Report:</strong><br />
<a href="{{internal_report_link}}">{{internal_report_link}}</a>
</p>

<p>
<strong>Results Dashboard:</strong><br />
<a href="{{internal_results_dashboard_link}}">
{{internal_results_dashboard_link}}
</a>
</p>

<p style="margin-top:32px;">
Regards,<br />
<strong>{{org_name}}</strong>
</p>
        `.trim(),
        body_text: `
Hello,

A test taker has just completed the {{test_name}}.

Test: {{test_name}}
Name: {{test_taker_full_name}}
Email: {{test_taker_email}}
Mobile: {{test_taker_mobile}}
Organisation / Company: {{test_taker_org}}

Internal Test Taker Report:
{{internal_report_link}}

Results Dashboard:
{{internal_results_dashboard_link}}

Regards,
{{org_name}}
        `.trim(),
      };
  }
}

/**
 * Simple {{placeholder}} replacement helper.
 */
function renderTemplate(
  template: string,
  context: Record<string, string>
): string {
  const safeContext = withDefaultContext(context);

  return template.replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => {
    const value = safeContext[key];
    return typeof value === "string" ? value : "";
  });
}

/**
 * Load an org’s template overrides, falling back to defaults.
 */
export async function loadOrgTemplates(orgId: string): Promise<EmailTemplate[]> {
  const supa = supaAdmin();

  const { data, error } = await supa
    .from("email_templates" as any)
    .select("org_id, type, subject, body_html, body_text")
    .eq("org_id", orgId);

  if (error) {
    console.error("[emailTemplates] Failed to load org templates", {
      orgId,
      error,
    });
  }

  const rows = (data as DbTemplateRow[] | null) ?? [];
  const byType = new Map<string, DbTemplateRow>();

  rows.forEach((row) => {
    if (row?.type) {
      byType.set(String(row.type), row);
    }
  });

  const allTypes: EmailTemplateType[] = [
    "report",
    "test_taker_report",
    "resend_report",
    "send_test_link",
    "test_owner_notification",
  ];

  return allTypes.map((type) => {
    const lookupTypes = getTemplateLookupTypes(type);

    const existing = lookupTypes
      .map((lookupType) => byType.get(lookupType))
      .find(Boolean);

    if (existing) {
      return {
        type,
        subject: existing.subject,
        body_html: existing.body_html,
        body_text: existing.body_text ?? null,
      };
    }

    return getDefaultTemplate(type);
  });
}

/**
 * Send an email via OneSignal using the org’s template for the given type.
 */
export async function sendTemplatedEmail(args: {
  orgId: string;
  type: EmailTemplateType;
  to: string;
  context: Record<string, string>;
}): Promise<{ ok: boolean; error?: string; status?: number; body?: string }> {
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey =
    process.env.ONESIGNAL_REST_API_KEY || process.env.ONESIGNAL_API_KEY || "";

  if (!appId || !apiKey) {
    return { ok: false, error: "missing_env" };
  }

  const context = withDefaultContext(args.context);

  const templates = await loadOrgTemplates(args.orgId);
  const template =
    templates.find((t) => t.type === args.type) ||
    getDefaultTemplate(args.type);

  const subject = renderTemplate(template.subject, context);
  const bodyHtml = renderTemplate(template.body_html, context);

  const payload = {
    app_id: appId,
    include_email_tokens: [args.to],
    email_subject: subject,
    email_body: bodyHtml,

    // Sender customisation.
    // OneSignal will only use these if the sending domain/address is configured.
    email_from_name: context.email_from_name,
    email_from_address: context.email_from_address,
    email_reply_to_address: context.email_reply_to_address,
  };

  try {
    const res = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();

    if (!res.ok) {
      return {
        ok: false,
        error: "onesignal_error",
        status: res.status,
        body: text,
      };
    }

    return { ok: true };
  } catch (error) {
    console.error("[emailTemplates] Unexpected OneSignal email error", error);
    return { ok: false, error: "unexpected_error" };
  }
}