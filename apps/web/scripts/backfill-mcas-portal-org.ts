/**
 * Backfill mcas.*.portal_org_id for existing MCAS records.
 *
 * Run from apps/web (tsx lives in the repo root's devDependencies):
 *
 *   pnpm exec tsx scripts/backfill-mcas-portal-org.ts
 *   pnpm exec tsx scripts/backfill-mcas-portal-org.ts --apply
 *
 * Dry run by default: it reports exactly what it would write and exits without
 * touching a row. Nothing happens without --apply.
 *
 * The mapping is explicit and file-driven, never inferred. Slugs match between
 * the two schemas often enough to be tempting and not often enough to be safe —
 * a wrong guess files one customer's candidates under another customer.
 *
 * Mapping file (default scripts/mcas-portal-org-map.json):
 *
 *   [
 *     { "mcasOrgSlug": "acme-partners", "portalOrgSlug": "acme" },
 *     { "mcasOrgSlug": "globex",        "portalOrgSlug": "globex-group" }
 *   ]
 *
 * Run query 10 in supabase/sql-snippets/mcas_portal_integration_preflight.sql to
 * see every mcas.organisations row with its volumes before agreeing the list.
 *
 * Re-runnable: only rows whose portal_org_id is still NULL are written, so an
 * assessment already attributed is never re-pointed.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

/** The schema-pinned clients this script uses; SupabaseClient's default generics
 *  assume the public schema. */
type SchemaClient = ReturnType<typeof client>;

type MappingEntry = {
  mcasOrgSlug: string;
  portalOrgSlug: string;
};

type Counts = {
  links: number;
  applications: number;
  assessments: number;
};

const APPLY = process.argv.includes("--apply");

const MAP_PATH = resolve(
  process.cwd(),
  argValue("--map") ?? "scripts/mcas-portal-org-map.json",
);

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

function client(schema: "mcas" | "portal") {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running.",
    );
  }

  return createClient(url, key, {
    db: { schema },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function loadMapping(): MappingEntry[] {
  let raw: string;

  try {
    raw = readFileSync(MAP_PATH, "utf8");
  } catch {
    throw new Error(
      `No mapping file at ${MAP_PATH}. Create one (see the header of this script) or pass --map <path>.`,
    );
  }

  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`${MAP_PATH} must be a non-empty JSON array.`);
  }

  return parsed.map((entry, index) => {
    const mcasOrgSlug = String(entry?.mcasOrgSlug ?? "").trim();
    const portalOrgSlug = String(entry?.portalOrgSlug ?? "").trim();

    if (!mcasOrgSlug || !portalOrgSlug) {
      throw new Error(
        `Entry ${index} in ${MAP_PATH} needs both mcasOrgSlug and portalOrgSlug.`,
      );
    }

    return { mcasOrgSlug, portalOrgSlug };
  });
}

async function countUnattributed(
  mcas: SchemaClient,
  mcasOrgId: string,
  linkIds: string[],
): Promise<Counts> {
  const [links, applications, assessments] = await Promise.all([
    mcas
      .from("test_links")
      .select("id", { count: "exact", head: true })
      .eq("org_id", mcasOrgId)
      .is("portal_org_id", null),

    mcas
      .from("partner_applications")
      .select("id", { count: "exact", head: true })
      .eq("org_id", mcasOrgId)
      .is("portal_org_id", null),

    linkIds.length
      ? mcas
          .from("assessments")
          .select("id", { count: "exact", head: true })
          .in("test_link_id", linkIds)
          .is("portal_org_id", null)
      : Promise.resolve({ count: 0, error: null }),
  ]);

  for (const result of [links, applications, assessments]) {
    if ("error" in result && result.error) throw result.error;
  }

  return {
    links: links.count ?? 0,
    applications: applications.count ?? 0,
    assessments: assessments.count ?? 0,
  };
}

async function main() {
  const mapping = loadMapping();
  const mcas = client("mcas");
  const portal = client("portal");

  console.log(
    `${APPLY ? "APPLYING" : "DRY RUN"} — ${mapping.length} organisation mapping(s) from ${MAP_PATH}\n`,
  );

  const totals: Counts = { links: 0, applications: 0, assessments: 0 };
  let failures = 0;

  for (const entry of mapping) {
    const { data: portalOrg, error: portalError } = await portal
      .from("orgs")
      .select("id, slug, name")
      .eq("slug", entry.portalOrgSlug)
      .maybeSingle();

    if (portalError) throw portalError;

    if (!portalOrg) {
      console.error(`  ✗ ${entry.mcasOrgSlug}: no portal org "${entry.portalOrgSlug}"`);
      failures += 1;
      continue;
    }

    const { data: mcasOrg, error: mcasError } = await mcas
      .from("organisations")
      .select("id, slug")
      .eq("slug", entry.mcasOrgSlug)
      .maybeSingle();

    if (mcasError) throw mcasError;

    if (!mcasOrg) {
      console.error(`  ✗ ${entry.mcasOrgSlug}: no MCAS organisation with that slug`);
      failures += 1;
      continue;
    }

    // Assessments carry no org_id of their own — they are reached through the
    // link, which is also how the submit route attributes new ones.
    const { data: linkRows, error: linkError } = await mcas
      .from("test_links")
      .select("id")
      .eq("org_id", mcasOrg.id);

    if (linkError) throw linkError;

    const linkIds = (linkRows ?? []).map((row) => row.id as string);

    const counts = await countUnattributed(mcas, mcasOrg.id as string, linkIds);

    console.log(
      `  ${entry.mcasOrgSlug} → ${portalOrg.slug}: ` +
        `${counts.links} link(s), ${counts.applications} application(s), ${counts.assessments} assessment(s)`,
    );

    totals.links += counts.links;
    totals.applications += counts.applications;
    totals.assessments += counts.assessments;

    if (!APPLY) continue;

    const { error: updateLinksError } = await mcas
      .from("test_links")
      .update({ portal_org_id: portalOrg.id })
      .eq("org_id", mcasOrg.id)
      .is("portal_org_id", null);

    if (updateLinksError) throw updateLinksError;

    const { error: updateAppsError } = await mcas
      .from("partner_applications")
      .update({ portal_org_id: portalOrg.id })
      .eq("org_id", mcasOrg.id)
      .is("portal_org_id", null);

    if (updateAppsError) throw updateAppsError;

    if (linkIds.length) {
      const { error: updateAssessmentsError } = await mcas
        .from("assessments")
        .update({ portal_org_id: portalOrg.id })
        .in("test_link_id", linkIds)
        .is("portal_org_id", null);

      if (updateAssessmentsError) throw updateAssessmentsError;
    }
  }

  console.log(
    `\nTotal: ${totals.links} link(s), ${totals.applications} application(s), ${totals.assessments} assessment(s)`,
  );

  if (failures > 0) {
    console.error(`\n${failures} mapping entr(ies) could not be resolved.`);
  }

  if (!APPLY) {
    console.log("\nNothing was written. Re-run with --apply to commit.");
  }

  // Unresolved mappings are a bad mapping file, not a partial success.
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
