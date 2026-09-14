// apps/web/app/r/[code]/route.ts

import "server-only";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { portalAdmin } from "@/app/_lib/supabaseAdmin";

import {
  DEFAULT_REFERRAL_DESTINATION,
  REFERRAL_ATTRIBUTION_SECONDS,
  REFERRAL_COOKIE_NAME,
  isUuid,
  normaliseReferralCode,
  referralCutoffIso,
  safeReferralDestination,
} from "@/app/_lib/referrals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{
    code: string;
  }>;
};

type ReferralPartner = {
  id: string;
  code: string;
  destination_path: string | null;
  status: string;
};

type ExistingClick = {
  id: string;
  clicked_at: string;
  is_first_touch: boolean;
};

type CreatedClick = {
  id: string;
};

function redirectResponse(
  request: NextRequest,
  destinationPath: string
) {
  const safePath =
    safeReferralDestination(destinationPath);

  const destination = new URL(
    safePath,
    request.nextUrl.origin
  );

  const response =
    NextResponse.redirect(destination, 307);

  response.headers.set(
    "Cache-Control",
    "no-store, max-age=0"
  );

  return response;
}

async function hasValidFirstTouch(
  clickId: string | undefined
) {
  if (!isUuid(clickId)) {
    return false;
  }

  const portal = portalAdmin();

  const {
    data,
    error,
  } = await portal
    .from("referral_clicks")
    .select(
      "id, clicked_at, is_first_touch"
    )
    .eq("id", clickId)
    .eq("is_first_touch", true)
    .gte(
      "clicked_at",
      referralCutoffIso()
    )
    .maybeSingle<ExistingClick>();

  if (error) {
    console.error(
      "[referral] first-touch lookup failed",
      error
    );

    return false;
  }

  return Boolean(data?.id);
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const fallback =
    DEFAULT_REFERRAL_DESTINATION;

  try {
    const { code: rawCode } =
      await context.params;

    const code =
      normaliseReferralCode(rawCode);

    if (!code) {
      return redirectResponse(
        request,
        fallback
      );
    }

    const portal = portalAdmin();

    // -------------------------------------------------------
    // Resolve an active referral partner.
    //
    // Paused / invalid referral links still send the visitor
    // into normal onboarding, but they do not receive credit.
    // -------------------------------------------------------
    const {
      data: partner,
      error: partnerError,
    } = await portal
      .from("referral_partners")
      .select(
        "id, code, destination_path, status"
      )
      .eq("code", code)
      .eq("status", "active")
      .maybeSingle<ReferralPartner>();

    if (partnerError) {
      console.error(
        `[referral] partner lookup failed code=${code}`,
        partnerError
      );

      return redirectResponse(
        request,
        fallback
      );
    }

    if (!partner?.id) {
      return redirectResponse(
        request,
        fallback
      );
    }

    const destinationPath =
      safeReferralDestination(
        partner.destination_path
      );

    // -------------------------------------------------------
    // First-touch attribution.
    //
    // If the visitor already has a valid referral cookie,
    // another partner must NOT overwrite it.
    //
    // We still record the new click for traffic reporting.
    // -------------------------------------------------------
    const existingCookie =
      request.cookies.get(
        REFERRAL_COOKIE_NAME
      )?.value;

    const alreadyAttributed =
      await hasValidFirstTouch(
        existingCookie
      );

    const isFirstTouch =
      !alreadyAttributed;

    // -------------------------------------------------------
    // Record this click.
    // -------------------------------------------------------
    const {
      data: click,
      error: clickError,
    } = await portal
      .from("referral_clicks")
      .insert({
        partner_id: partner.id,
        destination_path:
          destinationPath,
        is_first_touch:
          isFirstTouch,
      })
      .select("id")
      .single<CreatedClick>();

    if (clickError || !click?.id) {
      console.error(
        `[referral] click insert failed partner=${partner.id} code=${code}`,
        clickError
      );

      // Tracking must never prevent somebody from signing up.
      return redirectResponse(
        request,
        destinationPath
      );
    }

    const response =
      redirectResponse(
        request,
        destinationPath
      );

    // -------------------------------------------------------
    // Only establish / replace the cookie when there is no
    // valid existing first-touch attribution.
    // -------------------------------------------------------
    if (isFirstTouch) {
      response.cookies.set({
        name: REFERRAL_COOKIE_NAME,
        value: click.id,
        httpOnly: true,
        secure:
          process.env.NODE_ENV ===
          "production",
        sameSite: "lax",
        path: "/",
        maxAge:
          REFERRAL_ATTRIBUTION_SECONDS,
      });
    }

    return response;
  } catch (error) {
    console.error(
      "[referral] unexpected referral redirect error",
      error
    );

    // Referral tracking is secondary to acquisition.
    // Never block onboarding because tracking failed.
    return redirectResponse(
      request,
      fallback
    );
  }
}