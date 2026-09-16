import "server-only";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { requirePortalOrgAccess } from "@/lib/portal/authz";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL as string;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY as string;

export const dynamic = "force-dynamic";
export const revalidate = 0;

type KV = {
  key: string;
  value: number;
  percent?: string;
};

type Payload = {
  frequencies: KV[];
  profiles: KV[];
  top3: KV[];
  bottom3: KV[];
  overall: {
    average: number | null;
    count: number;
  };
};

const sum = (
  rows: { value: number }[]
) =>
  (rows || []).reduce(
    (a, r) =>
      a +
      (Number(r.value) || 0),
    0
  );

const pct = (
  n: number,
  total: number
) =>
  !total
    ? "0%"
    : `${(
        (n * 100) /
        total
      ).toFixed(1)}%`;

function safeTrim(v: unknown) {
  return typeof v === "string"
    ? v.trim()
    : "";
}

async function resolveOrgIdBySlug(
  portal: any,
  orgSlug: string
): Promise<string | null> {
  try {
    const { data, error } =
      await portal
        .from("orgs")
        .select("id")
        .eq("slug", orgSlug)
        .maybeSingle();

    if (error) return null;

    return data?.id
      ? String(data.id)
      : null;
  } catch {
    return null;
  }
}

async function getDefaultTestIdForOrg(
  portal: any,
  orgSlug: string
): Promise<string | null> {
  const orgId =
    await resolveOrgIdBySlug(
      portal,
      orgSlug
    );

  if (!orgId) {
    try {
      const v =
        await portal
          .from("v_org_tests")
          .select(
            "test_id, is_active, created_at"
          )
          .eq(
            "org_slug",
            orgSlug
          )
          .limit(25);

      if (
        !v.error &&
        Array.isArray(v.data) &&
        v.data.length
      ) {
        const rows = (
          v.data as any[]
        ).slice();

        rows.sort((a, b) => {
          const aActive =
            a?.is_active ? 1 : 0;

          const bActive =
            b?.is_active ? 1 : 0;

          if (
            bActive !== aActive
          ) {
            return (
              bActive - aActive
            );
          }

          const aTs =
            a?.created_at
              ? +new Date(
                  a.created_at
                )
              : 0;

          const bTs =
            b?.created_at
              ? +new Date(
                  b.created_at
                )
              : 0;

          return bTs - aTs;
        });

        const picked =
          rows[0]?.test_id;

        return picked
          ? String(picked)
          : null;
      }
    } catch {
      // ignore
    }

    return null;
  }

  try {
    const q =
      await portal
        .from("tests")
        .select(
          "id, is_default_dashboard, is_active, created_at"
        )
        .eq("org_id", orgId)
        .order(
          "is_default_dashboard",
          { ascending: false }
        )
        .order(
          "is_active",
          { ascending: false }
        )
        .order("created_at", {
          ascending: false,
        })
        .limit(25);

    if (
      !q.error &&
      Array.isArray(q.data) &&
      q.data.length
    ) {
      return String(
        (q.data as any[])[0].id
      );
    }
  } catch {
    // ignore and retry
  }

  try {
    const q2 =
      await portal
        .from("tests")
        .select("id")
        .eq("org_id", orgId)
        .limit(1);

    if (
      !q2.error &&
      Array.isArray(q2.data) &&
      q2.data[0]?.id
    ) {
      return String(
        q2.data[0].id
      );
    }
  } catch {
    // ignore
  }

  return null;
}

async function getResponseCount(
  portal: any,
  testId: string | null
): Promise<number> {
  if (!testId) return 0;

  try {
    const { count, error } =
      await portal
        .from("test_results")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq(
          "test_id",
          testId
        );

    if (
      !error &&
      typeof count === "number"
    ) {
      return count;
    }
  } catch {}

  try {
    const { count, error } =
      await portal
        .from(
          "test_submissions"
        )
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq(
          "test_id",
          testId
        );

    if (
      !error &&
      typeof count === "number"
    ) {
      return count;
    }
  } catch {}

  return 0;
}

