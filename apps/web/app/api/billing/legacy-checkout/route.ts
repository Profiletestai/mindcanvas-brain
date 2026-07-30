// apps/web/app/api/billing/legacy-checkout/route.ts

import "server-only";

import Stripe from "stripe";
import { NextResponse } from "next/server";

import {
  getAdminClient,
  getAppOrigin,
  requireActiveOrgId,
} from "@/app/_lib/portal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BillingAccountRow = {
  id: string;
  org_id: string;
  billing_type: string;
  tier: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_status: string | null;
  billing_source: string;
  billing_interval: string;
  billing_required_from: string | null;
};

const LEGACY_ORG_IDS = new Set([
  "2a0f55c9-1681-481e-b23b-82bb3a597c5b", // Focal Point
  "64c9d1f2-6e76-48e8-9e96-95ac6254d0bf", // Team Puzzle
  "4be387ad-dc59-47f7-a6b1-8d290b2e4a4e", // Competency Coach
  "60fb2268-4771-4a80-ae18-8e3dc45fe101", // Brett Gordon / 5D Leadership
]);

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

function getProMonthlyPriceId(): string {
  const priceId =
    process.env.STRIPE_PRICE_PRO_MONTHLY;

  if (!priceId) {
    throw new Error(
      "Missing STRIPE_PRICE_PRO_MONTHLY"
    );
  }

  return priceId;
}

export async function POST() {
  try {
    const orgId = await requireActiveOrgId();

    if (!LEGACY_ORG_IDS.has(orgId)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This organisation is not eligible for legacy billing.",
        },
        { status: 403 }
      );
    }

    const admin = await getAdminClient();
    const portal = admin.schema("portal");

    const { data: org, error: orgError } =
      await portal
        .from("orgs")
        .select("id, name, slug")
        .eq("id", orgId)
        .maybeSingle();

    if (orgError || !org) {
      return NextResponse.json(
        {
          ok: false,
          error:
            orgError?.message ||
            "Organisation not found.",
        },
        { status: 404 }
      );
    }

    const {
      data: billingData,
      error: billingError,
    } = await portal
      .from("billing_accounts")
      .select(
        [
          "id",
          "org_id",
          "billing_type",
          "tier",
          "stripe_customer_id",
          "stripe_subscription_id",
          "stripe_status",
          "billing_source",
          "billing_interval",
          "billing_required_from",
        ].join(",")
      )
      .eq("org_id", orgId)
      .eq("billing_type", "owner")
      .eq("billing_source", "legacy")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const billingAccount =
      billingData as BillingAccountRow | null;

    if (billingError || !billingAccount) {
      return NextResponse.json(
        {
          ok: false,
          error:
            billingError?.message ||
            "No legacy billing account exists for this organisation.",
        },
        { status: 404 }
      );
    }

    if (
      billingAccount.stripe_status === "active" ||
      billingAccount.stripe_status === "trialing"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This organisation already has an active subscription.",
        },
        { status: 409 }
      );
    }

    const stripe = new Stripe(
      getStripeSecretKey()
    );

    let stripeCustomerId =
      billingAccount.stripe_customer_id;

    if (!stripeCustomerId) {
      const customer =
        await stripe.customers.create({
          name: org.name,
          metadata: {
            org_id: org.id,
            org_slug: org.slug,
            billing_account_id:
              billingAccount.id,
            billing_source: "legacy",
          },
        });

      stripeCustomerId = customer.id;

      const { error: customerUpdateError } =
        await portal
          .from("billing_accounts")
          .update({
            stripe_customer_id:
              stripeCustomerId,
          })
          .eq("id", billingAccount.id);

      if (customerUpdateError) {
        throw new Error(
          `Unable to save Stripe customer: ${customerUpdateError.message}`
        );
      }
    }

    const origin = await getAppOrigin();

    const session =
      await stripe.checkout.sessions.create({
        ui_mode: "embedded",
        mode: "subscription",
        customer: stripeCustomerId,
        client_reference_id: org.id,

        line_items: [
          {
            price: getProMonthlyPriceId(),
            quantity: 1,
          },
        ],

        metadata: {
          org_id: org.id,
          org_slug: org.slug,
          billing_account_id:
            billingAccount.id,
          billing_source: "legacy",
          billing_interval: "monthly",
          tier: String(billingAccount.tier),
        },

        subscription_data: {
          metadata: {
            org_id: org.id,
            org_slug: org.slug,
            billing_account_id:
              billingAccount.id,
            billing_source: "legacy",
            billing_interval: "monthly",
            tier: String(
              billingAccount.tier
            ),
          },
        },

        redirect_on_completion: "if_required",

        return_url:
          `${origin}/portal/${org.slug}` +
          `?billing=return&session_id={CHECKOUT_SESSION_ID}`,
      });

    if (!session.client_secret) {
      throw new Error(
        "Stripe did not return an Embedded Checkout client secret."
      );
    }

    /*
     * These snake_case field names match
     * LegacyBillingCheckoutModal.tsx.
     */
    return NextResponse.json({
      ok: true,
      client_secret: session.client_secret,
      session_id: session.id,
    });
  } catch (error) {
    console.error("[legacy-checkout]", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to create Stripe Checkout session.",
      },
      { status: 500 }
    );
  }
}