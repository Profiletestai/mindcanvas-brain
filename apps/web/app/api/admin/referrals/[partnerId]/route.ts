// apps/web/app/api/admin/referrals/[partnerId]/route.ts

import "server-only";

import { NextResponse } from "next/server";

import {
  getAdminClient,
  getServerSupabase,
} from "@/app/_lib/portal";

import { isUuid } from "@/app/_lib/referrals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{
    partnerId: string;
  }>;
};

type ReferralPartner = {
  id: string;
  name: string;
  email: string | null;
  contact_name: string | null;
  phone_number: string | null;
  website_url: string | null;
  notes: string | null;
  code: string;
  destination_path: string;
  status: "active" | "paused";
  created_at: string;
  updated_at: string;
};

type ReferralLink = {
  id: string;
  partner_id: string;
  name: string;
  code: string;
  destination_path: string;
  status: "active" | "paused";
  created_at: string;
  updated_at: string;
};

type ReferralClick = {
  id: string;
  partner_id: string;
  link_id: string | null;
  destination_path: string;
  is_first_touch: boolean;
  clicked_at: string;
};

type ReferralAttribution = {
  id: string;
  partner_id: string;
  link_id: string | null;
  click_id: string;
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
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_status: string | null;
  billing_interval: string | null;
  billing_source: string | null;
  period_start: string | null;
  period_end: string | null;
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

type LinkPerformance = {
  id: string;
  name: string;
  code: string;
  destinationPath: string;
  status: "active" | "paused";
  createdAt: string;
  clicks: number;
  firstTouchClicks: number;
  signups: number;
  paidCustomers: number;
  signupConversion: number;
  paidConversion: number;
};

type ConversionRow = {
  id: string;
  attributionId: string;
  clickId: string;
  partnerId: string;
  linkId: string | null;
  linkName: string | null;
  linkCode: string | null;
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
  billingAccountId: string | null;
  billingType: string | null;
  billingInterval: string | null;
  billingSource: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeStatus: string | null;
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
};

type RecentClick = {
  id: string;
  linkId: string | null;
  linkName: string | null;
  linkCode: string | null;
  destinationPath: string;
  isFirstTouch: boolean;
  clickedAt: string;
};

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { ok: false, error },
    { status }
  );
}

