//apps/web/lib/mcas/mcasAdminData.ts
import "server-only";
import { createClient } from "@supabase/supabase-js";

export type McasOrganisation = {
  id: string;
  name: string;
  slug: string;
  legal_name: string | null;
  organisation_type: string;
  status: string;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  branding: Record<string, unknown>;
  settings: Record<string, unknown>;
  external_refs: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type McasOrganisationSummary = McasOrganisation & {
  total_applications: number;
  completed_applications: number;
  open_applications: number;
};

export type McasOrgDashboardStats = {
  totalCandidates: number;
  completedAssessments: number;
  openAssessments: number;
  createdApplications: number;
  startedApplications: number;
  latestActivityAt: string | null;
};

export type McasApplicationStatus = "created" | "started" | "completed";

type McasCandidateDatabaseViewRow = {
  partner_application_id: string;
  org_id: string;
  partner_key: string;
  application_id: string;
  public_token: string;
  application_status: string;
  candidate_first_name: string | null;
  candidate_last_name: string | null;
  candidate_email: string | null;
  candidate_phone: string | null;
  consent: boolean | null;
  application_created_at: string;
  application_started_at: string | null;
  application_completed_at: string | null;

  assessment_id: string | null;
  assessment_status: string | null;
  assessment_started_at: string | null;
  assessment_completed_at: string | null;
  framework_slug: string | null;
  framework_version: string | null;
  assessment_meta: Record<string, unknown> | null;

  result_id: string | null;
  scoring_model: string | null;
  core_distribution: unknown | null;
  os_distribution: unknown | null;
  vertical_readiness: string | null;
  confidence: unknown | null;
  flags: unknown | null;
  result_computed_at: string | null;
};

export type McasCandidateDatabaseRow = {
  partnerApplicationId: string;
  orgId: string;
  partnerKey: string;
  applicationId: string;
  publicToken: string;
  status: string;

  firstName: string | null;
  lastName: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  consent: boolean | null;

  applicationCreatedAt: string;
  applicationStartedAt: string | null;
  applicationCompletedAt: string | null;
  assessmentDate: string | null;

  assessmentId: string | null;
  assessmentStatus: string | null;
  frameworkSlug: string | null;
  frameworkVersion: string | null;

  resultId: string | null;
  scoringModel: string | null;
  primaryOS: string | null;
  secondaryOS: string | null;
  primaryCV: string | null;
  verticalReadiness: string | null;

  rawCoreDistribution: unknown | null;
  rawOsDistribution: unknown | null;
  rawConfidence: unknown | null;
  rawFlags: unknown | null;
};

type McasPartnerApplicationRow = {
  id: string;
  partner_key: string;
  application_id: string;
  org_id: string;
  framework_slug: string;
  framework_version: string;
  public_token: string;
  status: string;
  candidate_email: string | null;
  candidate_first_name: string | null;
  candidate_last_name: string | null;
  candidate_phone: string | null;
  consent: boolean | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

export type McasTestLinkRow = {
  id: string;
  orgId: string;
  partnerKey: string;
  applicationId: string;
  publicToken: string;
  status: string;
  candidateFirstName: string | null;
  candidateLastName: string | null;
  candidateFullName: string;
  candidateEmail: string | null;
  candidatePhone: string | null;
  consent: boolean | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  frameworkSlug: string;
  frameworkVersion: string;
  testUrl: string;
};

export type CreateMcasCandidateLinkInput = {
  orgId: string;
  orgSlug: string;
  applicationId?: string | null;
  candidateFirstName?: string | null;
  candidateLastName?: string | null;
  candidateEmail?: string | null;
  candidatePhone?: string | null;
};

export type CreateMcasCandidateLinkResult = {
  id: string;
  publicToken: string;
  testUrl: string;
};

function getMcasAdminClient() {
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

export function buildMcasCandidateTestUrl(publicToken: string): string {
  return `${getMcasPublicBaseUrl()}/mcas/t/${publicToken}`;
}

export async function getMcasOrganisations(): Promise<McasOrganisation[]> {
  const supabase = getMcasAdminClient();

  const { data, error } = await supabase
    .from("organisations")
    .select("*")
    .neq("status", "archived")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load MCAS organisations: ${error.message}`);
  }

  return (data ?? []) as McasOrganisation[];
}

export async function getMcasOrganisationBySlug(
  slug: string,
): Promise<McasOrganisation | null> {
  const supabase = getMcasAdminClient();

  const { data, error } = await supabase
    .from("organisations")
    .select("*")
    .eq("slug", slug)
    .neq("status", "archived")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load MCAS organisation: ${error.message}`);
  }

  return (data ?? null) as McasOrganisation | null;
}

export async function getMcasOrganisationSummaries(): Promise<
  McasOrganisationSummary[]
> {
  const organisations = await getMcasOrganisations();
  const supabase = getMcasAdminClient();

  const summaries = await Promise.all(
    organisations.map(async (org) => {
      const { count: totalCount, error: totalError } = await supabase
        .from("partner_applications")
        .select("id", { count: "exact", head: true })
        .eq("org_id", org.id);

      if (totalError) {
        throw new Error(
          `Failed to count MCAS applications for ${org.name}: ${totalError.message}`,
        );
      }

      const { count: completedCount, error: completedError } = await supabase
        .from("partner_applications")
        .select("id", { count: "exact", head: true })
        .eq("org_id", org.id)
        .eq("status", "completed");

      if (completedError) {
        throw new Error(
          `Failed to count completed MCAS applications for ${org.name}: ${completedError.message}`,
        );
      }

      const totalApplications = totalCount ?? 0;
      const completedApplications = completedCount ?? 0;

      return {
        ...org,
        total_applications: totalApplications,
        completed_applications: completedApplications,
        open_applications: Math.max(
          totalApplications - completedApplications,
          0,
        ),
      };
    }),
  );

  return summaries;
}

export async function getMcasOrgDashboardStats(
  orgId: string,
): Promise<McasOrgDashboardStats> {
  const supabase = getMcasAdminClient();

  const [
    totalApplicationsResult,
    completedApplicationsResult,
    createdApplicationsResult,
    startedApplicationsResult,
    latestApplicationResult,
  ] = await Promise.all([
    supabase
      .from("partner_applications")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId),

    supabase
      .from("partner_applications")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "completed"),

    supabase
      .from("partner_applications")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "created"),

    supabase
      .from("partner_applications")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "started"),

    supabase
      .from("partner_applications")
      .select("created_at, started_at, completed_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (totalApplicationsResult.error) {
    throw new Error(
      `Failed to count MCAS applications: ${totalApplicationsResult.error.message}`,
    );
  }

  if (completedApplicationsResult.error) {
    throw new Error(
      `Failed to count completed MCAS applications: ${completedApplicationsResult.error.message}`,
    );
  }

  if (createdApplicationsResult.error) {
    throw new Error(
      `Failed to count created MCAS applications: ${createdApplicationsResult.error.message}`,
    );
  }

  if (startedApplicationsResult.error) {
    throw new Error(
      `Failed to count started MCAS applications: ${startedApplicationsResult.error.message}`,
    );
  }

  if (latestApplicationResult.error) {
    throw new Error(
      `Failed to load latest MCAS activity: ${latestApplicationResult.error.message}`,
    );
  }

  const latest = latestApplicationResult.data;

  return {
    totalCandidates: totalApplicationsResult.count ?? 0,
    completedAssessments: completedApplicationsResult.count ?? 0,
    openAssessments:
      (totalApplicationsResult.count ?? 0) -
      (completedApplicationsResult.count ?? 0),
    createdApplications: createdApplicationsResult.count ?? 0,
    startedApplications: startedApplicationsResult.count ?? 0,
    latestActivityAt:
      latest?.completed_at ?? latest?.started_at ?? latest?.created_at ?? null,
  };
}

