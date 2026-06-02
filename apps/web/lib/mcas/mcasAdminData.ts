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
        open_applications: Math.max(totalApplications - completedApplications, 0),
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