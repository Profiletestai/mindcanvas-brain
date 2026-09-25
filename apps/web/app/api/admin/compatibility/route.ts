// ==============================
// NEW: /admin/compatibility (Step 2)
// ==============================

// apps/web/app/api/admin/compatibility/route.ts
import "server-only";

import { NextResponse } from "next/server";

import { requireSuperadminApi } from "@/lib/server/adminApiAuth";
import {
  admin,
  getOwnerOrgAndFramework,
} from "../../_lib/org";

type PairDTO = {
  a: string;
  b: string;
  score: number;
};

export async function GET() {
  const auth = await requireSuperadminApi();

  if (!auth.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: auth.error,
      },
      {
        status: auth.status,
      }
    );
  }

  const svc = admin();

  const {
    orgId,
    frameworkId,
  } = await getOwnerOrgAndFramework();

  const {
    data: profiles,
    error: pErr,
  } = await svc
    .from("org_profiles")
    .select(
      "id, name, frequency, ordinal"
    )
    .eq("org_id", orgId)
    .eq(
      "framework_id",
      frameworkId
    )
    .order("ordinal", {
      ascending: true,
    });

  if (pErr) {
    return NextResponse.json(
      {
        error: pErr.message,
      },
      {
        status: 500,
      }
    );
  }

  const {
    data: rows,
    error: cErr,
  } = await svc
    .from(
      "org_profile_compatibility"
    )
    .select(
      "profile_a, profile_b, score"
    )
    .eq(
      "framework_id",
      frameworkId
    );

  if (cErr) {
    return NextResponse.json(
      {
        error: cErr.message,
      },
      {
        status: 500,
      }
    );
  }

  const pairs: PairDTO[] = (
    rows ?? []
  ).map((row) => ({
    a: row.profile_a,
    b: row.profile_b,
    score: row.score,
  }));

  return NextResponse.json({
    profiles,
    pairs,
  });
}

export async function POST(
  req: Request
) {
  const auth =
    await requireSuperadminApi();

  if (!auth.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: auth.error,
      },
      {
        status: auth.status,
      }
    );
  }

  const body =
    (await req.json()) as {
      pairs: PairDTO[];
    };

  if (!body?.pairs) {
    return NextResponse.json(
      {
        error: "Missing pairs",
      },
      {
        status: 400,
      }
    );
  }

  const svc = admin();

  const {
    orgId,
    frameworkId,
  } = await getOwnerOrgAndFramework();

  // Normalize & sanitize
  const clean = body.pairs
    .filter(
      (pair) =>
        pair.a !== pair.b
    )
    .map((pair) => ({
      org_id: orgId,
      framework_id:
        frameworkId,
      profile_a: pair.a,
      profile_b: pair.b,
      score: Math.max(
        0,
        Math.min(
          100,
          Math.round(
            pair.score
          )
        )
      ),
    }));

  // Replace-all strategy for simplicity & consistency
  const {
    error: delErr,
  } = await svc
    .from(
      "org_profile_compatibility"
    )
    .delete()
    .eq(
      "framework_id",
      frameworkId
    );

  if (delErr) {
    return NextResponse.json(
      {
        error: delErr.message,
      },
      {
        status: 500,
      }
    );
  }

  if (clean.length) {
    const {
      error: insErr,
    } = await svc
      .from(
        "org_profile_compatibility"
      )
      .insert(clean);

    if (insErr) {
      return NextResponse.json(
        {
          error: insErr.message,
        },
        {
          status: 500,
        }
      );
    }
  }

  return NextResponse.json({
    ok: true,
  });
}