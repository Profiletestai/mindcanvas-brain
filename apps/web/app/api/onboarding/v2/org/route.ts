// apps/web/app/api/onboarding/v2/org/route.ts
import { NextResponse } from "next/server";
import { portalAdmin } from "@/app/_lib/supabaseAdmin";
import { getAuthUser } from "../_lib/auth";
import { generateUniqueSlug } from "../_lib/slug";
import { orgSchema } from "@/app/(v2)/onboarding/v2/_lib/schema";
import type { PortalOrg } from "@/types/database.types";

type OrgRef = {
  id: string;
  slug: string | null;
  name: string | null;
  last_completed_step?: number | null;
};

export const dynamic = "force-dynamic";

function errorResponse(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(req: Request) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;

    const raw = await req.json().catch(() => ({}));
    const parsed = orgSchema.safeParse(raw);
    if (!parsed.success) {
      return errorResponse(
        parsed.error.issues[0]?.message ?? "Invalid input",
        400
      );
    }

    const { name, country, address, industry, logo_url } = parsed.data;
    const website_url = parsed.data.website_url ?? null;
    const admin = portalAdmin();

    // Idempotency: if Checkout already created the onboarding organisation,
    // return that same organisation instead of creating another one.
    const { data: existing, error: existingError } = await admin
      .from("user_orgs")
      .select("org_id, orgs(id, slug, name)")
      .eq("user_id", user.id)
      .maybeSingle<{ org_id: string; orgs: OrgRef | null }>();

    if (existingError) {
      return errorResponse(existingError.message, 500);
    }

    if (existing?.org_id) {
      const org = existing.orgs;
      return NextResponse.json({
        ok: true,
        org: {
          id: existing.org_id,
          slug: org?.slug ?? null,
          name: org?.name ?? null,
        },
      });
    }

    const { data: selection, error: selectionError } = await admin
      .from("onboarding_selections")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle<{ user_id: string }>();

    if (selectionError) {
      return errorResponse(selectionError.message, 500);
    }

    if (!selection) {
      return errorResponse(
        "Select your engines and subscription first.",
        400
      );
    }

    const slug = await generateUniqueSlug(name);

    const { data: orgId, error: rpcError } = await admin.rpc(
      "fn_create_onboarding_org",
      {
        p_user_id: user.id,
        p_name: name,
        p_slug: slug,
        p_address: address ?? null,
        p_country: country,
        p_billing_region: null,
        p_website_url: website_url,
        p_industry: industry ?? null,
        p_logo_url: logo_url ?? null,
      }
    );

    if (rpcError) {
      return errorResponse(rpcError.message, 500);
    }

    const nowIso = new Date().toISOString();
    const { error: consentError } = await admin
      .from("orgs")
      .update({
        terms_accepted_at: nowIso,
        privacy_accepted_at: nowIso,
      })
      .eq("id", orgId);

    if (consentError) {
      console.error(
        "[onboarding/org] consent timestamps update failed",
        consentError
      );
    }

    return NextResponse.json({
      ok: true,
      org: { id: orgId, slug, name },
    });
  } catch (error: any) {
    return errorResponse(error?.message || "Unexpected error", 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;

    const raw = await req.json().catch(() => ({}));
    const parsed = orgSchema.safeParse(raw);
    if (!parsed.success) {
      return errorResponse(
        parsed.error.issues[0]?.message ?? "Invalid input",
        400
      );
    }

    const { name, country, address, industry, logo_url } = parsed.data;
    const website_url = parsed.data.website_url ?? null;
    const admin = portalAdmin();

    const { data: membership, error: membershipError } = await admin
      .from("user_orgs")
      .select("org_id, orgs(id, name, slug, last_completed_step)")
      .eq("user_id", user.id)
      .maybeSingle<{
        org_id: string;
        orgs: OrgRef | null;
      }>();

    if (membershipError) {
      return errorResponse(membershipError.message, 500);
    }

    if (!membership?.org_id) {
      return errorResponse("No org found for user", 404);
    }

    const currentName = membership.orgs?.name?.trim() ?? "";
    const stillInOnboarding =
      (membership.orgs?.last_completed_step ?? 0) < 5;

    // During onboarding, the organisation slug must follow the real name the
    // user entered. This also repairs placeholders or an old test name reused
    // while validating the flow.
    const shouldRefreshSlug =
      stillInOnboarding || currentName === "" || currentName !== name;
    const slug = shouldRefreshSlug
      ? await generateUniqueSlug(name)
      : membership.orgs?.slug ?? null;

    // Save the organisation details first. Name is deliberately written in a
    // second, final update below so no placeholder/slug workflow can leave the
    // old organisation title in place.
    const { error: detailsError } = await admin
      .from("orgs")
      .update({
        country,
        address: address ?? null,
        website_url,
        industry: industry ?? null,
        logo_url: logo_url ?? null,
        ...(slug ? { slug } : {}),
      })
      .eq("id", membership.org_id);

    if (detailsError) {
      return errorResponse(detailsError.message, 500);
    }

    const { data: org, error: nameError } = await admin
      .from("orgs")
      .update({ name })
      .eq("id", membership.org_id)
      .select("*")
      .single<PortalOrg>();

    if (nameError) {
      return errorResponse(nameError.message, 500);
    }

    // Do not advance to Organisation Created unless the database confirms the
    // exact organisation name submitted on this screen.
    if (!org || org.name?.trim() !== name) {
      return errorResponse(
        "The organisation name was not saved. Please try again.",
        500
      );
    }

    return NextResponse.json({ ok: true, org });
  } catch (error: any) {
    return errorResponse(error?.message || "Unexpected error", 500);
  }
}

export async function GET() {
  try {
    const { user, error: authError } = await getAuthUser();
    if (authError) return authError;

    const { data, error } = await portalAdmin()
      .from("user_orgs")
      .select("org_id, orgs(*)")
      .eq("user_id", user.id)
      .maybeSingle<{ org_id: string; orgs: PortalOrg | null }>();

    if (error) {
      return errorResponse(error.message, 500);
    }

    if (!data?.org_id) {
      return NextResponse.json({ ok: true, org: null });
    }

    return NextResponse.json({ ok: true, org: data.orgs });
  } catch (error: any) {
    return errorResponse(error?.message || "Unexpected error", 500);
  }
}
