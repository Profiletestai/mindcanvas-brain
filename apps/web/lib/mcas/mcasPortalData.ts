// apps/web/lib/mcas/mcasPortalData.ts
// Portal-scoped adapter over the existing MCAS schema.
//
// Every read and write here filters on mcas.*.portal_org_id, always inside the
// query and never in application code, so a bug in a route handler cannot leak
// one tenant's candidates into another's list. MCAS questions, scoring and
// results are untouched — this file only re-scopes and re-shapes what already
// exists (lib/mcas/mcasTestLinks.ts, lib/mcas/mcasAdminData.ts).

import "server-only";

import { createClient } from "@supabase/supabase-js";

import {
  normaliseCandidateDatabaseRow,
  type McasCandidateDatabaseRow,
  type McasCandidateDatabaseViewRow,
} from "@/lib/mcas/mcasAdminData";
import {
  createMcasReusableTestLink,
  getMcasAdminTestLinks,
  type CreateMcasReusableTestLinkInput,
  type McasAdminTestLink,
  type McasReportVersion,
  type McasUsageLimitType,
} from "@/lib/mcas/mcasTestLinks";

function mcasAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, key, {
    db: { schema: "mcas" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// -------------------------------------------------------------------
// Organisation mirror
// -------------------------------------------------------------------

/**
 * mcas.test_links.org_id is NOT NULL and references mcas.organisations, a table
 * distinct from portal.orgs. Rather than relax that column (which would break
 * getMcasPublicTestLinkStatus, partner_key generation and the /admin/mcas org
 * pages), each portal org gets a mirror row in mcas.organisations, matched on
 * slug. portal_org_id remains the authoritative owner for every portal query;
 * this mirror exists only to satisfy the MCAS schema's own invariants.
 *
 * Idempotent: safe to call on every link creation.
 */
export async function ensureMcasOrganisationForPortalOrg(portalOrg: {
  id: string;
  slug: string;
  name: string;
}): Promise<{ id: string; slug: string }> {
  const supabase = mcasAdmin();

  const { data: existing, error: lookupError } = await supabase
    .from("organisations")
    .select("id, slug")
    .eq("slug", portalOrg.slug)
    .maybeSingle();

  if (lookupError) {
    throw new Error(
      `Failed to resolve MCAS organisation: ${lookupError.message}`,
    );
  }

  if (existing) return existing as { id: string; slug: string };

  const { data: created, error: insertError } = await supabase
    .from("organisations")
    .insert({
      slug: portalOrg.slug,
      name: portalOrg.name,
      status: "active",
    })
    .select("id, slug")
    .single();

  if (insertError) {
    // Lost a race with a concurrent create — re-read rather than fail.
    if (insertError.code === "23505") {
      const { data: raced } = await supabase
        .from("organisations")
        .select("id, slug")
        .eq("slug", portalOrg.slug)
        .maybeSingle();

      if (raced) return raced as { id: string; slug: string };
    }

    throw new Error(
      `Failed to create MCAS organisation: ${insertError.message}`,
    );
  }

  return created as { id: string; slug: string };
}

// -------------------------------------------------------------------
// Links
// -------------------------------------------------------------------

/**
 * `reusableUrl` (/mcas/link/<token>) is the shareable link and comes straight
 * from getMcasAdminTestLinks.
 *
 * It is NOT /mcas/t/<token>: that route resolves a partner_application token,
 * and a test link's token is a different thing. The landing page mints one
 * application per candidate and redirects to /mcas/t/<application token>, which
 * is also where the quota gate runs. A /mcas/t/ URL built from a link token
 * gives the candidate "invalid candidate application token".
 */
export type PortalMcasLink = McasAdminTestLink;

export async function listPortalMcasLinks(
  portalOrgId: string,
  limit = 100,
): Promise<PortalMcasLink[]> {
  return getMcasAdminTestLinks({ portalOrgId, limit });
}

export type CreatePortalMcasLinkInput = {
  portalOrg: { id: string; slug: string; name: string };
  name: string;
  contactOwnerName?: string | null;
  recipientEmail?: string | null;
  sendEmail?: boolean;
  reportVersion?: McasReportVersion;
  showResults?: boolean;
  emailReport?: boolean;
  nextStepsUrl?: string | null;
  usageLimitType?: McasUsageLimitType;
  usageLimitCount?: number | null;
};

export type CreatePortalMcasLinkResult = {
  id: string;
  publicToken: string;
  /** Shareable landing page — one candidate record is created per start. */
  url: string;
};

export async function createPortalMcasLink(
  input: CreatePortalMcasLinkInput,
): Promise<CreatePortalMcasLinkResult> {
  const mcasOrg = await ensureMcasOrganisationForPortalOrg(input.portalOrg);

  const payload: CreateMcasReusableTestLinkInput = {
    orgId: mcasOrg.id,
    portalOrgId: input.portalOrg.id,
    // Portal users only ever create candidate assessments; reverse-role and
    // internal-validation links stay in /admin/mcas.
    linkType: "candidate_assessment",
    name: input.name,
    contactOwnerName: input.contactOwnerName ?? null,
    recipientEmail: input.recipientEmail ?? null,
    sendEmail: input.sendEmail ?? false,
    reportVersion: input.reportVersion ?? "full",
    showResults: input.showResults ?? false,
    emailReport: input.emailReport ?? false,
    nextStepsUrl: input.nextStepsUrl ?? null,
    usageLimitType: input.usageLimitType ?? "unlimited",
    usageLimitCount: input.usageLimitCount ?? null,
  };

  const created = await createMcasReusableTestLink(payload);

  return {
    id: created.id,
    publicToken: created.publicToken,
    url: created.reusableUrl,
  };
}

export type UpdatePortalMcasLinkPatch = {
  name?: string;
  status?: "active" | "paused" | "archived";
};

export type UpdatedPortalMcasLink = {
  id: string;
  name: string;
  status: string;
  updatedAt: string | null;
};

/**
 * Updates a link the org owns. The portal_org_id predicate is part of the
 * UPDATE, so a mismatched org changes zero rows and gets null back rather than
 * an authorisation check that could be forgotten at the call site.
 */
export async function updatePortalMcasLink(
  portalOrgId: string,
  linkId: string,
  patch: UpdatePortalMcasLinkPatch,
): Promise<UpdatedPortalMcasLink | null> {
  const supabase = mcasAdmin();

  const update: Record<string, unknown> = {};

  if (typeof patch.name === "string") {
    const name = patch.name.trim();
    if (!name) throw new Error("Test name cannot be empty.");
    update.name = name;
  }

  if (patch.status) update.status = patch.status;

  if (Object.keys(update).length === 0) {
    throw new Error("Nothing to update.");
  }

  const { data, error } = await supabase
    .from("test_links")
    .update(update)
    .eq("id", linkId)
    .eq("portal_org_id", portalOrgId)
    .select("id, name, status, updated_at")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update MCAS test link: ${error.message}`);
  }

  // Returned straight from the UPDATE rather than re-listing: an archived link
  // is filtered out of listPortalMcasLinks, so a re-read would report a
  // successful archive as "not found".
  if (!data) return null;

  const row = data as {
    id: string;
    name: string;
    status: string;
    updated_at: string | null;
  };

  return {
    id: row.id,
    name: row.name,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

// -------------------------------------------------------------------
// Candidates
// -------------------------------------------------------------------

export type ListPortalMcasCandidatesInput = {
  query?: string | null;
  status?: string | null;
  page?: number;
  pageSize?: number;
};

export type PortalMcasCandidatePage = {
  rows: McasCandidateDatabaseRow[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export async function listPortalMcasCandidates(
  portalOrgId: string,
  input: ListPortalMcasCandidatesInput = {},
): Promise<PortalMcasCandidatePage> {
  const supabase = mcasAdmin();

  const page = Math.max(1, Math.floor(input.page ?? 1));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.floor(input.pageSize ?? DEFAULT_PAGE_SIZE)),
  );

  const from = (page - 1) * pageSize;

  let request = supabase
    .from("v_portal_candidate_database")
    .select("*", { count: "exact" })
    .eq("portal_org_id", portalOrgId)
    .order("application_created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (input.status && input.status !== "all") {
    request = request.eq("application_status", input.status);
  }

  // Filtered in SQL, not after the fetch: the admin helper pulls 500 rows and
  // filters in JS, which cannot paginate correctly.
  const term = input.query?.trim();

  if (term) {
    const escaped = term.replace(/[%,()]/g, " ").trim();

    if (escaped) {
      request = request.or(
        [
          `candidate_first_name.ilike.%${escaped}%`,
          `candidate_last_name.ilike.%${escaped}%`,
          `candidate_email.ilike.%${escaped}%`,
          `application_id.ilike.%${escaped}%`,
        ].join(","),
      );
    }
  }

  const { data, error, count } = await request;

  if (error) {
    throw new Error(`Failed to load MCAS candidates: ${error.message}`);
  }

  const rows = ((data ?? []) as McasCandidateDatabaseViewRow[]).map(
    normaliseCandidateDatabaseRow,
  );

  const total = count ?? rows.length;

  return {
    rows,
    page,
    pageSize,
    total,
    hasMore: from + rows.length < total,
  };
}

export type PortalMcasCandidateDetail = McasCandidateDatabaseRow & {
  testLinkId: string | null;
  testLinkName: string | null;
  reportToken: string | null;
  reportVersion: McasReportVersion | null;
  /** Whether the MCAS report pages can be opened for this candidate. */
  reportReady: boolean;
  /** Why not, when reportReady is false. */
  reportReason: string | null;
  /**
   * Null when the link has show_results = false. That page 404s in this case —
   * it is gated on the candidate's own consent setting, not on staff access.
   */
  snapshotUrl: string | null;
  /** Always available once scored; the full report page has no gate. */
  fullReportUrl: string | null;
  /** What staff should open by default. */
  primaryReportUrl: string | null;
};

/**
 * Derives the candidate's report URLs.
 *
 * Same readiness rule as getMcasCandidateReportAccess() in
 * mcasCandidateReports.ts — a report token, a completed assessment and a scored
 * result — but read off the view instead of four more round trips, since the
 * candidate query already returned every field it needs.
 *
 * The URLs point at the existing public report routes. They are token-based and
 * unchanged by this integration.
 */
function deriveReportAccess(row: {
  assessment_report_token: string | null;
  assessment_status: string | null;
  result_id: string | null;
  test_link_report_version: McasReportVersion | null;
  test_link_show_results: boolean | null;
}): Pick<
  PortalMcasCandidateDetail,
  | "reportReady"
  | "reportReason"
  | "snapshotUrl"
  | "fullReportUrl"
  | "primaryReportUrl"
> {
  const notReady = (reason: string) => ({
    reportReady: false,
    reportReason: reason,
    snapshotUrl: null,
    fullReportUrl: null,
    primaryReportUrl: null,
  });

  const token = row.assessment_report_token?.trim();

  if (!token) {
    return notReady("This candidate has not submitted an assessment yet.");
  }

  if (row.assessment_status !== "completed" || !row.result_id) {
    return notReady("This assessment is still being completed or scored.");
  }

  const encoded = encodeURIComponent(token);
  const fullReportUrl = `/mcas/r/${encoded}/full`;

  // The snapshot page 404s unless the link allows the candidate to see their
  // own result (reportPayload.ts: snapshotUnlocked = test_link.show_results).
  // Offering staff a button that cannot render is worse than not offering it.
  const snapshotUrl = row.test_link_show_results
    ? `/mcas/r/${encoded}/snapshot`
    : null;

  return {
    reportReady: true,
    reportReason: null,
    snapshotUrl,
    fullReportUrl,
    // The full report is the staff default: it always renders, including for
    // lite links, where fullUnlocked only gates the candidate's upsell.
    primaryReportUrl: fullReportUrl,
  };
}

export async function getPortalMcasCandidate(
  portalOrgId: string,
  candidateId: string,
): Promise<PortalMcasCandidateDetail | null> {
  const supabase = mcasAdmin();

  const { data, error } = await supabase
    .from("v_portal_candidate_database")
    .select("*")
    .eq("portal_org_id", portalOrgId)
    .eq("partner_application_id", candidateId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load MCAS candidate: ${error.message}`);
  }

  if (!data) return null;

  const row = data as McasCandidateDatabaseViewRow & {
    test_link_id: string | null;
    test_link_name: string | null;
    test_link_report_version: McasReportVersion | null;
    test_link_show_results: boolean | null;
    assessment_report_token: string | null;
  };

  return {
    ...normaliseCandidateDatabaseRow(row),
    testLinkId: row.test_link_id ?? null,
    testLinkName: row.test_link_name ?? null,
    reportToken: row.assessment_report_token ?? null,
    reportVersion: row.test_link_report_version ?? null,
    ...deriveReportAccess(row),
  };
}