export async function GET(
  req: Request
) {
  try {
    if (
      !SUPABASE_URL ||
      !SUPABASE_SERVICE_ROLE_KEY
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Supabase env not configured",
        },
        { status: 500 }
      );
    }

    const url = new URL(req.url);

    const orgSlug = safeTrim(
      url.searchParams.get("org")
    );

    const explicitTestId =
      safeTrim(
        url.searchParams.get(
          "testId"
        )
      ) || null;

    const rangeKey =
      safeTrim(
        url.searchParams.get(
          "range"
        )
      ) || "all_time";

    const debugMode =
      url.searchParams.get(
        "debug"
      ) === "1";

    if (!orgSlug) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Missing ?org=slug",
        },
        { status: 400 }
      );
    }

    // SECURITY:
    // The dashboard uses the Supabase service role and therefore bypasses
    // database RLS. Authenticate and authorize the requested organisation
    // before any tenant data is queried.
    const access =
      await requirePortalOrgAccess({
        slug: orgSlug,
        permission: "read",
      });

    if (!access.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: access.error,
          code: access.code,
        },
        {
          status: access.status,
        }
      );
    }

    const sb: any =
      createClient(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      );

    const portal =
      sb.schema("portal");

    let testId:
      | string
      | null = null;

    if (explicitTestId) {
      // A test id is also caller-controlled input. Do not allow an
      // authorised user for Org A to supply a test id belonging to Org B.
      const {
        data: testRow,
        error: testError,
      } = await portal
        .from("tests")
        .select("id")
        .eq(
          "id",
          explicitTestId
        )
        .eq(
          "org_id",
          access.access.org.id
        )
        .maybeSingle();

      if (testError) {
        throw testError;
      }

      if (!testRow?.id) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Test not found",
          },
          { status: 404 }
        );
      }

      testId =
        explicitTestId;
    } else {
      testId =
        await getDefaultTestIdForOrg(
          portal,
          orgSlug
        );
    }

    let vfQuery = portal
      .from(
        "v_dashboard_avg_frequency"
      )
      .select(
        "org_slug,test_id,frequency_code,frequency_name,avg_points"
      )
      .eq(
        "org_slug",
        orgSlug
      );

    let vpQuery = portal
      .from(
        "v_dashboard_avg_profile"
      )
      .select(
        "org_slug,test_id,profile_code,profile_name,avg_points"
      )
      .eq(
        "org_slug",
        orgSlug
      );

    let vtQuery = portal
      .from(
        "v_dashboard_top3_profiles"
      )
      .select(
        "org_slug,test_id,profile_code,profile_name,avg_points,rnk"
      )
      .eq(
        "org_slug",
        orgSlug
      );

    let vbQuery = portal
      .from(
        "v_dashboard_bottom3_profiles"
      )
      .select(
        "org_slug,test_id,profile_code,profile_name,avg_points,rnk"
      )
      .eq(
        "org_slug",
        orgSlug
      );

    let voQuery = portal
      .from(
        "v_dashboard_overall_avg"
      )
      .select(
        "org_slug,test_id,overall_avg"
      )
      .eq(
        "org_slug",
        orgSlug
      )
      .limit(1);

    if (testId) {
      vfQuery =
        vfQuery.eq(
          "test_id",
          testId
        );

      vpQuery =
        vpQuery.eq(
          "test_id",
          testId
        );

      vtQuery =
        vtQuery.eq(
          "test_id",
          testId
        );

      vbQuery =
        vbQuery.eq(
          "test_id",
          testId
        );

      voQuery =
        voQuery.eq(
          "test_id",
          testId
        );
    }

    const [
      vf,
      vp,
      vt,
      vb,
      vo,
    ] = await Promise.all([
      vfQuery,
      vpQuery,
      vtQuery,
      vbQuery,
      voQuery,
    ]);

    if (vf.error)
      throw vf.error;

    if (vp.error)
      throw vp.error;

    if (vt.error)
      throw vt.error;

    if (vb.error)
      throw vb.error;

    if (vo.error)
      throw vo.error;

    const frequenciesRaw:
      KV[] = (
      vf.data || []
    ).map((r: any) => ({
      key:
        r.frequency_code ||
        r.frequency_name ||
        "",
      value:
        Number(
          r.avg_points
        ) || 0,
    }));

    const profilesRaw:
      KV[] = (
      vp.data || []
    ).map((r: any) => ({
      key:
        r.profile_code ||
        r.profile_name ||
        "",
      value:
        Number(
          r.avg_points
        ) || 0,
    }));

    const top3Raw: KV[] = (
      vt.data || []
    )
      .slice()
      .sort(
        (a: any, b: any) =>
          (a.rnk ?? 999) -
          (b.rnk ?? 999)
      )
      .map((r: any) => ({
        key:
          r.profile_code ||
          r.profile_name ||
          "",
        value:
          Number(
            r.avg_points
          ) || 0,
      }));

    const bottom3Raw:
      KV[] = (
      vb.data || []
    )
      .slice()
      .sort(
        (a: any, b: any) =>
          (a.rnk ?? 999) -
          (b.rnk ?? 999)
      )
      .map((r: any) => ({
        key:
          r.profile_code ||
          r.profile_name ||
          "",
        value:
          Number(
            r.avg_points
          ) || 0,
      }));

    let freqMap: Record<
      string,
      string
    > = {};

    let profileMap: Record<
      string,
      string
    > = {};

    if (testId) {
      const [
        freqLabels,
        profileLabels,
      ] = await Promise.all([
        portal
          .from(
            "test_frequency_labels"
          )
          .select(
            "frequency_code,frequency_name"
          )
          .eq(
            "test_id",
            testId
          ),

        portal
          .from(
            "test_profile_labels"
          )
          .select(
            "profile_code,profile_name"
          )
          .eq(
            "test_id",
            testId
          ),
      ]);

      if (
        !freqLabels.error &&
        Array.isArray(
          freqLabels.data
        )
      ) {
        for (
          const r of freqLabels.data as any[]
        ) {
          if (
            r.frequency_code &&
            r.frequency_name
          ) {
            freqMap[
              String(
                r.frequency_code
              )
            ] = String(
              r.frequency_name
            );
          }
        }
      }

      if (
        !profileLabels.error &&
        Array.isArray(
          profileLabels.data
        )
      ) {
        for (
          const r of profileLabels.data as any[]
        ) {
          if (
            r.profile_code &&
            r.profile_name
          ) {
            profileMap[
              String(
                r.profile_code
              )
            ] = String(
              r.profile_name
            );
          }
        }
      }
    }

    const mapWith = (
      rows: KV[],
      map: Record<
        string,
        string
      >
    ) => {
      const total =
        sum(rows);

      return rows.map(
        (r) => ({
          ...r,
          key:
            map[r.key] ||
            r.key,
          percent: pct(
            Number(
              r.value
            ) || 0,
            total
          ),
        })
      );
    };

    const frequencies =
      mapWith(
        frequenciesRaw,
        freqMap
      );

    const profiles =
      mapWith(
        profilesRaw,
        profileMap
      );

    const top3 = mapWith(
      top3Raw,
      profileMap
    );

    const bottom3 =
      mapWith(
        bottom3Raw,
        profileMap
      );

    const avgFromView =
      Array.isArray(
        vo.data
      ) &&
      vo.data[0]
        ?.overall_avg != null
        ? Number(
            (
              vo.data[0] as any
            ).overall_avg
          )
        : null;

    const count =
      await getResponseCount(
        portal,
        testId
      );

    const out: Payload = {
      frequencies,
      profiles,
      top3,
      bottom3,
      overall: {
        average:
          Number.isFinite(
            avgFromView as any
          )
            ? (avgFromView as number)
            : null,
        count,
      },
    };

    if (debugMode) {
      return NextResponse.json(
        {
          ok: true,
          org: orgSlug,
          testId,
          range: rangeKey,
          data_preview: {
            frequencies:
              out.frequencies.slice(
                0,
                4
              ),
            profiles:
              out.profiles.slice(
                0,
                4
              ),
            top3:
              out.top3,
            bottom3:
              out.bottom3,
            overall:
              out.overall,
          },
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        org: orgSlug,
        testId,
        range: rangeKey,
        data: out,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error:
          e?.message ??
          "Server error",
      },
      { status: 500 }
    );
  }
}