export async function getMcasCandidateDatabaseRows({
  orgId,
  query,
  status,
}: {
  orgId: string;
  query?: string;
  status?: string;
}): Promise<McasCandidateDatabaseRow[]> {
  const supabase = getMcasAdminClient();

  let request = supabase
    .from("v_admin_candidate_database")
    .select("*")
    .eq("org_id", orgId)
    .order("application_created_at", { ascending: false })
    .limit(500);

  if (status && status !== "all") {
    request = request.eq("application_status", status);
  }

  const { data, error } = await request;

  if (error) {
    throw new Error(`Failed to load MCAS candidate database: ${error.message}`);
  }

  let rows = ((data ?? []) as McasCandidateDatabaseViewRow[]).map(
    normaliseCandidateDatabaseRow,
  );

  const trimmedQuery = query?.trim().toLowerCase();

  if (trimmedQuery) {
    rows = rows.filter((row) => {
      const haystack = [
        row.fullName,
        row.email,
        row.applicationId,
        row.partnerKey,
        row.primaryOS,
        row.secondaryOS,
        row.primaryCV,
        row.verticalReadiness,
        row.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(trimmedQuery);
    });
  }

  return rows;
}

export async function getMcasCandidateDetailById({
  orgId,
  candidateId,
}: {
  orgId: string;
  candidateId: string;
}): Promise<McasCandidateDatabaseRow | null> {
  const supabase = getMcasAdminClient();

  const { data, error } = await supabase
    .from("v_admin_candidate_database")
    .select("*")
    .eq("org_id", orgId)
    .eq("partner_application_id", candidateId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load MCAS candidate detail: ${error.message}`);
  }

  if (!data) return null;

  return normaliseCandidateDatabaseRow(data as McasCandidateDatabaseViewRow);
}

export async function createMcasCandidateAssessmentLink(
  input: CreateMcasCandidateLinkInput,
): Promise<CreateMcasCandidateLinkResult> {
  const supabase = getMcasAdminClient();

  const partnerKey = input.orgSlug;
  const applicationId =
    cleanText(input.applicationId) ?? generateMcasApplicationId(input.orgSlug);

  const payload = {
    org_id: input.orgId,
    partner_key: partnerKey,
    application_id: applicationId,
    framework_slug: "mcas-core-alignment",
    framework_version: "v1",
    status: "created",
    candidate_first_name: cleanText(input.candidateFirstName),
    candidate_last_name: cleanText(input.candidateLastName),
    candidate_email: cleanText(input.candidateEmail),
    candidate_phone: cleanText(input.candidatePhone),
  };

  const { data, error } = await supabase
    .from("partner_applications")
    .insert(payload)
    .select("id, public_token")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error(
        "A link with this Application ID already exists for this organisation. Use a different Application ID or leave it blank to auto-generate one.",
      );
    }

    throw new Error(`Failed to create MCAS test link: ${error.message}`);
  }

  return {
    id: data.id as string,
    publicToken: data.public_token as string,
    testUrl: buildMcasCandidateTestUrl(data.public_token as string),
  };
}

export async function getMcasTestLinks({
  orgId,
  limit = 100,
}: {
  orgId: string;
  limit?: number;
}): Promise<McasTestLinkRow[]> {
  const supabase = getMcasAdminClient();

  const { data, error } = await supabase
    .from("partner_applications")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load MCAS test links: ${error.message}`);
  }

  return ((data ?? []) as McasPartnerApplicationRow[]).map(normaliseTestLinkRow);
}

