// apps/web/app/api/billing/customer-portal/route.ts

import "server-only";

import Stripe from "stripe";
import { NextResponse } from "next/server";

import { getAuthUser } from "@/app/api/onboarding/v2/_lib/auth";
import {
  getOrgRow,
  getOwnerBillingAccount,
  resolveOwnerOrgId,
} from "@/app/_lib/billing";
import { getAppOrigin } from "@/app/_lib/portal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getStripeSecretKey(): string {
  const isProduction =
    process.env.VERCEL_ENV === "production";

  const key = isProduction
    ? process.env.STRIPE_SECRET_KEY
    : process.env.SANDBOX_STRIPE_SECRET_KEY;

  if (!key) {
    throw new Error(
      isProduction
        ? "Missing STRIPE_SECRET_KEY"
        : "Missing SANDBOX_STRIPE_SECRET_KEY"
    );
  }

  return key;
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthUser();

    if (auth.error) {
      return auth.error;
    }

    const body = (await request
      .json()
      .catch(() => ({}))) as {
      orgId?: string;
    };

    const resolved = await resolveOwnerOrgId(
      auth.user.id,
      body.orgId ?? null
    );

    if (!resolved.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: resolved.error,
          code: resolved.code,
        },
        { status: resolved.status }
      );
    }

    const org = await getOrgRow(resolved.orgId);
    const billingAccount =
      await getOwnerBillingAccount(
        resolved.orgId
      );

    if (!org || !billingAccount) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Billing information was not found.",
        },
        { status: 404 }
      );
    }

    if (!billingAccount.stripe_customer_id) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No Stripe customer is linked to this organisation.",
        },
        { status: 409 }
      );
    }

    const origin = await getAppOrigin();
    const returnUrl =
      `${origin}/portal/${org.slug}/billing`;

    const stripe = new Stripe(
      getStripeSecretKey()
    );

    /*
     * This deep link opens only Stripe's payment-method
     * update flow and returns directly to MindCanvas.
     * It does not expose plan changes or cancellation.
     */
    const session =
      await stripe.billingPortal.sessions.create({
        customer:
          billingAccount.stripe_customer_id,
        return_url: returnUrl,
        flow_data: {
          type: "payment_method_update",
          after_completion: {
            type: "redirect",
            redirect: {
              return_url: returnUrl,
            },
          },
        },
      });

    return NextResponse.json({
      ok: true,
      url: session.url,
    });
  } catch (error) {
    console.error(
      "[billing-customer-portal]",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to open secure billing management.",
      },
      { status: 500 }
    );
  }
}