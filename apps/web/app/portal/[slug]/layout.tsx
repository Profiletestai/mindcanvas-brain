// apps/web/app/portal/[slug]/layout.tsx

import "server-only";

import { ReactNode } from "react";

import {
  getAdminClient,
  getServerSupabase,
} from "@/app/_lib/portal";
import LegacyBillingCheckoutModal from "@/components/billing/LegacyBillingCheckoutModal";
import PortalChrome from "@/components/portal/PortalChrome";
import BackgroundGrid from "@/components/ui/BackgroundGrid";

import PilotGracePopup from "./PilotGracePopup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Org = {
  id: string;
  slug: string;
  name: string;
  brand_name?: string | null;
  brand_primary?: string | null;
  brand_secondary?: string | null;
  brand_accent?: string | null;
  brand_text?: string | null;
  report_font_family?: string | null;
  report_font_size?: string | null;
  logo_url?: string | null;
};

type BillingAccount = {
  id: string;
  org_id: string;
  stripe_status: string | null;
  billing_source: string;
  billing_required_from: string | null;
};

async function loadOrg(slug: string): Promise<Org | null> {
  const admin = await getAdminClient();

  const { data, error } = await admin
    .schema("portal")
    .from("orgs")
    .select(
      [
        "id",
        "slug",
        "name",
        "brand_name",
        "brand_primary",
        "brand_secondary",
        "brand_accent",
        "brand_text",
        "report_font_family",
        "report_font_size",
        "logo_url",
      ].join(",")
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) {
    console.error("[portal-layout] Unable to load organisation:", error);
    return null;
  }

  return data as unknown as Org;
}

async function requiresLegacyBilling(
  orgId: string
): Promise<boolean> {
  const userSupabase = await getServerSupabase();

  const {
    data: { user },
  } = await userSupabase.auth.getUser();

  if (!user) {
    return false;
  }

  const admin = await getAdminClient();
  const portal = admin.schema("portal");

  // Confirm that the signed-in user belongs to this organisation.
  const { data: membership, error: membershipError } = await portal
    .from("user_orgs")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership) {
    return false;
  }

  const { data, error } = await portal
    .from("billing_accounts")
    .select(
      "id, org_id, stripe_status, billing_source, billing_required_from"
    )
    .eq("org_id", orgId)
    .eq("billing_type", "owner")
    .eq("billing_source", "legacy")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      "[portal-layout] Unable to load legacy billing account:",
      error
    );
    return false;
  }

  if (!data) {
    return false;
  }

  const billingAccount = data as unknown as BillingAccount;

  if (!billingAccount.billing_required_from) {
    return false;
  }

  const requiredFrom = Date.parse(
    billingAccount.billing_required_from
  );

  if (Number.isNaN(requiredFrom) || requiredFrom > Date.now()) {
    return false;
  }

  const stripeStatus =
    billingAccount.stripe_status?.toLowerCase() ?? "";

  const hasActiveSubscription =
    stripeStatus === "active" || stripeStatus === "trialing";

  return !hasActiveSubscription;
}

function getStripePublishableKey(): string {
  const isProduction =
    process.env.VERCEL_ENV === "production";

  if (isProduction) {
    return (
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""
    );
  }

  return (
    process.env.NEXT_PUBLIC_SANDBOX_STRIPE_PUBLISHABLE_KEY ??
    process.env.SANDBOX_STRIPE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ??
    ""
  );
}

export default async function OrgLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { slug: string };
}) {
  const org = await loadOrg(params.slug);

  const mustCompleteLegacyBilling = org
    ? await requiresLegacyBilling(org.id)
    : false;

  const vars: Record<string, string> = {
    "--brand-primary": org?.brand_primary ?? "#2d8fc4",
    "--brand-secondary": org?.brand_secondary ?? "#015a8b",
    "--brand-accent": org?.brand_accent ?? "#64bae2",
    "--brand-text": org?.brand_text ?? "#111827",
    "--report-font-family":
      org?.report_font_family ?? "Inter, sans-serif",
    "--report-font-size": org?.report_font_size ?? "14px",
  };

  /*
   * Do not render the portal content underneath the billing screen.
   * Until Stripe activates the subscription, the user only receives
   * the compulsory checkout.
   */
  if (mustCompleteLegacyBilling) {
    return (
      <div
        style={vars as React.CSSProperties}
        className="relative min-h-screen overflow-x-hidden bg-[#050914] text-white"
      >
        <BackgroundGrid />

        <LegacyBillingCheckoutModal
          publishableKey={getStripePublishableKey()}
          organisationName={
            org?.brand_name ?? org?.name ?? params.slug
          }
        />
      </div>
    );
  }

  return (
    <div
      style={vars as React.CSSProperties}
      className="relative min-h-screen overflow-x-hidden bg-[#050914] text-white"
    >
      <BackgroundGrid />

      <div
        className="relative z-10"
        style={{
          fontFamily: "var(--report-font-family)",
        }}
      >
        <PortalChrome
          orgSlug={params.slug}
          orgName={
            org?.brand_name ?? org?.name ?? params.slug
          }
        >
          {children}
        </PortalChrome>
      </div>

      <PilotGracePopup />
    </div>
  );
}

