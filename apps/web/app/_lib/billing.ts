// apps/web/app/_lib/billing.ts
// Server helpers for main-account billing (Stripe Checkout + entitlements).

import "server-only";
import { stripe } from "@/lib/stripe";
import { portalAdmin } from "@/app/_lib/supabaseAdmin";

export type OwnerBillingAccount = {
  id: string;
  org_id: string;
  billing_type: "owner" | "licensee";
  tier: number | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_status: string | null;
  period_start: string | null;
  period_end: string | null;
  past_due_since: string | null;
  billing_source: string | null;
  billing_interval: string | null;
};

// Fixed product policy: a pilot gets 48h after pilot_end to subscribe before
// suspension. The pilot entitlement's period_end already = pilot_end + grace,
// so pilot_end is derived as period_end - PILOT_GRACE_HOURS.
export const PILOT_GRACE_HOURS = 48;

// The pilot tier sentinel (operator-seeded tier_definitions.tier = 0).
export const PILOT_TIER = 0;

export type ActiveEntitlement = {
  tier: number;
  status: string;
  period_start: string | null;
  period_end: string | null;
};

/** Resolve the org's current active entitlement (runtime source of truth for
 *  tier + billing period; tier === PILOT_TIER means the org is on the pilot). */
export async function getActiveEntitlement(orgId: string): Promise<ActiveEntitlement | null> {
  const { data, error } = await portalAdmin()
    .from("entitlements")
    .select("tier, status, period_start, period_end")
    .eq("org_id", orgId)
    .eq("status", "active")
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as ActiveEntitlement) ?? null;
}

export type TierPriceRow = {
  id: string;
  billing_type: "owner" | "licensee";
  tier_definition_id: string | null;
  stripe_price_id: string | null;
  interval: "month" | "year";
  currency: string;
  amount_cents: number;
  active: boolean;
};

export async function getOwnerBillingAccount(orgId: string): Promise<OwnerBillingAccount | null> {
  const { data, error } = await portalAdmin()
    .from("billing_accounts")
    .select(
      "id, org_id, billing_type, tier, stripe_customer_id, stripe_subscription_id, stripe_status, period_start, period_end, past_due_since, billing_source, billing_interval"
    )
    .eq("org_id", orgId)
    .eq("billing_type", "owner")
    .maybeSingle();
  if (error) throw error;
  return (data as OwnerBillingAccount) ?? null;
}

/** Lookup the active monthly price for a specific tier (owner billing).
 *  tier_definitions is source of truth for tier metadata; tier_prices keyed by
 *  tier_definition_id is source of truth for Stripe price IDs. */
export async function getOwnerPricesForTier(tier: number): Promise<{
  monthly: TierPriceRow | null;
}> {
  const admin = portalAdmin();

  const { data: tierDef, error: tdErr } = await admin
    .from("tier_definitions")
    .select("id, tier, valid_until")
    .eq("tier", tier)
    .is("valid_until", null)
    .maybeSingle();
  if (tdErr) throw tdErr;
  if (!tierDef?.id) return { monthly: null };

  const { data: monthlyRows, error: mErr } = await admin
    .from("tier_prices")
    .select(
      "id, billing_type, tier_definition_id, stripe_price_id, interval, currency, amount_cents, active"
    )
    .eq("billing_type", "owner")
    .eq("active", true)
    .eq("interval", "month")
    .eq("tier_definition_id", tierDef.id)
    .maybeSingle();
  if (mErr) throw mErr;

  return {
    monthly: (monthlyRows as TierPriceRow) ?? null,
  };
}

export async function ensureStripeCustomer(
  orgId: string,
  email: string,
  name?: string | null
): Promise<string> {
  const ba = await getOwnerBillingAccount(orgId);
  if (!ba) throw new Error("billing_account_not_found");
  if (ba.stripe_customer_id) return ba.stripe_customer_id;

  const customer = await stripe.customers.create(
    {
      email,
      name: name ?? undefined,
      metadata: { org_id: orgId, billing_account_id: ba.id },
    },
    { idempotencyKey: `mc-customer-${orgId}` }
  );

  const { error } = await portalAdmin()
    .from("billing_accounts")
    .update({ stripe_customer_id: customer.id })
    .eq("id", ba.id);
  if (error) throw error;

  return customer.id;
}

/** Resolve the caller's org for billing. If orgIdHint provided, verify ownership.
 *  Otherwise auto-resolve to the single org owned by the user (else error). */
export async function resolveOwnerOrgId(userId: string, orgIdHint?: string | null): Promise<
  | { ok: true; orgId: string }
  | { ok: false; status: number; code: string; error: string }
> {
  const admin = portalAdmin();

  if (orgIdHint) {
    const { data, error } = await admin
      .from("user_orgs")
      .select("user_id, org_id, role")
      .eq("user_id", userId)
      .eq("org_id", orgIdHint)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, status: 404, code: "org_not_found", error: "Org not found for user" };
    if ((data as any).role !== "org_owner") {
      return { ok: false, status: 403, code: "not_org_owner", error: "Not an org owner" };
    }
    return { ok: true, orgId: orgIdHint };
  }

  const { data, error } = await admin
    .from("user_orgs")
    .select("org_id, role")
    .eq("user_id", userId)
    .eq("role", "org_owner");
  if (error) throw error;

  const orgs = (data ?? []) as Array<{ org_id: string; role: string }>;
  if (orgs.length === 0) return { ok: false, status: 404, code: "no_owned_org", error: "No org owned by user" };
  if (orgs.length > 1)
    return {
      ok: false,
      status: 400,
      code: "multiple_orgs_specify_id",
      error: "User owns multiple orgs; specify orgId",
    };
  return { ok: true, orgId: orgs[0].org_id };
}

export type ReserveSubmissionResult = {
  ok: boolean;
  reason?: "no_subscription" | "limit_reached";
  allowance?: number;
  used?: number;
  remaining?: number;
  exempt?: boolean;
};

export function isSubmissionQuotaEnforced(): boolean {
  return process.env.SUBMISSION_QUOTA_ENFORCED !== "false";
}

export async function reserveSubmission(
  orgId: string,
  referenceId: string
): Promise<ReserveSubmissionResult> {
  if (!isSubmissionQuotaEnforced()) return { ok: true };

  const { data, error } = await portalAdmin().rpc("fn_reserve_submission", {
    p_org_id: orgId,
    p_reference_id: referenceId,
  });
  if (error) throw error;
  return data as ReserveSubmissionResult;
}

export type SubmissionUsage = {
  ok: boolean;
  reason?: "no_subscription";
  exempt?: boolean;
  allowance: number | null;
  used: number;
  remaining: number | null;
  period_start: string | null;
  period_end: string | null;
};

export async function getSubmissionUsage(orgId: string): Promise<SubmissionUsage> {
  const { data, error } = await portalAdmin().rpc("fn_submission_usage", {
    p_org_id: orgId,
  });
  if (error) throw error;
  return data as SubmissionUsage;
}

export async function getOrgRow(orgId: string) {
  const { data, error } = await portalAdmin()
    .from("orgs")
    .select("id, name, slug, status")
    .eq("id", orgId)
    .maybeSingle();
  if (error) throw error;
  return data as { id: string; name: string; slug: string | null; status: string } | null;
}