async function requireSuperadmin() {
  const sb = await getServerSupabase();
  const { data: auth, error: authError } =
    await sb.auth.getUser();

  const user = auth?.user ?? null;

  if (authError || !user) {
    return null;
  }

  const admin = await getAdminClient();
  const portal = admin.schema("portal");

  const { data: adminRow, error: adminError } =
    await portal
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

function conversionRate(
  numerator: number,
  denominator: number
) {
  if (denominator <= 0) {
    return 0;
  }

  return numerator / denominator;
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
    return {
      state: "paid",
      label: "Paid",
      isPaid: true,
    };
  }

  if (stripeStatus === "trialing") {
    return {
      state: "trial",
      label: "Trial",
      isPaid: false,
    };
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
    return {
      state: "paused",
      label: "Paused",
      isPaid: false,
    };
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

function optionalText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed || null;
}

function requiredText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function validEmail(value: string | null) {
  if (!value) {
    return true;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validWebsite(value: string | null) {
  if (!value) {
    return true;
  }

  try {
    const url = new URL(value);

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    );
  } catch {
    return false;
  }
}

export async function GET(
  _req: Request,
  context: RouteContext
) {
  try {
    const auth = await requireSuperadmin();

    if (!auth) {
      return jsonError("Forbidden", 403);
    }

    const { portal } = auth;
    const { partnerId } = await context.params;

    if (!isUuid(partnerId)) {
      return jsonError(
        "Invalid referral partner.",
        400
      );
    }

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
          "contact_name",
          "phone_number",
          "website_url",
          "notes",
          "code",
          "destination_path",
          "status",
          "created_at",
          "updated_at",
        ].join(",")
      )
      .eq("id", partnerId)
      .maybeSingle();

    if (partnerError) {
      return jsonError(
        partnerError.message,
        500
      );
    }

    if (!partnerData) {
      return jsonError(
        "Referral partner not found.",
        404
      );
    }

    const partner =
      partnerData as unknown as ReferralPartner;

    const [
      linkResult,
      clickResult,
      attributionResult,
    ] = await Promise.all([
      portal
        .from("referral_links")
        .select(
          [
            "id",
            "partner_id",
            "name",
            "code",
            "destination_path",
            "status",
            "created_at",
            "updated_at",
          ].join(",")
        )
        .eq("partner_id", partnerId)
        .order("created_at", {
          ascending: true,
        }),

      portal
        .from("referral_clicks")
        .select(
          [
            "id",
            "partner_id",
            "link_id",
            "destination_path",
            "is_first_touch",
            "clicked_at",
          ].join(",")
        )
        .eq("partner_id", partnerId)
        .order("clicked_at", {
          ascending: false,
        }),

      portal
        .from("referral_attributions")
        .select(
          [
            "id",
            "partner_id",
            "link_id",
            "click_id",
            "user_id",
            "org_id",
            "signup_tier",
            "attributed_at",
          ].join(",")
        )
        .eq("partner_id", partnerId)
        .order("attributed_at", {
          ascending: false,
        }),
    ]);

    if (linkResult.error) {
      return jsonError(
        linkResult.error.message,
        500
      );
    }

    if (clickResult.error) {
      return jsonError(
        clickResult.error.message,
        500
      );
    }

    if (attributionResult.error) {
      return jsonError(
        attributionResult.error.message,
        500
      );
    }

    const links =
      (linkResult.data ?? []) as unknown as ReferralLink[];

    const clicks =
      (clickResult.data ?? []) as unknown as ReferralClick[];

    const attributions =
      (attributionResult.data ?? []) as unknown as ReferralAttribution[];

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
      const [
        orgResult,
        billingResult,
      ] = await Promise.all([
        portal
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
          .in("id", orgIds),

        portal
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
              "billing_interval",
              "billing_source",
              "period_start",
              "period_end",
              "updated_at",
            ].join(",")
          )
          .in("org_id", orgIds)
          .order("updated_at", {
            ascending: false,
          }),
      ]);

      if (orgResult.error) {
        return jsonError(
          orgResult.error.message,
          500
        );
      }

      if (billingResult.error) {
        return jsonError(
          billingResult.error.message,
          500
        );
      }

      organisations =
        (orgResult.data ?? []) as unknown as Organisation[];

      billingAccounts =
        (billingResult.data ?? []) as unknown as BillingAccount[];
    }

    const organisationMap = new Map(
      organisations.map((organisation) => [
        organisation.id,
        organisation,
      ])
    );

    const billingMap =
      createBillingMap(billingAccounts);

    const linkMap = new Map(
      links.map((link) => [
        link.id,
        link,
      ])
    );

    const conversions: ConversionRow[] =
      attributions.map((attribution) => {
        const link = attribution.link_id
          ? linkMap.get(attribution.link_id)
          : undefined;

        const organisation =
          organisationMap.get(
            attribution.org_id
          );

        const billing =
          billingMap.get(
            attribution.org_id
          );

        const payment =
          getPaymentState(
            organisation,
            billing
          );

        const currentTier =
          billing?.tier ??
          organisation?.selected_tier ??
          null;

        return {
          id: attribution.id,
          attributionId:
            attribution.id,
          clickId:
            attribution.click_id,
          partnerId:
            attribution.partner_id,
          linkId:
            attribution.link_id,
          linkName:
            link?.name ?? null,
          linkCode:
            link?.code ?? null,
          orgId:
            attribution.org_id,
          orgName:
            organisation?.name ??
            "Unknown organisation",
          orgSlug:
            organisation?.slug ??
            null,
          signupAt:
            attribution.attributed_at,
          signupTier:
            attribution.signup_tier,
          signupPlan:
            planLabel(
              attribution.signup_tier
            ),
          currentTier,
          currentPlan:
            planLabel(currentTier),
          paymentState:
            payment.state,
          paymentLabel:
            payment.label,
          isPaid:
            payment.isPaid,
          orgStatus:
            organisation?.status ??
            null,
          billingAccountId:
            billing?.id ?? null,
          billingType:
            billing?.billing_type ??
            null,
          billingInterval:
            billing?.billing_interval ??
            null,
          billingSource:
            billing?.billing_source ??
            null,
          stripeCustomerId:
            billing?.stripe_customer_id ??
            null,
          stripeSubscriptionId:
            billing?.stripe_subscription_id ??
            null,
          stripeStatus:
            billing?.stripe_status ??
            null,
          billingPeriodStart:
            billing?.period_start ??
            null,
          billingPeriodEnd:
            billing?.period_end ??
            null,
        };
      });

    const linkPerformance: LinkPerformance[] =
      links.map((link) => {
        const linkClicks =
          clicks.filter(
            (click) =>
              click.link_id ===
              link.id
          );

        const linkSignups =
          conversions.filter(
            (conversion) =>
              conversion.linkId ===
              link.id
          );

        const paidCustomers =
          linkSignups.filter(
            (conversion) =>
              conversion.isPaid
          ).length;

        return {
          id: link.id,
          name: link.name,
          code: link.code,
          destinationPath:
            link.destination_path,
          status: link.status,
          createdAt:
            link.created_at,
          clicks:
            linkClicks.length,
          firstTouchClicks:
            linkClicks.filter(
              (click) =>
                click.is_first_touch
            ).length,
          signups:
            linkSignups.length,
          paidCustomers,
          signupConversion:
            conversionRate(
              linkSignups.length,
              linkClicks.length
            ),
          paidConversion:
            conversionRate(
              paidCustomers,
              linkSignups.length
            ),
        };
      });

    const recentClicks: RecentClick[] =
      clicks
        .slice(0, 50)
        .map((click) => {
          const link =
            click.link_id
              ? linkMap.get(
                  click.link_id
                )
              : undefined;

          return {
            id: click.id,
            linkId:
              click.link_id,
            linkName:
              link?.name ??
              null,
            linkCode:
              link?.code ??
              null,
            destinationPath:
              click.destination_path,
            isFirstTouch:
              click.is_first_touch,
            clickedAt:
              click.clicked_at,
          };
        });

    const paidCustomers =
      conversions.filter(
        (conversion) =>
          conversion.isPaid
      ).length;

    const totals = {
      links:
        links.length,
      activeLinks:
        links.filter(
          (link) =>
            link.status ===
            "active"
        ).length,
      clicks:
        clicks.length,
      firstTouchClicks:
        clicks.filter(
          (click) =>
            click.is_first_touch
        ).length,
      signups:
        conversions.length,
      paidCustomers,
      signupConversion:
        conversionRate(
          conversions.length,
          clicks.length
        ),
      paidConversion:
        conversionRate(
          paidCustomers,
          conversions.length
        ),
    };

    return NextResponse.json({
      ok: true,
      partner: {
        id: partner.id,
        name: partner.name,
        email: partner.email,
        contactName:
          partner.contact_name,
        phoneNumber:
          partner.phone_number,
        websiteUrl:
          partner.website_url,
        notes: partner.notes,
        status: partner.status,
        legacyCode:
          partner.code,
        legacyDestinationPath:
          partner.destination_path,
        createdAt:
          partner.created_at,
        updatedAt:
          partner.updated_at,
      },
      totals,
      links:
        linkPerformance,
      conversions,
      recentClicks,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected error";

    console.error(
      "[admin/referrals/partner] GET failed",
      error
    );

    return jsonError(
      message,
      500
    );
  }
}

