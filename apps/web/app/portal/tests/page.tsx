// apps/web/app/portal/tests/page.tsx
export const dynamic = "force-dynamic";

import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

type Org = {
  id: string;
  name: string | null;
  slug: string;
};

type OrgTest = {
  id: string;
  org_id: string;
  name: string | null;
  mode: string | null;
  created_at: string;
  slug: string | null;
  status: string | null;
};

function statusLabel(test: OrgTest) {
  return test.status ?? "—";
}

async function load(slug: string) {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE!,
    { auth: { persistSession: false } }
  );

  const { data: org, error: orgErr } = await db
    .from("organizations")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle<Org>();

  if (orgErr) {
    throw new Error(`Org lookup failed: ${orgErr.message}`);
  }

  if (!org) {
    throw new Error(`Org not found for slug: ${slug}`);
  }

  /*
   * Load the organisation's active test permissions first.
   *
   * Tests such as GED can be shared with an organisation without being
   * owned by that organisation. Therefore, tests must not be filtered
   * using tests.org_id.
   */
  const { data: accessRows, error: accessErr } = await db
    .schema("portal")
    .from("org_test_access")
    .select("test_id")
    .eq("org_id", org.id)
    .eq("status", "active");

  if (accessErr) {
    throw new Error(
      `Org test access query failed: ${accessErr.message}`
    );
  }

  const allowedTestIds = Array.from(
    new Set(
      (accessRows ?? [])
        .map((row: { test_id: string | null }) => row.test_id)
        .filter((testId): testId is string => Boolean(testId))
    )
  );

  if (!allowedTestIds.length) {
    return { org, tests: [] as OrgTest[] };
  }

  /*
   * Load the permitted tests directly from portal.tests.
   * Do not constrain this query to the organisation that owns the test.
   */
  const { data: tests, error: testsErr } = await db
    .schema("portal")
    .from("tests")
    .select("id, org_id, name, mode, created_at, slug, status")
    .in("id", allowedTestIds)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (testsErr) {
    throw new Error(`Tests query failed: ${testsErr.message}`);
  }

  return {
    org,
    tests: (tests ?? []) as OrgTest[],
  };
}

async function createLinkAction(formData: FormData) {
  "use server";

  const testId = String(formData.get("testId") || "");
  const slug = String(formData.get("slug") || "");

  if (!testId || !slug) {
    throw new Error("Test ID and organisation slug are required.");
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE!,
    { auth: { persistSession: false } }
  );

  const { error } = await db
    .from("test_links")
    .insert({
      test_id: testId,
      max_uses: 1,
    });

  if (error) {
    throw new Error(`Create link failed: ${error.message}`);
  }

  redirect(`/portal/${slug}/tests/${testId}`);
}

export default async function Page({
  params,
}: {
  params: { slug: string };
}) {
  try {
    const { org, tests } = await load(params.slug);

    if (!tests.length) {
      return (
        <div className="p-6">
          <h1 className="text-xl font-semibold">
            Tests — {org.name ?? org.slug}
          </h1>

          <p className="mt-2 text-slate-600">
            No active tests are currently assigned to this organisation.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6 p-6">
        <h1 className="text-xl font-semibold">
          Tests — {org.name ?? org.slug}
        </h1>

        <div className="space-y-4">
          {tests.map((test) => (
            <div
              key={test.id}
              className="rounded border bg-white p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-base font-semibold">
                    {test.name ?? test.slug ?? test.id}
                  </div>

                  <div className="text-xs text-slate-500">
                    {test.mode ?? "full"} · {statusLabel(test)}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Link
                    href={`/portal/${org.slug}/tests/${test.id}`}
                    className="rounded bg-gray-900 px-3 py-2 text-white"
                  >
                    Open
                  </Link>

                  <form action={createLinkAction}>
                    <input
                      type="hidden"
                      name="testId"
                      value={test.id}
                    />

                    <input
                      type="hidden"
                      name="slug"
                      value={org.slug}
                    />

                    <button
                      type="submit"
                      className="rounded bg-gray-200 px-3 py-2 hover:bg-gray-300"
                    >
                      Create link
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load tests.";

    return <div className="p-6 text-red-600">{message}</div>;
  }
}
