import { redirect } from "next/navigation";

import {
  admin,
  getOwnerOrgAndFramework,
} from "@/app/api/_lib/org";
import { requireSuperadminApi } from "@/lib/server/adminApiAuth";

import CompatibilityEditor from "./ui/CompatibilityEditor";

export const dynamic =
  "force-dynamic";

export const revalidate = 0;

type PairDTO = {
  a: string;
  b: string;
  score: number;
};

async function getData() {
  const auth =
    await requireSuperadminApi();

  if (!auth.ok) {
    if (auth.status === 401) {
      redirect(
        "/portal/login?next=/admin/compatibility"
      );
    }

    if (auth.status === 403) {
      redirect("/portal");
    }

    throw new Error(
      auth.error
    );
  }

  const svc = admin();

  const {
    orgId,
    frameworkId,
  } =
    await getOwnerOrgAndFramework();

  const {
    data: profiles,
    error: profileError,
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

  if (profileError) {
    throw new Error(
      `Failed to load profiles: ${profileError.message}`
    );
  }

  const {
    data: rows,
    error:
      compatibilityError,
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

  if (
    compatibilityError
  ) {
    throw new Error(
      `Failed to load compatibility: ${compatibilityError.message}`
    );
  }

  const pairs: PairDTO[] = (
    rows ?? []
  ).map((row) => ({
    a: row.profile_a,
    b: row.profile_b,
    score: row.score,
  }));

  return {
    profiles:
      profiles ?? [],
    pairs,
  };
}

export default async function Page() {
  const {
    profiles,
    pairs,
  } = await getData();

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">
          Compatibility Matrix
        </h1>

        <p className="text-sm text-slate-300 mt-1">
          Set pair scores
          (0–100). Symmetry
          enforced.
        </p>
      </header>

      <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-6">
        <CompatibilityEditor
          profiles={profiles}
          initialPairs={
            pairs
          }
        />
      </div>
    </main>
  );
}
