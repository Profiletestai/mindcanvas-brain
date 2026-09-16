// apps/web/lib/portal/loadModels.ts
// Resolve the tests an org can create links for.
//
// Access can come from portal.org_test_access, with a legacy fallback to
// org-owned rows. In both cases the underlying test itself must still be
// active. An active access row must never make an archived test selectable.
//
// Shared by the portal layout (header CTA), the Tests page, and the Links page.

import "server-only";

import { createClient } from "@/lib/server/supabaseAdmin";
import { metaFor } from "@/lib/testModels";

export type PortalModel = {
  id: string;
  name: string;
  category: string;
};

export async function loadModels(
  orgId: string
): Promise<PortalModel[]> {
  const sb =
    createClient().schema("portal");

  let rows: any[] = [];

  // First preference: explicit active organisation access.
  const { data: accessRows } =
    await sb
      .from("org_test_access")
      .select("test_id")
      .eq("org_id", orgId)
      .eq("status", "active");

  const ids = (
    accessRows ?? []
  )
    .map(
      (r: any) => r.test_id
    )
    .filter(Boolean);

  if (ids.length) {
    const { data } =
      await sb
        .from("tests")
        .select(
          "id, name, created_at"
        )
        .in("id", ids)
        .eq("status", "active")
        .order("created_at", {
          ascending: false,
        });

    rows = data ?? [];
  }

  // Legacy fallback:
  // if no active accessible catalogue rows remain, use active tests
  // historically owned by the organisation.
  if (!rows.length) {
    const { data } =
      await sb
        .from("tests")
        .select(
          "id, name, created_at"
        )
        .eq("org_id", orgId)
        .eq("status", "active")
        .order("created_at", {
          ascending: false,
        });

    rows = data ?? [];
  }

  return (rows || [])
    .map((r: any) => {
      const id =
        r?.id ??
        r?.test_id ??
        null;

      if (!id) {
        return null;
      }

      const name =
        r?.name ??
        "Untitled test";

      return {
        id,
        name,
        category:
          metaFor(name).category,
      };
    })
    .filter(Boolean) as PortalModel[];
}

export default loadModels;
