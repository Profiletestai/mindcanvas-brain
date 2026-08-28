//apps/web/lib/mcas/mcasTestLinks.ts
import "server-only";
import { createClient } from "@supabase/supabase-js";

export type McasTestLinkType =
  | "candidate_assessment"
  | "reverse_role_assessment"
  | "internal_validation";

export type McasReportVersion = "lite" | "full";
export type McasUsageLimitType = "unlimited" | "limited";

export type McasTestLinkRow = {
  id: string;
  org_id: string;
  /**
   * Owning portal.orgs row, set only on links created from the portal.
   * NULL for links created in /admin/mcas. Added by migration 20260813130000.
   */
  portal_org_id: string | null;
  public_token: string;
  link_type: McasTestLinkType;
  framework_slug: string;
  framework_version: string;
  name: string;
  contact_owner_name: string | null;
  recipient_email: string | null;
  send_email: boolean;
  report_version: McasReportVersion;
  show_results: boolean;
  email_report: boolean;
  next_steps_url: string | null;
  usage_limit_type: McasUsageLimitType;
  usage_limit_count: number | null;
  status: "active" | "paused" | "expired" | "archived";
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type McasOrganisationLite = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

export type McasAdminTestLink = {
  id: string;
  orgId: string;
  portalOrgId: string | null;
  publicToken: string;
  linkType: McasTestLinkType;
  frameworkSlug: string;
  frameworkVersion: string;
  name: string;
  contactOwnerName: string | null;
  recipientEmail: string | null;
  sendEmail: boolean;
  reportVersion: McasReportVersion;
  showResults: boolean;
  emailReport: boolean;
  nextStepsUrl: string | null;
  usageLimitType: McasUsageLimitType;
  usageLimitCount: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  reusableUrl: string;
  totalApplications: number;
  completedApplications: number;
  openApplications: number;
};

export type CreateMcasReusableTestLinkInput = {
  orgId: string;
  /**
   * Owning portal organisation. Set by the portal APIs; /admin/mcas passes
   * nothing and the link stays outside every portal tenant.
   */
  portalOrgId?: string | null;
  linkType: McasTestLinkType;
  name: string;
  contactOwnerName?: string | null;
  recipientEmail?: string | null;
  sendEmail: boolean;
  reportVersion: McasReportVersion;
  showResults: boolean;
  emailReport: boolean;
  nextStepsUrl?: string | null;
  usageLimitType: McasUsageLimitType;
  usageLimitCount?: number | null;
};

export type CreateMcasReusableTestLinkResult = {
  id: string;
  publicToken: string;
  reusableUrl: string;
};

export type McasPublicTestLinkStatus =
  | {
      ok: true;
      link: McasTestLinkRow;
      organisation: McasOrganisationLite;
      reusableUrl: string;
      completedApplications: number;
      totalApplications: number;
    }
  | {
      ok: false;
      reason: "not_found" | "inactive" | "usage_limit_reached";
      message: string;
    };

function getMcasClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    db: {
      schema: "mcas",
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function getMcasPublicBaseUrl(): string {
  const explicitUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.APP_URL;

  if (explicitUrl) {
    return explicitUrl.replace(/\/$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/$/, "");
  }

  return "http://localhost:3000";
}

export function buildMcasReusableTestLinkUrl(publicToken: string): string {
  return `${getMcasPublicBaseUrl()}/mcas/link/${publicToken}`;
}

export function buildMcasCandidateApplicationUrl(publicToken: string): string {
  return `${getMcasPublicBaseUrl()}/mcas/t/${publicToken}`;
}

export async function createMcasReusableTestLink(
  input: CreateMcasReusableTestLinkInput,
): Promise<CreateMcasReusableTestLinkResult> {
  const supabase = getMcasClient();

  const name = cleanText(input.name);

  if (!name) {
    throw new Error("Test name / test purpose is required.");
  }

  if (input.sendEmail && !cleanText(input.recipientEmail)) {
    throw new Error("Recipient email is required when send email is selected.");
  }

  if (input.showResults && !cleanText(input.nextStepsUrl)) {
    throw new Error("Next steps URL is required when results are shown to the taker.");
  }

  if (
    input.usageLimitType === "limited" &&
    (!input.usageLimitCount || input.usageLimitCount < 1)
  ) {
    throw new Error("Usage limit count must be at least 1 when Limited is selected.");
  }

  const payload = {
    org_id: input.orgId,
    portal_org_id: input.portalOrgId ?? null,
    link_type: input.linkType,
    framework_slug: "mcas-core-alignment",
    framework_version: "v1",
    name,
    contact_owner_name: cleanText(input.contactOwnerName),
    recipient_email: cleanText(input.recipientEmail),
    send_email: input.sendEmail,
    report_version: input.reportVersion,
    show_results: input.showResults,
    email_report: input.emailReport,
    next_steps_url: cleanText(input.nextStepsUrl),
    usage_limit_type: input.usageLimitType,
    usage_limit_count:
      input.usageLimitType === "limited" ? input.usageLimitCount ?? null : null,
    status: "active",
    settings: {},
  };

  const { data, error } = await supabase
    .from("test_links")
    .insert(payload)
    .select("id, public_token")
    .single();

  if (error) {
    throw new Error(`Failed to create MCAS test link: ${error.message}`);
  }

  return {
    id: data.id as string,
    publicToken: data.public_token as string,
    reusableUrl: buildMcasReusableTestLinkUrl(data.public_token as string),
  };
}

/**
 * Lists MCAS test links, scoped either to an mcas.organisations row (admin) or
 * to a portal.orgs row (portal). Exactly one of `orgId` / `portalOrgId` must be
 * given — the scope is applied in the query, never in application code.
 */
export async function getMcasAdminTestLinks({
  orgId,
  portalOrgId,
  limit = 100,
}: {
  orgId?: string;
  portalOrgId?: string;
  limit?: number;
}): Promise<McasAdminTestLink[]> {
  if (!orgId && !portalOrgId) {
    throw new Error("getMcasAdminTestLinks requires orgId or portalOrgId");
  }

  const supabase = getMcasClient();

  let request = supabase
    .from("test_links")
    .select("*")
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(limit);

  request = portalOrgId
    ? request.eq("portal_org_id", portalOrgId)
    : request.eq("org_id", orgId as string);

  const { data, error } = await request;

  if (error) {
    throw new Error(`Failed to load MCAS test links: ${error.message}`);
  }

  const links = (data ?? []) as McasTestLinkRow[];

  const counts = await countApplicationsByLink(
    supabase,
    links.map((link) => link.id),
  );

  return links.map((link) => {
    const tally = counts.get(link.id) ?? { total: 0, completed: 0 };

    return {
      id: link.id,
      orgId: link.org_id,
      portalOrgId: link.portal_org_id ?? null,
      publicToken: link.public_token,
      linkType: link.link_type,
      frameworkSlug: link.framework_slug,
      frameworkVersion: link.framework_version,
      name: link.name,
      contactOwnerName: link.contact_owner_name,
      recipientEmail: link.recipient_email,
      sendEmail: link.send_email,
      reportVersion: link.report_version,
      showResults: link.show_results,
      emailReport: link.email_report,
      nextStepsUrl: link.next_steps_url,
      usageLimitType: link.usage_limit_type,
      usageLimitCount: link.usage_limit_count,
      status: link.status,
      createdAt: link.created_at,
      updatedAt: link.updated_at,
      reusableUrl: buildMcasReusableTestLinkUrl(link.public_token),
      totalApplications: tally.total,
      completedApplications: tally.completed,
      openApplications: Math.max(tally.total - tally.completed, 0),
    };
  });
}

/**
 * One round trip for every link's application tally, instead of two per link.
 */
async function countApplicationsByLink(
  supabase: ReturnType<typeof getMcasClient>,
  linkIds: string[],
): Promise<Map<string, { total: number; completed: number }>> {
  const counts = new Map<string, { total: number; completed: number }>();

  if (linkIds.length === 0) return counts;

  const { data, error } = await supabase
    .from("partner_applications")
    .select("test_link_id, status")
    .in("test_link_id", linkIds);

  if (error) {
    throw new Error(`Failed to count MCAS applications: ${error.message}`);
  }

  for (const row of (data ?? []) as Array<{
    test_link_id: string | null;
    status: string | null;
  }>) {
    if (!row.test_link_id) continue;

    const tally = counts.get(row.test_link_id) ?? { total: 0, completed: 0 };

    tally.total += 1;
    if (row.status === "completed") tally.completed += 1;

    counts.set(row.test_link_id, tally);
  }

  return counts;
}

export async function getMcasPublicTestLinkStatus(
  publicToken: string,
): Promise<McasPublicTestLinkStatus> {
  const supabase = getMcasClient();

  const { data: link, error: linkError } = await supabase
    .from("test_links")
    .select("*")
    .eq("public_token", publicToken)
    .maybeSingle();

  if (linkError) {
    throw new Error(`Failed to load MCAS test link: ${linkError.message}`);
  }

  if (!link) {
    return {
      ok: false,
      reason: "not_found",
      message: "This MCAS test link could not be found.",
    };
  }

  const testLink = link as McasTestLinkRow;

  if (testLink.status !== "active") {
    return {
      ok: false,
      reason: "inactive",
      message: "This MCAS test link is not currently active.",
    };
  }

  const { data: org, error: orgError } = await supabase
    .from("organisations")
    .select("id, name, slug, status")
    .eq("id", testLink.org_id)
    .maybeSingle();

  if (orgError) {
    throw new Error(`Failed to load MCAS organisation: ${orgError.message}`);
  }

  if (!org) {
    return {
      ok: false,
      reason: "not_found",
      message: "The organisation for this MCAS link could not be found.",
    };
  }

  const [totalResult, completedResult] = await Promise.all([
    supabase
      .from("partner_applications")
      .select("id", { count: "exact", head: true })
      .eq("test_link_id", testLink.id),

    supabase
      .from("partner_applications")
      .select("id", { count: "exact", head: true })
      .eq("test_link_id", testLink.id)
      .eq("status", "completed"),
  ]);

  if (totalResult.error) {
    throw new Error(`Failed to check MCAS link usage: ${totalResult.error.message}`);
  }

  if (completedResult.error) {
    throw new Error(
      `Failed to check completed MCAS link usage: ${completedResult.error.message}`,
    );
  }

  const totalApplications = totalResult.count ?? 0;
  const completedApplications = completedResult.count ?? 0;

  if (
    testLink.usage_limit_type === "limited" &&
    testLink.usage_limit_count !== null &&
    completedApplications >= testLink.usage_limit_count
  ) {
    return {
      ok: false,
      reason: "usage_limit_reached",
      message: "This MCAS test link has reached its completion limit.",
    };
  }

  return {
    ok: true,
    link: testLink,
    organisation: org as McasOrganisationLite,
    reusableUrl: buildMcasReusableTestLinkUrl(testLink.public_token),
    totalApplications,
    completedApplications,
  };
}

export async function createMcasApplicationFromReusableLink(
  publicToken: string,
): Promise<{ applicationPublicToken: string }> {
  const supabase = getMcasClient();

  const status = await getMcasPublicTestLinkStatus(publicToken);

  if (!status.ok) {
    throw new Error(status.message);
  }

  const link = status.link;
  const org = status.organisation;

  // Quota is checked here, before the candidate answers 25 questions — not at
  // submit time, where the only options would be to discard their answers or to
  // exceed the plan. Mirrors the open/start gate the GED flow uses.
  if (link.portal_org_id) {
    const availability = await getMcasSubmissionAvailability(link.portal_org_id);

    if (!availability.available) {
      throw new Error(
        availability.reason === "no_subscription"
          ? "This organisation does not have an active subscription."
          : "This organisation has no assessment credits remaining.",
      );
    }
  }

  const applicationId = generateMcasApplicationId(org.slug, link.public_token);

  const { data, error } = await supabase
    .from("partner_applications")
    .insert({
      partner_key: org.slug,
      application_id: applicationId,
      org_id: org.id,
      // Ownership snapshot: taken at creation so the candidate stays attributed
      // even if the link is later disabled or re-pointed.
      portal_org_id: link.portal_org_id ?? null,
      test_link_id: link.id,
      framework_slug: link.framework_slug,
      framework_version: link.framework_version,
      status: "created",
      candidate_email: cleanText(link.recipient_email),
    })
    .select("public_token")
    .single();

  if (error) {
    throw new Error(`Failed to start MCAS assessment: ${error.message}`);
  }

  return {
    applicationPublicToken: data.public_token as string,
  };
}

/**
 * Read-only quota check for an MCAS link's owning portal org. Consumes nothing.
 *
 * Imports are deferred so that the public MCAS path — which is mostly used by
 * links with no portal owner — does not pull the billing/Stripe module graph in
 * on every request.
 */
async function getMcasSubmissionAvailability(portalOrgId: string): Promise<{
  available: boolean;
  reason?: string;
}> {
  const [{ getSubmissionAvailability }, { getMcasCatalogueTestId }] =
    await Promise.all([
      import("@/app/_lib/billing"),
      import("@/lib/portal/authz"),
    ]);

  const testId = await getMcasCatalogueTestId();

  if (!testId) {
    // Migration 20260813120000 has not run here. Never block a candidate over a
    // missing catalogue row — usage recording will log the same problem later.
    console.warn(
      "[MCAS] No portal.tests row for mcas-core-alignment; skipping quota check",
    );
    return { available: true };
  }

  const availability = await getSubmissionAvailability(portalOrgId, testId);

  return { available: availability.available, reason: availability.reason };
}

function generateMcasApplicationId(orgSlug: string, linkToken: string): string {
  const cleanSlug = orgSlug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const tokenPart = linkToken.slice(0, 8);

  const timestamp = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14);

  const random = Math.random().toString(36).slice(2, 8);

  return `${cleanSlug}-${tokenPart}-${timestamp}-${random}`;
}

function cleanText(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}