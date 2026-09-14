// apps/web/app/api/onboarding/v2/org/route.ts

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { portalAdmin } from "@/app/_lib/supabaseAdmin";

import {
  REFERRAL_COOKIE_NAME,
  isUuid,
  referralCutoffIso,
} from "@/app/_lib/referrals";

import { getAuthUser } from "../_lib/auth";
import { generateUniqueSlug } from "../_lib/slug";

import { orgSchema } from "@/app/(v2)/onboarding/v2/_lib/schema";

import type { PortalOrg } from "@/types/database.types";

type OrgRef = {
  id: string;
  slug: string | null;
  name: string | null;
  selected_tier?: number | null;
  last_completed_step?: number | null;
};

type SelectionRow = {
  user_id: string;
  selected_tier: number | null;
};

type ReferralClickRow = {
  id: string;
  partner_id: string;
  clicked_at: string;
  is_first_touch: boolean;
};

type ExistingAttributionRow = {
  id: string;
};

export const dynamic = "force-dynamic";

function errorResponse(
  error: string,
  status: number
) {
  return NextResponse.json(
    { ok: false, error },
    { status }
  );
}

function normaliseSignupTier(
  value: number | null | undefined
) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 4
  ) {
    return null;
  }

  return value;
}

function clearReferralCookie(
  response: NextResponse
) {
  response.cookies.set({
    name: REFERRAL_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure:
      process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}

/**
 * Convert the browser's temporary first-touch referral cookie into
 * permanent organisation attribution.
 *
 * Tracking is deliberately non-blocking:
 * onboarding must still succeed if referral attribution fails.
 *
 * Returns true when the referral cookie should be cleared.
 */
async function captureReferralAttribution({
  request,
  userId,
  orgId,
  signupTier,
}: {
  request: NextRequest;
  userId: string;
  orgId: string;
  signupTier: number | null | undefined;
}): Promise<boolean> {
  try {
    const clickId =
      request.cookies.get(
        REFERRAL_COOKIE_NAME
      )?.value;

    if (!isUuid(clickId)) {
      return false;
    }

    const admin = portalAdmin();

    // -------------------------------------------------------
    // First referral wins permanently.
    //
    // If this organisation has already been attributed,
    // never replace that attribution.
    // -------------------------------------------------------
    const {
      data: existingAttribution,
      error: existingAttributionError,
    } = await admin
      .from("referral_attributions")
      .select("id")
      .eq("org_id", orgId)
      .maybeSingle<ExistingAttributionRow>();

    if (existingAttributionError) {
      console.error(
        "[onboarding/org] referral attribution lookup failed",
        existingAttributionError
      );

      return false;
    }

    if (existingAttribution?.id) {
      // Permanent attribution already exists, so the browser
      // no longer needs the temporary referral cookie.
      return true;
    }

    // -------------------------------------------------------
    // Validate the click.
    //
    // It must:
    // - exist
    // - be a first-touch click
    // - still be inside the 30-day attribution window
    // -------------------------------------------------------
    const {
      data: click,
      error: clickError,
    } = await admin
      .from("referral_clicks")
      .select(
        "id, partner_id, clicked_at, is_first_touch"
      )
      .eq("id", clickId)
      .eq("is_first_touch", true)
      .gte(
        "clicked_at",
        referralCutoffIso()
      )
      .maybeSingle<ReferralClickRow>();

    if (clickError) {
      console.error(
        "[onboarding/org] referral click lookup failed",
        clickError
      );

      return false;
    }

    if (!click?.id || !click.partner_id) {
      // Cookie is invalid or expired.
      // Remove it so it cannot keep being retried.
      return true;
    }

    // -------------------------------------------------------
    // Persist immutable referral conversion.
    //
    // signup_tier is the tier selected at conversion time.
    // Current billing status/tier will later be derived from
    // portal.billing_accounts in the referral dashboard.
    // -------------------------------------------------------
    const {
      error: attributionError,
    } = await admin
      .from("referral_attributions")
      .insert({
        partner_id: click.partner_id,
        click_id: click.id,
        user_id: userId,
        org_id: orgId,
        signup_tier:
          normaliseSignupTier(
            signupTier
          ),
        attributed_at:
          new Date().toISOString(),
      });

    if (attributionError) {
      // A duplicate means another concurrent request already
      // created the immutable attribution. That is safe.
      if (
        attributionError.code === "23505"
      ) {
        return true;
      }

      console.error(
        "[onboarding/org] referral attribution insert failed",
        attributionError
      );

      return false;
    }

    console.log(
      `[onboarding/org] referral attributed partner=${click.partner_id} org=${orgId} tier=${normaliseSignupTier(
        signupTier
      ) ?? "unknown"}`
    );

    return true;
  } catch (error) {
    console.error(
      "[onboarding/org] unexpected referral attribution error",
      error
    );

    return false;
  }
}

export async function POST(
  req: NextRequest
) {
  try {
    const {
      user,
      error: authError,
    } = await getAuthUser();

    if (authError) {
      return authError;
    }

    const raw = await req
      .json()
      .catch(() => ({}));

    const parsed =
      orgSchema.safeParse(raw);

    if (!parsed.success) {
      return errorResponse(
        parsed.error.issues[0]?.message ??
          "Invalid input",
        400
      );
    }

    const {
      name,
      country,
      address,
      industry,
      logo_url,
    } = parsed.data;

    const website_url =
      parsed.data.website_url ?? null;

    const admin = portalAdmin();

    // -------------------------------------------------------
    // Idempotency:
    //
    // If Checkout or an earlier onboarding request already
    // created the organisation, return the same organisation.
    //
    // We ALSO attempt referral capture here. This means an
    // interrupted onboarding can still receive attribution
    // when it resumes.
    // -------------------------------------------------------
    const {
      data: existing,
      error: existingError,
    } = await admin
      .from("user_orgs")
      .select(
        "org_id, orgs(id, slug, name, selected_tier)"
      )
      .eq("user_id", user.id)
      .maybeSingle<{
        org_id: string;
        orgs: OrgRef | null;
      }>();

    if (existingError) {
      return errorResponse(
        existingError.message,
        500
      );
    }

    if (existing?.org_id) {
  const org = existing.orgs;

  // Normally fn_create_onboarding_org copies selected_tier onto the
  // organisation. If Checkout created the organisation earlier and
  // the value is not available yet, fall back to the original
  // onboarding selection so referral reporting keeps the true
  // conversion plan.
  let existingSignupTier =
    org?.selected_tier ?? null;

  if (existingSignupTier === null) {
    const {
      data: existingSelection,
      error: existingSelectionError,
    } = await admin
      .from("onboarding_selections")
      .select(
        "user_id, selected_tier"
      )
      .eq("user_id", user.id)
      .maybeSingle<SelectionRow>();

    if (existingSelectionError) {
      console.error(
        "[onboarding/org] referral tier fallback lookup failed",
        existingSelectionError
      );
    } else {
      existingSignupTier =
        existingSelection?.selected_tier ??
        null;
    }
  }

  const shouldClearReferral =
    await captureReferralAttribution({
      request: req,
      userId: user.id,
      orgId: existing.org_id,
      signupTier:
        existingSignupTier,
    });

  const response =
    NextResponse.json({
      ok: true,
      org: {
        id: existing.org_id,
        slug: org?.slug ?? null,
        name: org?.name ?? null,
      },
    });

  return shouldClearReferral
    ? clearReferralCookie(response)
    : response;
}

    // -------------------------------------------------------
    // The user must have selected their subscription plan
    // before an organisation can be created.
    // -------------------------------------------------------
    const {
      data: selection,
      error: selectionError,
    } = await admin
      .from("onboarding_selections")
      .select(
        "user_id, selected_tier"
      )
      .eq("user_id", user.id)
      .maybeSingle<SelectionRow>();

    if (selectionError) {
      return errorResponse(
        selectionError.message,
        500
      );
    }

    if (!selection) {
      return errorResponse(
        "Select your engines and subscription first.",
        400
      );
    }

    const slug =
      await generateUniqueSlug(name);

    // -------------------------------------------------------
    // Create the normal MindCanvas organisation.
    //
    // Referral functionality does NOT alter this RPC.
    // -------------------------------------------------------
    const {
      data: orgId,
      error: rpcError,
    } = await admin.rpc(
      "fn_create_onboarding_org",
      {
        p_user_id: user.id,
        p_name: name,
        p_slug: slug,
        p_address: address ?? null,
        p_country: country,
        p_billing_region: null,
        p_website_url:
          website_url,
        p_industry:
          industry ?? null,
        p_logo_url:
          logo_url ?? null,
      }
    );

    if (rpcError) {
      return errorResponse(
        rpcError.message,
        500
      );
    }

    // -------------------------------------------------------
    // Existing consent behaviour.
    // -------------------------------------------------------
    const nowIso =
      new Date().toISOString();

    const {
      error: consentError,
    } = await admin
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

    // -------------------------------------------------------
    // Referral conversion.
    //
    // This happens AFTER successful organisation creation.
    // A referral database failure cannot roll back or prevent
    // the customer from completing onboarding.
    // -------------------------------------------------------
    const shouldClearReferral =
      await captureReferralAttribution({
        request: req,
        userId: user.id,
        orgId,
        signupTier:
          selection.selected_tier,
      });

    const response =
      NextResponse.json({
        ok: true,
        org: {
          id: orgId,
          slug,
          name,
        },
      });

    return shouldClearReferral
      ? clearReferralCookie(response)
      : response;
  } catch (error: any) {
    return errorResponse(
      error?.message ||
        "Unexpected error",
      500
    );
  }
}

export async function PATCH(
  req: Request
) {
  try {
    const {
      user,
      error: authError,
    } = await getAuthUser();

    if (authError) {
      return authError;
    }

    const raw = await req
      .json()
      .catch(() => ({}));

    const parsed =
      orgSchema.safeParse(raw);

    if (!parsed.success) {
      return errorResponse(
        parsed.error.issues[0]?.message ??
          "Invalid input",
        400
      );
    }

    const {
      name,
      country,
      address,
      industry,
      logo_url,
    } = parsed.data;

    const website_url =
      parsed.data.website_url ?? null;

    const admin = portalAdmin();

    const {
      data: membership,
      error: membershipError,
    } = await admin
      .from("user_orgs")
      .select(
        "org_id, orgs(id, name, slug, last_completed_step)"
      )
      .eq("user_id", user.id)
      .maybeSingle<{
        org_id: string;
        orgs: OrgRef | null;
      }>();

    if (membershipError) {
      return errorResponse(
        membershipError.message,
        500
      );
    }

    if (!membership?.org_id) {
      return errorResponse(
        "No org found for user",
        404
      );
    }

    const currentName =
      membership.orgs?.name?.trim() ??
      "";

    const stillInOnboarding =
      (
        membership.orgs
          ?.last_completed_step ?? 0
      ) < 5;

    // During onboarding, the organisation slug must follow the
    // real name the user entered. This also repairs placeholders
    // or an old test name reused while validating the flow.
    const shouldRefreshSlug =
      stillInOnboarding ||
      currentName === "" ||
      currentName !== name;

    const slug =
      shouldRefreshSlug
        ? await generateUniqueSlug(
            name
          )
        : membership.orgs?.slug ??
          null;

    // Save the organisation details first. Name is deliberately
    // written in a second, final update below so no placeholder/
    // slug workflow can leave the old organisation title in place.
    const {
      error: detailsError,
    } = await admin
      .from("orgs")
      .update({
        country,
        address: address ?? null,
        website_url,
        industry:
          industry ?? null,
        logo_url:
          logo_url ?? null,
        ...(slug
          ? { slug }
          : {}),
      })
      .eq(
        "id",
        membership.org_id
      );

    if (detailsError) {
      return errorResponse(
        detailsError.message,
        500
      );
    }

    const {
      data: org,
      error: nameError,
    } = await admin
      .from("orgs")
      .update({ name })
      .eq(
        "id",
        membership.org_id
      )
      .select("*")
      .single<PortalOrg>();

    if (nameError) {
      return errorResponse(
        nameError.message,
        500
      );
    }

    // Do not advance to Organisation Created unless the database
    // confirms the exact organisation name submitted here.
    if (
      !org ||
      org.name?.trim() !== name
    ) {
      return errorResponse(
        "The organisation name was not saved. Please try again.",
        500
      );
    }

    return NextResponse.json({
      ok: true,
      org,
    });
  } catch (error: any) {
    return errorResponse(
      error?.message ||
        "Unexpected error",
      500
    );
  }
}

export async function GET() {
  try {
    const {
      user,
      error: authError,
    } = await getAuthUser();

    if (authError) {
      return authError;
    }

    const {
      data,
      error,
    } = await portalAdmin()
      .from("user_orgs")
      .select(
        "org_id, orgs(*)"
      )
      .eq("user_id", user.id)
      .maybeSingle<{
        org_id: string;
        orgs: PortalOrg | null;
      }>();

    if (error) {
      return errorResponse(
        error.message,
        500
      );
    }

    if (!data?.org_id) {
      return NextResponse.json({
        ok: true,
        org: null,
      });
    }

    return NextResponse.json({
      ok: true,
      org: data.orgs,
    });
  } catch (error: any) {
    return errorResponse(
      error?.message ||
        "Unexpected error",
      500
    );
  }
}