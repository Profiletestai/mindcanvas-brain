// apps/web/app/api/portal/[slug]/communications/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/server/supabaseAdmin";
import { sendTemplatedEmail, EmailTemplateType } from "@/lib/server/emailTemplates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function supaAdmin() {
  return createClient().schema("portal");
}

type SendPayload =
  | { type: "send_test_link"; testId: string; takerId: string }
  | { type: "report"; testId: string; takerId: string }
  | { type: "resend_report"; testId: string; takerId: string }
  | { type: "test_owner_notification"; testId: string; takerId: string };

async function getOrgBySlug(slug: string) {
  const supa = supaAdmin();
  const { data, error } = await supa
    .from("orgs")
    .select("id, slug, name, notification_email, website, support_email, website_url")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) {
    console.error("[communications/send] getOrgBySlug error", error);
    throw new Error("ORG_NOT_FOUND");
  }

  return data as {
    id: string;
    slug: string;
    name: string | null;
    notification_email: string | null;
    website: string | null;
    support_email: string | null;
    website_url: string | null;
  };
}

async function getTakerById(takerId: string) {
  const supa = supaAdmin();
  const { data, error } = await supa
    .from("test_takers")
    .select(
      `
      id,
      org_id,
      test_id,
      email,
      first_name,
      last_name,
      link_token,
      last_result_url,
      phone,
      company
    `
    )
    .eq("id", takerId)
    .maybeSingle();

  if (error || !data) {
    console.error("[communications/send] getTakerById error", error, { takerId });
    throw new Error("TAKER_NOT_FOUND");
  }

  return data as {
    id: string;
    org_id: string;
    test_id: string;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    link_token: string;
    last_result_url: string | null;
    phone: string | null;
    company: string | null;
  };
}

async function getTestById(testId: string) {
  const supa = supaAdmin();
  const { data, error } = await supa
    .from("tests")
    .select("id, name, slug, test_type")
    .eq("id", testId)
    .maybeSingle();

  if (error || !data) {
    console.warn("[communications/send] getTestById missing test", { testId, error });
    return {
      id: testId,
      name: "your assessment" as string | null,
      slug: null as string | null,
      test_type: null as string | null,
    };
  }

  return data as { id: string; name: string | null; slug: string | null; test_type: string | null };
}

function getBaseUrl() {
  const explicit = process.env.NEXT_PUBLIC_APP_BASE_URL;
  if (explicit && explicit.trim().length > 0) return explicit.replace(/\/$/, "");

  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL || "";
  if (!vercel) return "";
  return vercel.startsWith("http") ? vercel.replace(/\/$/, "") : `https://${vercel.replace(/\/$/, "")}`;
}

function getQscVariant(opts: { slug?: string | null; testType?: string | null }) {
  const t = (opts.testType || "").toLowerCase();
  const s = (opts.slug || "").toLowerCase();

  const hasQsc = t.includes("qsc") || s.includes("qsc");
  if (!hasQsc) return { isQsc: false as const, variant: null as null | "leader" | "entrepreneur" };

  let variant: "leader" | "entrepreneur" | null = null;
  if (t.includes("leader") || s.includes("leader")) variant = "leader";
  else if (t.includes("entrepreneur") || s.includes("entrepreneur") || s.includes("entre")) variant = "entrepreneur";

  return { isQsc: true as const, variant };
}

function normalizeToAbsolute(base: string, v: string) {
  if (!v) return "";
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  if (!base) return v;
  if (v.startsWith("/")) return `${base}${v}`;
  return `${base}/${v}`;
}

function normalizeEmail(v: string | null | undefined) {
  const s = (v || "").trim();
  return s.length ? s : "";
}

function getDefaultInternalEmail() {
  return normalizeEmail(process.env.INTERNAL_NOTIFICATIONS_EMAIL) || "notifications@profiletest.ai";
}

