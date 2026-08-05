// apps/web/app/api/public/test/[token]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSubmissionAvailability, isSubmissionQuotaEnforced } from "@/app/_lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PortalClient = ReturnType<typeof createClient>;

type LinkRow = {
  token: string;
  test_id: string;
  org_id: string;
  max_uses: number | null;
  use_count: number | null;
};

type TestRow = {
  id: string;
  name: string | null;
  org_id: string;
  meta: any | null;
};

type OrgRow = {
  id: string;
  name: string | null;
  slug: string | null;
};

const WHATSWHATS_ORG_ID =
  process.env.WHATSWHATS_ORG_ID?.trim() ||
  "7234ea8f-8a29-4e9c-b62a-f6863cce31d2";

const WHATSWHATS_ORG_SLUG = "whatswhats-global";

function getPortalClient(): PortalClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE!;

  if (!url || !serviceRole) {
    throw new Error("Missing Supabase env vars");
  }

  return createClient(url, serviceRole, {
    auth: { persistSession: false },
    db: { schema: "portal" },
  }) as any;
}

function resolveEffectiveTestId(testRow: TestRow): string {
  const meta = testRow?.meta ?? {};
  const isWrapper = meta?.wrapper === true;

  if (!isWrapper) {
    return testRow.id;
  }

  const defaultSourceTest = meta?.default_source_test;
  if (typeof defaultSourceTest === "string" && defaultSourceTest.length > 10) {
    return defaultSourceTest;
  }

  const sourceTests = meta?.source_tests;
  if (Array.isArray(sourceTests) && typeof sourceTests[0] === "string") {
    return sourceTests[0];
  }

  return testRow.id;
}

function cleanOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
}

function cleanCountryCode(value: unknown): string | null {
  const cleaned = cleanOptionalString(value);
  if (!cleaned) {
    return null;
  }

  return cleaned.toUpperCase();
}

function normalizeWebsiteUrl(value: unknown): {
  value: string | null;
  error: string | null;
} {
  const raw = cleanOptionalString(value);

  if (!raw) {
    return { value: null, error: null };
  }

  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const parsed = new URL(candidate);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return {
        value: null,
        error: "Website must use http or https.",
      };
    }

    if (!parsed.hostname || !parsed.hostname.includes(".")) {
      return {
        value: null,
        error: "Please enter a valid website address.",
      };
    }

    return {
      value: parsed.toString().replace(/\/$/, ""),
      error: null,
    };
  } catch {
    return {
      value: null,
      error: "Please enter a valid website address.",
    };
  }
}

function isWhatsWhatsOrganisation(org: OrgRow | null): boolean {
  if (!org) {
    return false;
  }

  if (org.id === WHATSWHATS_ORG_ID) {
    return true;
  }

  return org.slug?.trim().toLowerCase() === WHATSWHATS_ORG_SLUG;
}

