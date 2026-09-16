// apps/web/app/api/admin/referrals/route.ts

import "server-only";

import { NextResponse } from "next/server";

import {
  getAdminClient,
  getServerSupabase,
} from "@/app/_lib/portal";

import {
  DEFAULT_REFERRAL_DESTINATION,
  isUuid,
  normaliseReferralCode,
} from "@/app/_lib/referrals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RangeKey = "7d" | "30d" | "90d" | "all";

type ReferralPartner = {
  id: string;
  name: string;
  email: string | null;
  code: string;
  destination_path: string;
  status: "active" | "paused";
  created_at: string;
  updated_at: string;
};

type ReferralClick = {
  id: string;
  partner_id: string;
  is_first_touch: boolean;
  clicked_at: string;
};

type ReferralAttribution = {
  id: string;
  partner_id: string;
  user_id: string;
  org_id: string;
  signup_tier: number | null;
  attributed_at: string;
};

type Organisation = {
  id: string;
  name: string | null;
  slug: string | null;
  status: string | null;
  account_type: string | null;
  selected_tier: number | null;
};

type BillingAccount = {
  id: string;
  org_id: string;
  billing_type: "owner" | "licensee";
  tier: number;
  stripe_status: string | null;
  billing_interval: string | null;
  billing_source: string | null;
  updated_at: string;
};

type PaymentState =
  | "paid"
  | "trial"
  | "overdue"
  | "setup_required"
  | "paused"
  | "cancelled"
  | "complimentary"
  | "pending";

type ConversionRow = {
  id: string;
  partnerId: string;
  partnerName: string;
  orgId: string;
  orgName: string;
  orgSlug: string | null;
  signupAt: string;
  signupTier: number | null;
  signupPlan: string;
  currentTier: number | null;
  currentPlan: string;
  paymentState: PaymentState;
  paymentLabel: string;
  isPaid: boolean;
  orgStatus: string | null;
};

type PartnerPerformance = {
  id: string;
  name: string;
  email: string | null;
  code: string;
  destinationPath: string;
  status: "active" | "paused";
  createdAt: string;
  clicks: number;
  signups: number;
  paidCustomers: number;
  signupConversion: number;
  paidConversion: number;
};

function jsonError(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

async function requireSuperadmin() {
  const sb = await getServerSupabase();
  const { data: auth, error: authError } = await sb.auth.getUser();
  const user = auth?.user ?? null;

  if (authError || !user) {
    return null;
  }

  const admin = await getAdminClient();
  const portal = admin.schema("portal");

  const { data: adminRow, error: adminError } = await portal
    .from("superadmin")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminError || !adminRow?.user_id) {
    return null;
  }

  return {
    userId: user.id,
    portal,
  };
}

function parseRange(value: string | null): RangeKey {
  if (
    value === "7d" ||
    value === "30d" ||
    value === "90d" ||
    value === "all"
  ) {
    return value;
  }

  return "30d";
}

function getRangeStart(range: RangeKey) {
  if (range === "all") {
    return null;
  }

  const days =
    range === "7d"
      ? 7
      : range === "90d"
      ? 90
      : 30;

  return new Date(
    Date.now() - days * 24 * 60 * 60 * 1000
  ).toISOString();
}

function planLabel(tier: number | null | undefined) {
  switch (tier) {
    case 1:
      return "Starter";
    case 2:
      return "Pro";
    case 3:
      return "Growth";
    case 4:
      return "Enterprise";
    default:
      return "Not selected";
  }
}

function getBillingPriority(account: BillingAccount) {
  const stripeStatus =
    account.stripe_status?.toLowerCase() ?? null;

  const statusPriority: Record<string, number> = {
    active: 100,
    trialing: 90,
    past_due: 80,
    unpaid: 75,
    incomplete: 70,
    incomplete_expired: 60,
    paused: 50,
    complimentary: 40,
    canceled: 20,
    cancelled: 20,
  };

  const billingTypePriority =
    account.billing_type === "owner" ? 2 : 1;

  return (
    (stripeStatus
      ? statusPriority[stripeStatus] ?? 30
      : 25) *
      10 +
    billingTypePriority
  );
}

function createBillingMap(accounts: BillingAccount[]) {
  const map = new Map<string, BillingAccount>();

  for (const account of accounts) {
    const existing = map.get(account.org_id);

    if (!existing) {
      map.set(account.org_id, account);
      continue;
    }

    const currentPriority = getBillingPriority(account);
    const existingPriority = getBillingPriority(existing);

    if (currentPriority > existingPriority) {
      map.set(account.org_id, account);
      continue;
    }

    if (
      currentPriority === existingPriority &&
      new Date(account.updated_at).getTime() >
        new Date(existing.updated_at).getTime()
    ) {
      map.set(account.org_id, account);
    }
  }

  return map;
}