/**
 * ✅ NEW: For report emails, use the token that the submission was created with.
 * This prevents token mismatches between email links and taker completion flow.
 */
async function getLatestSubmissionTokenForTaker(opts: { takerId: string; testId: string }) {
  const supa = supaAdmin();

  const { data, error } = await supa
    .from("test_submissions")
    .select(
      `
      id,
      created_at,
      test_link_id,
      test_links:portal.test_links!test_submissions_test_link_id_fkey (
        id,
        token,
        test_id
      )
    `
    )
    .eq("test_taker_id", opts.takerId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.warn("[communications/send] getLatestSubmissionTokenForTaker error", error);
    return { token: null as string | null, submissionId: null as string | null };
  }

  const rows = (data || []) as any[];

  // Find the most recent submission where link.test_id matches testId
  for (const r of rows) {
    const link = r?.test_links;
    if (link?.token && String(link?.test_id) === String(opts.testId)) {
      return { token: String(link.token), submissionId: String(r.id) };
    }
  }

  // No match found for this test
  return { token: null as string | null, submissionId: null as string | null };
}

/**
 * ✅ Safer: only trust last_result_url if:
 * - it contains tid=<takerId>
 * - and (when we know reportToken) it contains that token path segment
 */
function isSafeLastResultUrl(lastResultUrl: string, takerId: string, reportToken?: string) {
  try {
    const decoded = decodeURIComponent(lastResultUrl);

    const hasTid = decoded.includes("tid=") && decoded.includes(takerId);
    if (!hasTid) return false;

    if (reportToken) {
      // Accept either /t/<token>/report or /qsc/<token>...
      const tokenOk =
        decoded.includes(`/t/${reportToken}/`) ||
        decoded.includes(`/t/${encodeURIComponent(reportToken)}/`) ||
        decoded.includes(`/qsc/${reportToken}`) ||
        decoded.includes(`/qsc/${encodeURIComponent(reportToken)}`);

      return tokenOk;
    }

    // If we don't know token, fallback to tid-only check (legacy behaviour)
    return true;
  } catch {
    const hasTid = lastResultUrl.includes("tid=") && lastResultUrl.includes(takerId);
    if (!hasTid) return false;

    if (reportToken) {
      return lastResultUrl.includes(`/t/${reportToken}/`) || lastResultUrl.includes(`/qsc/${reportToken}`);
    }
    return true;
  }
}