function normaliseCandidateDatabaseRow(
  row: McasCandidateDatabaseViewRow,
): McasCandidateDatabaseRow {
  const firstName = cleanText(row.candidate_first_name);
  const lastName = cleanText(row.candidate_last_name);

  const fullName =
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    "Unnamed candidate";

  const osRank = readDistribution(row.os_distribution);

  const primaryCV = cleanText(row.vertical_readiness);

  return {
    partnerApplicationId: row.partner_application_id,
    orgId: row.org_id,
    partnerKey: row.partner_key,
    applicationId: row.application_id,
    publicToken: row.public_token,
    status: row.application_status,

    firstName,
    lastName,
    fullName,
    email: cleanText(row.candidate_email),
    phone: cleanText(row.candidate_phone),
    consent: row.consent,

    applicationCreatedAt: row.application_created_at,
    applicationStartedAt: row.application_started_at,
    applicationCompletedAt: row.application_completed_at,
    assessmentDate:
      row.application_completed_at ??
      row.assessment_completed_at ??
      row.application_started_at ??
      row.assessment_started_at ??
      row.application_created_at,

    assessmentId: row.assessment_id,
    assessmentStatus: row.assessment_status,
    frameworkSlug: row.framework_slug,
    frameworkVersion: row.framework_version,

    resultId: row.result_id,
    scoringModel: row.scoring_model,
    primaryOS: osRank[0]?.code ?? null,
    secondaryOS: osRank[1]?.code ?? null,
    primaryCV,
    verticalReadiness: primaryCV,

    rawCoreDistribution: row.core_distribution,
    rawOsDistribution: row.os_distribution,
    rawConfidence: row.confidence,
    rawFlags: row.flags,
  };
}

