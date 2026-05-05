//apps/web/app/api/admin/create-link/route.ts
import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/server/supabaseAdmin";
import { Resend } from "resend";
import crypto from "crypto";

export const runtime = "nodejs";

type ReportVariant = "lite" | "full";

type Body = {
  orgId: string;
  testId: string;
  testDisplayName?: string | null;
  contactOwner?: string | null;
  showResults?: boolean;
  emailReport?: boolean;
  hiddenResultsMessage?: string | null;

  redirectUrl?: string | null;
  nextStepsUrl?: string | null;
  expiresAt?: string | null;

  recipientEmail?: string | null;
  recipientName?: string | null;

  reportVariant?: ReportVariant | null;
  report_variant?: ReportVariant | null;

  max_uses?: number | null;
};

function normalizeMaxUses(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null;
  return n;
}

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const EMAIL_FROM =
  process.env.EMAIL_FROM ||
  process.env.RESEND_FROM ||
  "no-reply@mindcanvas.app";

function absoluteUrl(path: string) {
  const host =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    "http://localhost:3000";
  const base = host.startsWith("http") ? host : `https://${host}`;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function normalizeReportVariant(v: any): ReportVariant {
  return String(v || "").trim().toLowerCase() === "lite" ? "lite" : "full";
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    if (!body.orgId || !body.testId) {
      return NextResponse.json(
        { ok: false, error: "Missing orgId or testId" },
        { status: 400 }
      );
    }

    const {
      orgId,
      testId,
      testDisplayName,
      contactOwner,
      showResults = true,
      emailReport = true,
      hiddenResultsMessage,
      redirectUrl,
      nextStepsUrl,
      expiresAt,
      recipientEmail,
      recipientName,
    } = body;

    const reportVariant = normalizeReportVariant(
      body.report_variant ?? body.reportVariant
    );

    const maxUses = normalizeMaxUses(body.max_uses);

    const sb = createClient().schema("portal");
    const token = crypto.randomUUID().replace(/-/g, "");

    const insertPayload: any = {
      token,
      org_id: orgId,
      test_id: testId,
      name: testDisplayName || null,
      contact_owner: contactOwner || null,
      show_results: !!showResults,
      email_report: !!emailReport,
      is_active: true,

      hidden_results_message: showResults ? null : hiddenResultsMessage || null,
      redirect_url: showResults ? null : redirectUrl || null,

      // keep this available on the link either way
      next_steps_url: nextStepsUrl || null,

      max_uses: maxUses,

      meta: {
        report_variant: reportVariant,
      },
    };

    if (expiresAt) {
      insertPayload.expires_at = new Date(expiresAt).toISOString();
    }

    const { data: linkRow, error: insErr } = await sb
      .from("test_links")
      .insert(insertPayload)
      .select("token, show_results, redirect_url, next_steps_url, meta")
      .single();

    if (insErr) {
      return NextResponse.json(
        { ok: false, error: insErr.message },
        { status: 500 }
      );
    }

    const publicUrl = absoluteUrl(`/t/${linkRow.token}`);

    let emailResult: any = null;
    let emailError: string | null = null;

    if (recipientEmail) {
      if (!RESEND_API_KEY) {
        emailError = "Missing RESEND_API_KEY or EMAIL_FROM env vars.";
      } else {
        try {
          const resend = new Resend(RESEND_API_KEY);
          const to = recipientName?.trim()
            ? `${recipientName} <${recipientEmail}>`
            : recipientEmail;

          const subject = testDisplayName
            ? `Your ${testDisplayName} link`
            : "Your MindCanvas test link";

          const html = `
            <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height:1.6;">
              <h2 style="margin:0 0 12px;">You're invited to take a MindCanvas profile test</h2>
              ${
                contactOwner
                  ? `<p>Contact owner: <strong>${escapeHtml(
                      contactOwner
                    )}</strong></p>`
                  : ""
              }
              <p>Click below to start:</p>
              <p style="margin:16px 0;">
                <a href="${publicUrl}" style="background:#111;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">Start your test</a>
              </p>
              <p style="margin:16px 0 0;font-size:12px;color:#666;">
                If the button doesn't work, copy this link:<br/>${publicUrl}
              </p>
            </div>
          `;

          emailResult = await resend.emails.send({
            from: EMAIL_FROM,
            to,
            subject,
            html,
          });
        } catch (e: any) {
          emailError = e?.message || "Email send failed.";
        }
      }
    }

    return NextResponse.json({
      ok: true,
      token: linkRow.token,
      url: publicUrl,
      show_results: linkRow.show_results,
      redirect_url: linkRow.redirect_url,
      next_steps_url: linkRow.next_steps_url,
      report_variant:
        linkRow?.meta?.report_variant === "lite" ? "lite" : "full",
      emailed: !!recipientEmail && !emailError,
      emailResultId: emailResult?.id ?? null,
      emailError,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}