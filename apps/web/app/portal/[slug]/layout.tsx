// apps/web/app/portal/[slug]/layout.tsx
import "server-only";

import type { CSSProperties, ReactNode } from "react";

import { getStripeMode } from "@/app/_lib/billing";
import { getAdminClient } from "@/app/_lib/portal";
import { MCAS_TEST_SLUG, orgHasTestAccess } from "@/lib/portal/authz";
import LegacyBillingCheckoutModal from "@/components/billing/LegacyBillingCheckoutModal";
import PortalChrome from "@/components/portal/PortalChrome";
import BackgroundGrid from "@/components/ui/BackgroundGrid";

import PilotGracePopup from "./PilotGracePopup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = {
  slug: string;
};

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
  try {
    const admin = await getAdminClient();

    const { data, error } = await admin
      .schema("portal")
      .from("orgs")
      .select("id, slug, name")
      .eq("slug", slug)
      .maybeSingle();

    if (error || !data) {
      console.error("[portal-layout] Unable to load organisation:", {
        slug,
        error,
      });

      return null;
    }

    return data as unknown as Org;
  } catch (error) {
    console.error("[portal-layout] Organisation lookup failed:", {
      slug,
      error,
    });

    return null;
  }
}

async function requiresLegacyBilling(org: Org): Promise<boolean> {
  try {
    const admin = await getAdminClient();

    const { data, error } = await admin
      .schema("portal")
      .from("billing_accounts")
      .select(
        [
          "id",
          "org_id",
          "stripe_status",
          "billing_source",
          "billing_required_from",
        ].join(","),
      )
      .eq("org_id", org.id)
      .eq("billing_type", "owner")
      .eq("billing_source", "legacy")
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[portal-layout] Unable to load legacy billing account:", {
        orgId: org.id,
        slug: org.slug,
        error,
      });

      return false;
    }

    if (!data) {
      return false;
    }

    const billingAccount = data as unknown as BillingAccount;

    if (billingAccount.billing_required_from) {
      const requiredFrom = Date.parse(billingAccount.billing_required_from);

      if (!Number.isNaN(requiredFrom) && requiredFrom > Date.now()) {
        return false;
      }
    }

    const stripeStatus =
      billingAccount.stripe_status?.trim().toLowerCase() ?? "";

    const subscriptionIsActive =
      stripeStatus === "active" || stripeStatus === "trialing";

    return !subscriptionIsActive;
  } catch (error) {
    console.error("[portal-layout] Legacy billing check failed:", {
      orgId: org.id,
      slug: org.slug,
      error,
    });

    return false;
  }
}

function getStripePublishableKey(): string {
  const stripeMode = getStripeMode();

  if (stripeMode === "live") {
    return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
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
  params: Promise<RouteParams>;
}) {
  const { slug } = await params;

  const org = await loadOrg(slug);

  const mustCompleteLegacyBilling = org
    ? await requiresLegacyBilling(org)
    : false;

  // Decides whether the MCAS tabs render. Server-side so the chrome does not
  // need a client round trip on every portal page.
  const showMcas = org ? await orgHasTestAccess(org.id, MCAS_TEST_SLUG) : false;

  const brandVariables = {
    "--brand-primary": org?.brand_primary ?? "#2d8fc4",
    "--brand-secondary": org?.brand_secondary ?? "#015a8b",
    "--brand-accent": org?.brand_accent ?? "#64bae2",
    "--brand-text": org?.brand_text ?? "#111827",
    "--report-font-family": org?.report_font_family ?? "Inter, sans-serif",
    "--report-font-size": org?.report_font_size ?? "14px",
  } as CSSProperties;

  if (mustCompleteLegacyBilling) {
    return (
      <div
        style={brandVariables}
        className="relative min-h-screen overflow-x-hidden bg-[#020914] text-white"
      >
        <BackgroundGrid />

        <LegacyBillingCheckoutModal
          publishableKey={getStripePublishableKey()}
          organisationName={org?.brand_name ?? org?.name ?? slug}
        />
      </div>
    );
  }

  return (
    <div
      style={brandVariables}
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
          orgSlug={slug}
          orgName={org?.brand_name ?? org?.name ?? slug}
          showMcas={showMcas}
        >
          {children}
        </PortalChrome>
      </div>

      <PilotGracePopup />
    </div>
  );
}