// GET /api/public/test/[token]
export async function GET(
  _req: NextRequest,
  ctx: { params: { token?: string } }
) {
  try {
    const token = ctx.params?.token?.trim();

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "missing token" },
        { status: 400 }
      );
    }

    const sb = getPortalClient();

    // 1) Resolve the public link. The link org is the customer organisation
    // taking the test and must be used for organisation-specific behaviour.
    const { data: linkRow, error: linkErr } = (await sb
      .from("test_links")
      .select("token, test_id, org_id, max_uses, use_count")
      .eq("token", token)
      .maybeSingle()) as { data: LinkRow | null; error: any };

    if (linkErr || !linkRow) {
      return NextResponse.json(
        { ok: false, error: "invalid link" },
        { status: 404 }
      );
    }

    // 2) Load the linked test/template.
    const { data: testRow, error: testErr } = (await sb
      .from("tests")
      .select("id, name, org_id, meta")
      .eq("id", linkRow.test_id)
      .maybeSingle()) as { data: TestRow | null; error: any };

    if (testErr || !testRow) {
      return NextResponse.json(
        { ok: false, error: testErr?.message || "test not found" },
        { status: 500 }
      );
    }

    // 3) Load the organisation attached to the public link, not the template
    // test owner. This keeps custom intake fields correctly ring-fenced.
    const { data: orgRow, error: orgErr } = (await sb
      .from("orgs")
      .select("id, name, slug")
      .eq("id", linkRow.org_id)
      .maybeSingle()) as { data: OrgRow | null; error: any };

    if (orgErr || !orgRow) {
      return NextResponse.json(
        { ok: false, error: orgErr?.message || "organisation not found" },
        { status: 500 }
      );
    }

    const effectiveTestId = resolveEffectiveTestId(testRow);
    const requiresWhatsWhatsFields = isWhatsWhatsOrganisation(orgRow);

    const maxUses = linkRow.max_uses;
    const useCount = linkRow.use_count ?? 0;
    const perLinkLimitReached = maxUses != null && useCount >= maxUses;

    // Org-wide monthly cap counted across all links for the customer org.
    let orgLimitReached = false;

    if (isSubmissionQuotaEnforced()) {
      // Per-test: the trial credit spent at submit is scoped to this test's
      // engine, so check availability for this test rather than the org total —
      // otherwise a taker opens a test whose engine is exhausted and only finds
      // out when submit fails.
      const availability = await getSubmissionAvailability(
        linkRow.org_id,
        linkRow.test_id
      );
      orgLimitReached = !availability.available;
    }

    const limitReached = perLinkLimitReached || orgLimitReached;

    return NextResponse.json({
      ok: true,
      data: {
        token: linkRow.token,
        test_id: linkRow.test_id,
        effective_test_id: effectiveTestId,
        name: testRow.name ?? "Test",
        org_id: orgRow.id,
        org_name: orgRow.name ?? null,
        org_slug: orgRow.slug ?? null,
        meta: testRow.meta ?? null,
        max_uses: maxUses,
        use_count: useCount,
        limit_reached: limitReached,

        // PublicTestClient uses this flag to show Website, Industry and Country.
        // It is true only for WhatsWhats Global.
        requires_whatswhats_fields: requiresWhatsWhatsFields,

        // The structured version makes future organisation-specific intake
        // additions possible without adding more one-off booleans.
        intake_config: {
          website: {
            visible: requiresWhatsWhatsFields,
            required: requiresWhatsWhatsFields,
          },
          industry: {
            visible: requiresWhatsWhatsFields,
            required: requiresWhatsWhatsFields,
          },
          country: {
            visible: requiresWhatsWhatsFields,
            required: requiresWhatsWhatsFields,
          },
        },
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}

// POST /api/public/test/[token]
export async function POST(
  req: NextRequest,
  ctx: { params: { token?: string } }
) {
  try {
    const token = ctx.params?.token?.trim();

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "missing token" },
        { status: 400 }
      );
    }

    const body = (await req.json().catch(() => ({}))) ?? {};

    const {
      first_name = null,
      last_name = null,
      email = null,
      phone = null,
      company = null,
      role_title = null,
      linkedin_profile = null,
      referred_by = null,
      website_url = null,
      website = null,
      industry = null,
      country_code = null,
      country_name = null,
      country = null,
      data_consent = null,
    } = body;

    const sb = getPortalClient();

    const firstName =
      typeof first_name === "string" ? first_name.trim() : "";
    const lastName =
      typeof last_name === "string" ? last_name.trim() : "";
    const normalisedEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";
    const consent = data_consent === true;

    if (!firstName || !lastName || !normalisedEmail) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "first_name, last_name and email are required to start this test.",
        },
        { status: 400 }
      );
    }

    if (!consent) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "You must agree to the use of your data in order to start this test.",
        },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();

    // 1) Resolve the public link.
    const { data: link, error: linkErr } = (await sb
      .from("test_links")
      .select("test_id, token, org_id")
      .eq("token", token)
      .maybeSingle()) as {
      data: { test_id: string; token: string; org_id: string } | null;
      error: any;
    };

    if (linkErr || !link) {
      return NextResponse.json(
        { ok: false, error: "invalid link" },
        { status: 404 }
      );
    }

    // 2) Load the test/template.
    const { data: testRow, error: testErr } = (await sb
      .from("tests")
      .select("id, name, org_id, meta")
      .eq("id", link.test_id)
      .maybeSingle()) as { data: TestRow | null; error: any };

    if (testErr || !testRow?.org_id) {
      return NextResponse.json(
        { ok: false, error: testErr?.message || "missing org for test" },
        { status: 500 }
      );
    }

    // 3) Load the customer organisation from the link.
    const { data: orgRow, error: orgErr } = (await sb
      .from("orgs")
      .select("id, name, slug")
      .eq("id", link.org_id)
      .maybeSingle()) as { data: OrgRow | null; error: any };

    if (orgErr || !orgRow) {
      return NextResponse.json(
        { ok: false, error: orgErr?.message || "organisation not found" },
        { status: 500 }
      );
    }

    const effectiveTestId = resolveEffectiveTestId(testRow);
    const requiresWhatsWhatsFields = isWhatsWhatsOrganisation(orgRow);

    // Existing shared intake fields.
    const cleanedPhone = cleanOptionalString(phone);
    const cleanedCompany = cleanOptionalString(company);
    const cleanedRoleTitle = cleanOptionalString(role_title);
    const cleanedLinkedIn = cleanOptionalString(linkedin_profile);
    const cleanedReferredBy = cleanOptionalString(referred_by);

    // WhatsWhats-only intake fields. Aliases are accepted so the API remains
    // tolerant while the front end and GHL work are being connected.
    const websiteResult = normalizeWebsiteUrl(website_url ?? website);
    const cleanedIndustry = cleanOptionalString(industry);
    const cleanedCountryCode = cleanCountryCode(country_code);
    const cleanedCountryName = cleanOptionalString(country_name ?? country);

    if (websiteResult.error) {
      return NextResponse.json(
        { ok: false, error: websiteResult.error },
        { status: 400 }
      );
    }

    if (
      cleanedCountryCode &&
      !/^[A-Z]{2}$/.test(cleanedCountryCode)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Country code must be a valid two-letter ISO country code.",
        },
        { status: 400 }
      );
    }

    // Website, Industry and Country are required only for WhatsWhats Global.
    if (requiresWhatsWhatsFields) {
      if (
        !websiteResult.value ||
        !cleanedIndustry ||
        !cleanedCountryCode ||
        !cleanedCountryName
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Website, Industry and Country are required for this assessment.",
          },
          { status: 400 }
        );
      }
    }

    // Block starting a test once the customer organisation's monthly
    // submission cap is reached.
    if (isSubmissionQuotaEnforced()) {
      // Same per-test availability check as the open gate, so a taker is never
      // allowed to start a test they won't be able to submit.
      const availability = await getSubmissionAvailability(link.org_id, link.test_id);
      if (!availability.available) {
        return NextResponse.json(
          {
            ok: false,
            error: "Submission limit reached for your plan",
            reason: "limit_reached",
          },
          { status: 403 }
        );
      }
    }

    const insertRow: any = {
      // Tests may live in a template org. The taker belongs to the org on the
      // public link.
      org_id: link.org_id,
      test_id: link.test_id,
      link_token: link.token,
      first_name: firstName,
      last_name: lastName,
      email: normalisedEmail,
      phone: cleanedPhone,
      company: cleanedCompany,
      role_title: cleanedRoleTitle,
      linkedin_profile: cleanedLinkedIn,
      referred_by: cleanedReferredBy,

      // These values are deliberately stored only for WhatsWhats Global.
      website_url: requiresWhatsWhatsFields ? websiteResult.value : null,
      industry: requiresWhatsWhatsFields ? cleanedIndustry : null,
      country_code: requiresWhatsWhatsFields ? cleanedCountryCode : null,
      country_name: requiresWhatsWhatsFields ? cleanedCountryName : null,

      status: "started" as const,
      data_consent: true,
      data_consent_at: nowIso,
      meta: {
        effective_test_id: effectiveTestId,
      },
    };

    const { data: taker, error: insertErr } = (await sb
      .from("test_takers")
      .insert(insertRow)
      .select("id")
      .single()) as { data: { id: string } | null; error: any };

    if (insertErr || !taker?.id) {
      return NextResponse.json(
        { ok: false, error: insertErr?.message || "insert failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      id: taker.id,
      effective_test_id: effectiveTestId,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}

