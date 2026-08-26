// apps/web/app/api/billing/usage-bundles/route.ts
// GET — owner-scoped usage-bundle offer, balance context and purchase history.

import "server-only";

import { NextResponse } from "next/server";

import {
  getActiveEntitlement,
  getOrgRow,
  getOwnerBillingAccount,
  getStripeMode,
  resolveOwnerOrgId,
} from "@/app/_lib/billing";
import { portalAdmin } from "@/app/_lib/supabaseAdmin";
import { getAuthUser } from "@/app/api/onboarding/v2/_lib/auth";
import { requireOrgAccess } from "@/lib/server/orgAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CatalogRow = {
  id: string;
  display_name: string;
  tier: number;
  quantity: number;
  currency: string;
  amount_cents: number;
  expires_after_days: number | null;
};

type PurchaseRow = {
  id: string;
  status: "pending" | "paid" | "failed" | "refunded" | "disputed";
  gross_amount: number;
  refunded_amount: number;
  currency: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  paid_at: string | null;
  refunded_at: string | null;
};

function jerr(error: string, code: string, status: number) {
  return NextResponse.json({ ok: false, error, code }, { status });
}

function metadataQuantity(metadata: Record<string, unknown> | null): number {
  const raw = metadata?.quantity;
  const parsed = typeof raw === "number" ? raw : Number(raw);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

export async function GET(req: Request) {
  const auth = await getAuthUser();
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const orgIdHint = url.searchParams.get("orgId");
  let orgId: string;

  if (orgIdHint) {
    const access = await requireOrgAccess(orgIdHint);
    if (!access.ok) {
      return jerr(access.error, "org_access_denied", access.status);
    }
    orgId = orgIdHint;
  } else {
    const resolved = await resolveOwnerOrgId(auth.user.id, null);
    if (!resolved.ok) {
      return jerr(resolved.error, resolved.code, resolved.status);
    }
    orgId = resolved.orgId;
  }

  const [org, entitlement, billingAccount] = await Promise.all([
    getOrgRow(orgId),
    getActiveEntitlement(orgId),
    getOwnerBillingAccount(orgId),
  ]);

  if (!org) return jerr("Organisation not found.", "org_not_found", 404);

  const featureEnabled =
    process.env.REVENUE_USAGE_BUNDLES_ENABLED === "true";
  const entitlementTier =
    entitlement && entitlement.tier >= 1 && entitlement.tier <= 4
      ? entitlement.tier
      : null;
  const displayTier = entitlementTier ?? billingAccount?.tier ?? null;

  let offer: CatalogRow | null = null;

  if (featureEnabled && displayTier && displayTier >= 1 && displayTier <= 4) {
    const { data, error } = await portalAdmin()
      .from("usage_bundle_catalog")
      .select(
        "id, display_name, tier, quantity, currency, amount_cents, expires_after_days",
      )
      .eq("bundle_code", "extra_20")
      .eq("tier", displayTier)
      .eq("stripe_mode", getStripeMode())
      .eq("active", true)
      .not("stripe_price_id", "is", null)
      .maybeSingle();

    if (error) {
      return jerr(error.message, "bundle_lookup_failed", 500);
    }

    offer = (data as CatalogRow | null) ?? null;
  }

  const { data: historyData, error: historyError } = await portalAdmin()
    .from("purchases")
    .select(
      "id, status, gross_amount, refunded_amount, currency, metadata, created_at, paid_at, refunded_at",
    )
    .eq("org_id", org.id)
    .eq("purchase_type", "usage_bundle")
    .order("created_at", { ascending: false })
    .limit(25);

  if (historyError) {
    return jerr(historyError.message, "purchase_history_failed", 500);
  }

  const purchases = ((historyData ?? []) as PurchaseRow[]).map((purchase) => ({
    id: purchase.id,
    status: purchase.status,
    quantity: metadataQuantity(purchase.metadata),
    amount_cents: purchase.gross_amount,
    refunded_amount_cents: purchase.refunded_amount,
    currency: purchase.currency,
    created_at: purchase.created_at,
    paid_at: purchase.paid_at,
    refunded_at: purchase.refunded_at,
  }));

  const stripeStatus = billingAccount?.stripe_status?.trim().toLowerCase() ?? "";
  const subscriptionActive =
    stripeStatus === "active" || stripeStatus === "trialing";
  const canPurchase = Boolean(
    featureEnabled &&
      offer &&
      org.status === "active" &&
      entitlementTier &&
      subscriptionActive,
  );

  return NextResponse.json({
    ok: true,
    feature_enabled: featureEnabled,
    can_purchase: canPurchase,
    offer: offer
      ? {
          display_name: offer.display_name,
          tier: offer.tier,
          quantity: offer.quantity,
          currency: offer.currency,
          amount_cents: offer.amount_cents,
          expires: offer.expires_after_days !== null,
        }
      : null,
    purchases,
  });
}