function getPaymentState(
  organisation: Organisation | undefined,
  billingAccount: BillingAccount | undefined
): {
  state: PaymentState;
  label: string;
  isPaid: boolean;
} {
  const stripeStatus =
    billingAccount?.stripe_status?.toLowerCase() ?? null;

  if (stripeStatus === "active") {
    return { state: "paid", label: "Paid", isPaid: true };
  }

  if (stripeStatus === "trialing") {
    return { state: "trial", label: "Trial", isPaid: false };
  }

  if (
    stripeStatus === "past_due" ||
    stripeStatus === "unpaid"
  ) {
    return {
      state: "overdue",
      label: "Payment overdue",
      isPaid: false,
    };
  }

  if (
    stripeStatus === "incomplete" ||
    stripeStatus === "incomplete_expired"
  ) {
    return {
      state: "setup_required",
      label: "Billing setup required",
      isPaid: false,
    };
  }

  if (stripeStatus === "paused") {
    return { state: "paused", label: "Paused", isPaid: false };
  }

  if (
    stripeStatus === "canceled" ||
    stripeStatus === "cancelled"
  ) {
    return {
      state: "cancelled",
      label: "Cancelled",
      isPaid: false,
    };
  }

  if (stripeStatus === "complimentary") {
    return {
      state: "complimentary",
      label: "Complimentary",
      isPaid: false,
    };
  }

  if (organisation?.account_type === "pilot") {
    return {
      state: "complimentary",
      label: "Pilot / Complimentary",
      isPaid: false,
    };
  }

  return {
    state: "pending",
    label: "Billing not set up",
    isPaid: false,
  };
}

function safeInternalPath(value: unknown) {
  const path =
    typeof value === "string" ? value.trim() : "";

  return (
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.includes("\\")
  );
}

function conversionRate(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return 0;
  }

  return numerator / denominator;
}