function normaliseTestLinkRow(row: McasPartnerApplicationRow): McasTestLinkRow {
  const firstName = cleanText(row.candidate_first_name);
  const lastName = cleanText(row.candidate_last_name);

  return {
    id: row.id,
    orgId: row.org_id,
    partnerKey: row.partner_key,
    applicationId: row.application_id,
    publicToken: row.public_token,
    status: row.status,
    candidateFirstName: firstName,
    candidateLastName: lastName,
    candidateFullName:
      [firstName, lastName].filter(Boolean).join(" ").trim() ||
      "Open candidate link",
    candidateEmail: cleanText(row.candidate_email),
    candidatePhone: cleanText(row.candidate_phone),
    consent: row.consent,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    frameworkSlug: row.framework_slug,
    frameworkVersion: row.framework_version,
    testUrl: buildMcasCandidateTestUrl(row.public_token),
  };
}

function generateMcasApplicationId(orgSlug: string): string {
  const cleanSlug = orgSlug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const timestamp = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14);

  const random = Math.random().toString(36).slice(2, 8);

  return `${cleanSlug}-${timestamp}-${random}`;
}

function cleanText(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function readDistribution(value: unknown): Array<{ code: string; value: number }> {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (!item || typeof item !== "object") return null;

        const object = item as Record<string, unknown>;

        const code =
          asString(object.code) ??
          asString(object.key) ??
          asString(object.label) ??
          asString(object.name);

        const distributionValue =
          asNumber(object.pct) ??
          asNumber(object.percentage) ??
          asNumber(object.percent) ??
          asNumber(object.score) ??
          asNumber(object.value) ??
          asNumber(object.count);

        if (!code || distributionValue === null) return null;

        return {
          code,
          value: distributionValue,
        };
      })
      .filter((item): item is { code: string; value: number } => Boolean(item))
      .sort((a, b) => b.value - a.value);
  }

  if (typeof value === "object") {
    const object = value as Record<string, unknown>;

    return Object.entries(object)
      .map(([key, rawValue]) => {
        if (typeof rawValue === "number") {
          return {
            code: key,
            value: rawValue,
          };
        }

        if (typeof rawValue === "string") {
          const parsed = Number(rawValue);

          if (!Number.isNaN(parsed)) {
            return {
              code: key,
              value: parsed,
            };
          }
        }

        if (rawValue && typeof rawValue === "object") {
          const nested = rawValue as Record<string, unknown>;

          const code =
            asString(nested.code) ??
            asString(nested.key) ??
            asString(nested.label) ??
            key;

          const distributionValue =
            asNumber(nested.pct) ??
            asNumber(nested.percentage) ??
            asNumber(nested.percent) ??
            asNumber(nested.score) ??
            asNumber(nested.value) ??
            asNumber(nested.count);

          if (distributionValue === null) return null;

          return {
            code,
            value: distributionValue,
          };
        }

        return null;
      })
      .filter((item): item is { code: string; value: number } => Boolean(item))
      .sort((a, b) => b.value - a.value);
  }

  return [];
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

export function formatMcasDate(value: string | null | undefined): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-ZA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

export function formatMcasDateTime(value: string | null | undefined): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-ZA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}