function buildLinks(opts: {
  orgSlug: string;
  testId: string;
  // token used to *start* the test (portal take link)
  testLinkToken: string;
  // token used to *view the report* (must match submission)
  reportToken: string;
  lastResultUrl?: string | null;
  takerId: string;
  testSlug?: string | null;
  testType?: string | null;
}) {
  const base = getBaseUrl();

  const testLink = base
    ? `${base}/portal/${opts.orgSlug}/tests/${opts.testId}/take?token=${encodeURIComponent(opts.testLinkToken)}`
    : "";

  let reportLink = "";
  if (base) {
    const { isQsc, variant } = getQscVariant({ slug: opts.testSlug, testType: opts.testType });

    if (isQsc) {
      if (variant) {
        reportLink = `${base}/qsc/${encodeURIComponent(opts.reportToken)}/${variant}?tid=${encodeURIComponent(
          opts.takerId
        )}`;
      } else {
        reportLink = `${base}/qsc/${encodeURIComponent(opts.reportToken)}?tid=${encodeURIComponent(opts.takerId)}`;
      }
    } else {
      reportLink = `${base}/t/${encodeURIComponent(opts.reportToken)}/report?tid=${encodeURIComponent(opts.takerId)}`;
    }
  }

  // ✅ Only override with last_result_url if it's clearly for THIS taker AND matches reportToken
  if (opts.lastResultUrl && isSafeLastResultUrl(opts.lastResultUrl, opts.takerId, opts.reportToken)) {
    reportLink = normalizeToAbsolute(base, opts.lastResultUrl);
  }

  const nextStepsLink = "";

  const internalReportLink = base ? `${base}/portal/${opts.orgSlug}/database/${opts.takerId}` : "";
  const internalResultsDashboardLink = base ? `${base}/portal/${opts.orgSlug}/dashboard?testId=${opts.testId}` : "";

  return { testLink, reportLink, nextStepsLink, internalReportLink, internalResultsDashboardLink };
}

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const slug = params.slug;
    const body = (await req.json()) as SendPayload;

    const org = await getOrgBySlug(slug);
    const takerRow = await getTakerById(body.takerId);
    const testRow = await getTestById(body.testId);

    const type: EmailTemplateType = body.type;

    // ✅ Decide which token to use for report links
    // - For report/resend_report/test_owner_notification: MUST match the submission token
    // - For send_test_link: use takerRow.link_token (the distribution token)
    let reportToken = takerRow.link_token;

    if (type === "report" || type === "resend_report" || type === "test_owner_notification") {
      const latest = await getLatestSubmissionTokenForTaker({ takerId: takerRow.id, testId: body.testId });
      if (latest.token) {
        reportToken = latest.token;
      } else {
        // Fallback: takerRow.link_token (better than nothing, but may mismatch)
        console.warn("[communications/send] No matching submission token found; falling back to taker.link_token", {
          takerId: takerRow.id,
          testId: body.testId,
        });
      }
    }

    const { testLink, reportLink, nextStepsLink, internalReportLink, internalResultsDashboardLink } = buildLinks({
      orgSlug: slug,
      testId: body.testId,
      testLinkToken: takerRow.link_token,
      reportToken,
      lastResultUrl: takerRow.last_result_url,
      takerId: takerRow.id,
      testSlug: testRow.slug,
      testType: testRow.test_type,
    });

    const firstName = takerRow.first_name || "";
    const lastName = takerRow.last_name || "";
    const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

    const ctx = {
      first_name: firstName,
      last_name: lastName,

      test_taker_full_name: fullName || takerRow.email || "",
      test_taker_email: takerRow.email || "",
      test_taker_mobile: takerRow.phone || "",
      test_taker_org: takerRow.company || "",

      test_name: testRow.name || "your assessment",
      org_name: org.name || slug,

      test_link: testLink,
      report_link: reportLink,
      next_steps_link: nextStepsLink,

      internal_report_link: internalReportLink,
      internal_results_dashboard_link: internalResultsDashboardLink,

      owner_first_name: "",
      owner_full_name: "",
      owner_email: org.support_email || "",
      owner_website: org.website_url || org.website || "",
    };

    // Recipient routing
    let sentTo = "";
    if (type === "test_owner_notification") {
      sentTo = normalizeEmail(org.notification_email) || getDefaultInternalEmail();
    } else {
      sentTo = normalizeEmail(takerRow.email);
      if (!sentTo) {
        return NextResponse.json({ error: "NO_EMAIL", message: "Test taker has no email address." }, { status: 400 });
      }
    }

    const result = await sendTemplatedEmail({
      orgId: org.id,
      type,
      to: sentTo,
      context: ctx,
    });

    if (!result.ok) {
      return NextResponse.json({ error: "SEND_FAILED", detail: result }, { status: 500 });
    }

    return NextResponse.json(
      {
        ok: true,
        sent_to: sentTo,
        type,
        links: {
          report_link: reportLink,
          test_link: testLink,
          internal_report_link: internalReportLink,
          internal_results_dashboard_link: internalResultsDashboardLink,
        },
        debug: {
          report_token_used: reportToken,
          taker_link_token: takerRow.link_token,
        },
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[communications/send] Error", err);
    const msg = typeof err?.message === "string" ? err.message : "UNKNOWN";
    const status = msg === "ORG_NOT_FOUND" || msg === "TAKER_NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