export async function GET(req: Request) {
  try {
    const context = await requireSuperadmin();

    if (!context) {
      return jsonError("Forbidden", 403);
    }

    const { portal } = context;
    const url = new URL(req.url);
    const range = parseRange(url.searchParams.get("range"));
    const rangeStart = getRangeStart(range);

    const {
      data: partnerData,
      error: partnerError,
    } = await portal
      .from("referral_partners")
      .select(
        [
          "id",
          "name",
          "email",
          "code",
          "destination_path",
          "status",
          "created_at",
          "updated_at",
        ].join(",")
      )
      .order("created_at", { ascending: false });

    if (partnerError) {
      return jsonError(partnerError.message, 500);
    }

    const partners = (partnerData ?? []) as unknown as ReferralPartner[];

    let clickQuery = portal
      .from("referral_clicks")
      .select(
        [
          "id",
          "partner_id",
          "is_first_touch",
          "clicked_at",
        ].join(",")
      )
      .order("clicked_at", { ascending: false });

    if (rangeStart) {
      clickQuery = clickQuery.gte("clicked_at", rangeStart);
    }

    const {
      data: clickData,
      error: clickError,
    } = await clickQuery;

    if (clickError) {
      return jsonError(clickError.message, 500);
    }

    const clicks = (clickData ?? []) as unknown as ReferralClick[];

    let attributionQuery = portal
      .from("referral_attributions")
      .select(
        [
          "id",
          "partner_id",
          "user_id",
          "org_id",
          "signup_tier",
          "attributed_at",
        ].join(",")
      )
      .order("attributed_at", { ascending: false });

    if (rangeStart) {
      attributionQuery = attributionQuery.gte(
        "attributed_at",
        rangeStart
      );
    }

    const {
      data: attributionData,
      error: attributionError,
    } = await attributionQuery;

    if (attributionError) {
      return jsonError(attributionError.message, 500);
    }

    const attributions = (attributionData ??
      []) as unknown as ReferralAttribution[];

    const orgIds = Array.from(
      new Set(
        attributions
          .map((row) => row.org_id)
          .filter(Boolean)
      )
    );

    let organisations: Organisation[] = [];
    let billingAccounts: BillingAccount[] = [];

    if (orgIds.length > 0) {
      const {
        data: orgData,
        error: orgError,
      } = await portal
        .from("orgs")
        .select(
          [
            "id",
            "name",
            "slug",
            "status",
            "account_type",
            "selected_tier",
          ].join(",")
        )
        .in("id", orgIds);

      if (orgError) {
        return jsonError(orgError.message, 500);
      }

      organisations = (orgData ?? []) as unknown as Organisation[];

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
            "stripe_status",
            "billing_interval",
            "billing_source",
            "updated_at",
          ].join(",")
        )
        .in("org_id", orgIds)
        .order("updated_at", { ascending: false });

      if (billingError) {
        return jsonError(billingError.message, 500);
      }

      billingAccounts = (billingData ??
        []) as unknown as BillingAccount[];
    }

    const organisationMap = new Map(
      organisations.map((organisation) => [
        organisation.id,
        organisation,
      ])
    );

    const billingMap = createBillingMap(billingAccounts);

    const partnerMap = new Map(
      partners.map((partner) => [partner.id, partner])
    );

    const conversions: ConversionRow[] = attributions.map(
      (attribution) => {
        const partner = partnerMap.get(attribution.partner_id);
        const organisation = organisationMap.get(
          attribution.org_id
        );
        const billing = billingMap.get(attribution.org_id);

        const payment = getPaymentState(
          organisation,
          billing
        );

        const currentTier =
          billing?.tier ??
          organisation?.selected_tier ??
          null;

        return {
          id: attribution.id,
          partnerId: attribution.partner_id,
          partnerName: partner?.name ?? "Unknown partner",
          orgId: attribution.org_id,
          orgName:
            organisation?.name ?? "Unknown organisation",
          orgSlug: organisation?.slug ?? null,
          signupAt: attribution.attributed_at,
          signupTier: attribution.signup_tier,
          signupPlan: planLabel(attribution.signup_tier),
          currentTier,
          currentPlan: planLabel(currentTier),
          paymentState: payment.state,
          paymentLabel: payment.label,
          isPaid: payment.isPaid,
          orgStatus: organisation?.status ?? null,
        };
      }
    );

    conversions.sort(
      (a, b) =>
        new Date(b.signupAt).getTime() -
        new Date(a.signupAt).getTime()
    );

    const partnerRows: PartnerPerformance[] = partners.map(
      (partner) => {
        const partnerClicks = clicks.filter(
          (click) => click.partner_id === partner.id
        ).length;

        const partnerConversions = conversions.filter(
          (conversion) => conversion.partnerId === partner.id
        );

        const signups = partnerConversions.length;
        const paidCustomers = partnerConversions.filter(
          (conversion) => conversion.isPaid
        ).length;

        return {
          id: partner.id,
          name: partner.name,
          email: partner.email,
          code: partner.code,
          destinationPath: partner.destination_path,
          status: partner.status,
          createdAt: partner.created_at,
          clicks: partnerClicks,
          signups,
          paidCustomers,
          signupConversion: conversionRate(
            signups,
            partnerClicks
          ),
          paidConversion: conversionRate(
            paidCustomers,
            signups
          ),
        };
      }
    );

    partnerRows.sort(
      (a, b) =>
        b.paidCustomers - a.paidCustomers ||
        b.signups - a.signups ||
        b.clicks - a.clicks ||
        a.name.localeCompare(b.name)
    );

    const paidConversions = conversions.filter(
      (conversion) => conversion.isPaid
    );

    const planMix = {
      starter: paidConversions.filter(
        (conversion) => conversion.currentTier === 1
      ).length,
      pro: paidConversions.filter(
        (conversion) => conversion.currentTier === 2
      ).length,
      growth: paidConversions.filter(
        (conversion) => conversion.currentTier === 3
      ).length,
      enterprise: paidConversions.filter(
        (conversion) => conversion.currentTier === 4
      ).length,
    };

    const totals = {
      partners: partners.length,
      activePartners: partners.filter(
        (partner) => partner.status === "active"
      ).length,
      clicks: clicks.length,
      signups: conversions.length,
      paidCustomers: paidConversions.length,
      signupConversion: conversionRate(
        conversions.length,
        clicks.length
      ),
      paidConversion: conversionRate(
        paidConversions.length,
        conversions.length
      ),
      planMix,
    };

    return NextResponse.json({
      ok: true,
      filters: {
        range,
        from: rangeStart,
        to: new Date().toISOString(),
      },
      totals,
      partners: partnerRows,
      conversions,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected error";

    console.error("[admin/referrals] GET failed", error);

    return jsonError(message, 500);
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireSuperadmin();

    if (!context) {
      return jsonError("Forbidden", 403);
    }

    const { userId, portal } = context;

    const body = await req.json().catch(() => null);

    if (!body) {
      return jsonError("Invalid JSON body", 400);
    }

    const name =
      typeof body.name === "string" ? body.name.trim() : "";

    const email =
      typeof body.email === "string" && body.email.trim()
        ? body.email.trim().toLowerCase()
        : null;

    const code = normaliseReferralCode(body.code);

    const destinationPath =
      typeof body.destination_path === "string" &&
      body.destination_path.trim()
        ? body.destination_path.trim()
        : DEFAULT_REFERRAL_DESTINATION;

    const status =
      body.status === "paused" ? "paused" : "active";

    if (!name) {
      return jsonError("Partner name is required.", 400);
    }

    if (
      !code ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(code)
    ) {
      return jsonError(
        "Referral code may contain lowercase letters, numbers and single hyphens only.",
        400
      );
    }

    if (
      email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return jsonError(
        "Enter a valid email address.",
        400
      );
    }

    if (!safeInternalPath(destinationPath)) {
      return jsonError(
        "Destination must be an internal MindCanvas path beginning with /.",
        400
      );
    }

    const {
      data: partner,
      error,
    } = await portal
      .from("referral_partners")
      .insert({
        name,
        email,
        code,
        destination_path: destinationPath,
        status,
        created_by: userId,
      })
      .select(
        [
          "id",
          "name",
          "email",
          "code",
          "destination_path",
          "status",
          "created_at",
        ].join(",")
      )
      .single();

    if (error?.code === "23505") {
      return jsonError(
        "That referral code is already in use.",
        409
      );
    }

    if (error || !partner) {
      return jsonError(
        error?.message ??
          "Could not create referral partner.",
        500
      );
    }

    const createdPartner =
      partner as unknown as ReferralPartner;

    // During the migration to multi-link referrals, every new partner
    // receives one Primary link using the existing code/destination.
    // This preserves the current dashboard contract while allowing
    // additional links to be added from the Partner Profile later.
    const {
      error: primaryLinkError,
    } = await portal
      .from("referral_links")
      .insert({
        partner_id: createdPartner.id,
        name: "Primary link",
        code,
        destination_path: destinationPath,
        status,
        created_by: userId,
      });

    if (primaryLinkError) {
      // Avoid leaving an unusable partner row behind if its Primary
      // link cannot be created.
      await portal
        .from("referral_partners")
        .delete()
        .eq("id", createdPartner.id);

      if (primaryLinkError.code === "23505") {
        return jsonError(
          "That referral code is already in use.",
          409
        );
      }

      return jsonError(
        primaryLinkError.message ||
          "Could not create the referral link.",
        500
      );
    }

    return NextResponse.json(
      {
        ok: true,
        partner: createdPartner,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected error";

    console.error("[admin/referrals] POST failed", error);

    return jsonError(message, 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const context = await requireSuperadmin();

    if (!context) {
      return jsonError("Forbidden", 403);
    }

    const { portal } = context;

    const body = await req.json().catch(() => null);

    if (!body) {
      return jsonError("Invalid JSON body", 400);
    }

    const partnerId =
      typeof body.partner_id === "string"
        ? body.partner_id.trim()
        : "";

    const status = body.status;

    if (!isUuid(partnerId)) {
      return jsonError("Invalid referral partner.", 400);
    }

    if (
      status !== "active" &&
      status !== "paused"
    ) {
      return jsonError(
        "Status must be active or paused.",
        400
      );
    }

    const {
      data: partner,
      error,
    } = await portal
      .from("referral_partners")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", partnerId)
      .select(
        [
          "id",
          "name",
          "email",
          "code",
          "destination_path",
          "status",
          "created_at",
        ].join(",")
      )
      .maybeSingle();

    if (error) {
      return jsonError(error.message, 500);
    }

    if (!partner) {
      return jsonError(
        "Referral partner not found.",
        404
      );
    }

    const updatedPartner =
      partner as unknown as ReferralPartner;

    // The current dashboard Pause/Reactivate action is partner-level.
    // Keep the original Primary link aligned with that action while
    // future secondary links retain their own independent status.
    const {
      error: primaryLinkError,
    } = await portal
      .from("referral_links")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("partner_id", partnerId)
      .eq("code", updatedPartner.code);

    if (primaryLinkError) {
      return jsonError(
        primaryLinkError.message,
        500
      );
    }

    return NextResponse.json({
      ok: true,
      partner: updatedPartner,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected error";

    console.error("[admin/referrals] PATCH failed", error);

    return jsonError(message, 500);
  }
}