export async function PATCH(
  req: Request,
  context: RouteContext
) {
  try {
    const auth =
      await requireSuperadmin();

    if (!auth) {
      return jsonError(
        "Forbidden",
        403
      );
    }

    const { portal } = auth;
    const { partnerId } =
      await context.params;

    if (!isUuid(partnerId)) {
      return jsonError(
        "Invalid referral partner.",
        400
      );
    }

    const body =
      await req
        .json()
        .catch(() => null);

    if (!body) {
      return jsonError(
        "Invalid JSON body",
        400
      );
    }

    const name =
      requiredText(body.name);

    const email =
      optionalText(
        body.email
      )?.toLowerCase() ??
      null;

    const contactName =
      optionalText(
        body.contact_name ??
          body.contactName
      );

    const phoneNumber =
      optionalText(
        body.phone_number ??
          body.phoneNumber
      );

    const websiteUrl =
      optionalText(
        body.website_url ??
          body.websiteUrl
      );

    const notes =
      optionalText(body.notes);

    if (!name) {
      return jsonError(
        "Partner name is required.",
        400
      );
    }

    if (!validEmail(email)) {
      return jsonError(
        "Enter a valid email address.",
        400
      );
    }

    if (!validWebsite(websiteUrl)) {
      return jsonError(
        "Website must be a valid http:// or https:// URL.",
        400
      );
    }

    const {
      data: partnerData,
      error: partnerError,
    } = await portal
      .from("referral_partners")
      .update({
        name,
        email,
        contact_name:
          contactName,
        phone_number:
          phoneNumber,
        website_url:
          websiteUrl,
        notes,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", partnerId)
      .select(
        [
          "id",
          "name",
          "email",
          "contact_name",
          "phone_number",
          "website_url",
          "notes",
          "code",
          "destination_path",
          "status",
          "created_at",
          "updated_at",
        ].join(",")
      )
      .maybeSingle();

    if (partnerError) {
      return jsonError(
        partnerError.message,
        500
      );
    }

    if (!partnerData) {
      return jsonError(
        "Referral partner not found.",
        404
      );
    }

    const partner =
      partnerData as unknown as ReferralPartner;

    return NextResponse.json({
      ok: true,
      partner: {
        id: partner.id,
        name: partner.name,
        email: partner.email,
        contactName:
          partner.contact_name,
        phoneNumber:
          partner.phone_number,
        websiteUrl:
          partner.website_url,
        notes: partner.notes,
        status: partner.status,
        legacyCode:
          partner.code,
        legacyDestinationPath:
          partner.destination_path,
        createdAt:
          partner.created_at,
        updatedAt:
          partner.updated_at,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected error";

    console.error(
      "[admin/referrals/partner] PATCH failed",
      error
    );

    return jsonError(
      message,
      500
    );
  }
}
