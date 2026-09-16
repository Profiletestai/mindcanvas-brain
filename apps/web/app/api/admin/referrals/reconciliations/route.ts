// apps/web/app/api/admin/referrals/reconciliations/route.ts

import "server-only";

import { NextResponse } from "next/server";

import {
  getAdminClient,
  getServerSupabase,
} from "@/app/_lib/portal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type PaymentState =
  | "paid"
  | "trial"
  | "overdue"
  | "setup_required"
  | "paused"
  | "cancelled"
  | "complimentary"
  | "pending";

type ReferralAttribution = {
  id: string;
  partner_id: string;
  link_id: string | null;
  click_id: string;
  org_id: string;
  signup_tier: number | null;
  attributed_at: string;
};

type ReferralPartner = {
  id: string;
  name: string;
  email: string | null;
};

type ReferralLink = {
  id: string;
  name: string;
  code: string;
};

type ReferralClick = {
  id: string;
  clicked_at: string;
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

type ReconciliationRow = {
  id: string;
  label: string | null;
  period_start: string;
  period_end: string;
  partner_count: number;
  signup_count: number;
  paid_customer_count: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

function jsonError(
  error: string,
  status: number
) {
  return NextResponse.json(
    {
      ok: false,
      error,
    },
    {
      status,
    }
  );
}

async function requireSuperadmin() {
  const sb =
    await getServerSupabase();

  const {
    data: auth,
    error: authError,
  } = await sb.auth.getUser();

  const user =
    auth?.user ?? null;

  if (authError || !user) {
    return null;
  }

  const admin =
    await getAdminClient();

  const portal =
    admin.schema("portal");

  const {
    data: adminRow,
    error: adminError,
  } = await portal
    .from("superadmin")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    adminError ||
    !adminRow?.user_id
  ) {
    return null;
  }

  return {
    userId: user.id,
    portal,
  };
}

function planLabel(
  tier: number | null | undefined
) {
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

function getBillingPriority(
  account: BillingAccount
) {
  const stripeStatus =
    account.stripe_status
      ?.toLowerCase() ?? null;

  const statusPriority:
    Record<string, number> = {
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
    account.billing_type === "owner"
      ? 2
      : 1;

  return (
    (
      stripeStatus
        ? statusPriority[
            stripeStatus
          ] ?? 30
        : 25
    ) *
      10 +
    billingTypePriority
  );
}

function createBillingMap(
  accounts: BillingAccount[]
) {
  const map =
    new Map<
      string,
      BillingAccount
    >();

  for (
    const account of accounts
  ) {
    const existing =
      map.get(
        account.org_id
      );

    if (!existing) {
      map.set(
        account.org_id,
        account
      );

      continue;
    }

    const currentPriority =
      getBillingPriority(
        account
      );

    const existingPriority =
      getBillingPriority(
        existing
      );

    if (
      currentPriority >
      existingPriority
    ) {
      map.set(
        account.org_id,
        account
      );

      continue;
    }

    if (
      currentPriority ===
        existingPriority &&
      new Date(
        account.updated_at
      ).getTime() >
        new Date(
          existing.updated_at
        ).getTime()
    ) {
      map.set(
        account.org_id,
        account
      );
    }
  }

  return map;
}

function getPaymentState(
  organisation:
    | Organisation
    | undefined,
  billingAccount:
    | BillingAccount
    | undefined
): {
  state: PaymentState;
  label: string;
  isPaid: boolean;
} {
  const stripeStatus =
    billingAccount
      ?.stripe_status
      ?.toLowerCase() ??
    null;

  if (
    stripeStatus === "active"
  ) {
    return {
      state: "paid",
      label: "Paid",
      isPaid: true,
    };
  }

  if (
    stripeStatus === "trialing"
  ) {
    return {
      state: "trial",
      label: "Trial",
      isPaid: false,
    };
  }

  if (
    stripeStatus ===
      "past_due" ||
    stripeStatus === "unpaid"
  ) {
    return {
      state: "overdue",
      label:
        "Payment overdue",
      isPaid: false,
    };
  }

  if (
    stripeStatus ===
      "incomplete" ||
    stripeStatus ===
      "incomplete_expired"
  ) {
    return {
      state:
        "setup_required",
      label:
        "Billing setup required",
      isPaid: false,
    };
  }

  if (
    stripeStatus === "paused"
  ) {
    return {
      state: "paused",
      label: "Paused",
      isPaid: false,
    };
  }

  if (
    stripeStatus ===
      "canceled" ||
    stripeStatus ===
      "cancelled"
  ) {
    return {
      state: "cancelled",
      label: "Cancelled",
      isPaid: false,
    };
  }

  if (
    stripeStatus ===
    "complimentary"
  ) {
    return {
      state:
        "complimentary",
      label:
        "Complimentary",
      isPaid: false,
    };
  }

  if (
    organisation
      ?.account_type ===
    "pilot"
  ) {
    return {
      state:
        "complimentary",
      label:
        "Pilot / Complimentary",
      isPaid: false,
    };
  }

  return {
    state: "pending",
    label:
      "Billing not set up",
    isPaid: false,
  };
}

function optionalText(
  value: unknown
) {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const trimmed =
    value.trim();

  return trimmed || null;
}

function parseIsoDate(
  value: unknown
) {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const date =
    new Date(value);

  if (
    !Number.isFinite(
      date.getTime()
    )
  ) {
    return null;
  }

  return date.toISOString();
}

function defaultLabel(
  startIso: string,
  endIso: string
) {
  const start =
    new Date(startIso)
      .toISOString()
      .slice(0, 10);

  const end =
    new Date(endIso)
      .toISOString()
      .slice(0, 10);

  return `Referral reconciliation ${start} to ${end}`;
}

async function rollbackReconciliation(
  portal: any,
  reconciliationId: string
) {
  try {
    await portal
      .from(
        "referral_reconciliations"
      )
      .delete()
      .eq(
        "id",
        reconciliationId
      );
  } catch (
    rollbackError
  ) {
    console.error(
      "[admin/referrals/reconciliations] rollback failed",
      rollbackError
    );
  }
}

export async function GET() {
  try {
    const auth =
      await requireSuperadmin();

    if (!auth) {
      return jsonError(
        "Forbidden",
        403
      );
    }

    const {
      portal,
    } = auth;

    const {
      data,
      error,
    } = await portal
      .from(
        "referral_reconciliations"
      )
      .select(
        [
          "id",
          "label",
          "period_start",
          "period_end",
          "partner_count",
          "signup_count",
          "paid_customer_count",
          "notes",
          "created_by",
          "created_at",
        ].join(",")
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .limit(100);

    if (error) {
      return jsonError(
        error.message,
        500
      );
    }

    const reconciliations =
      (
        data ?? []
      ) as unknown as ReconciliationRow[];

    return NextResponse.json({
      ok: true,
      reconciliations:
        reconciliations.map(
          (row) => ({
            id:
              row.id,
            label:
              row.label,
            periodStart:
              row.period_start,
            periodEnd:
              row.period_end,
            partnerCount:
              row.partner_count,
            signupCount:
              row.signup_count,
            paidCustomerCount:
              row.paid_customer_count,
            notes:
              row.notes,
            createdBy:
              row.created_by,
            createdAt:
              row.created_at,
          })
        ),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected error";

    console.error(
      "[admin/referrals/reconciliations] GET failed",
      error
    );

    return jsonError(
      message,
      500
    );
  }
}

export async function POST(
  req: Request
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

    const {
      userId,
      portal,
    } = auth;

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

    const periodStart =
      parseIsoDate(
        body.period_start ??
          body.periodStart
      );

    const periodEnd =
      parseIsoDate(
        body.period_end ??
          body.periodEnd
      );

    if (
      !periodStart ||
      !periodEnd
    ) {
      return jsonError(
        "Valid period_start and period_end values are required.",
        400
      );
    }

    if (
      new Date(
        periodEnd
      ).getTime() <=
      new Date(
        periodStart
      ).getTime()
    ) {
      return jsonError(
        "period_end must be after period_start.",
        400
      );
    }

    const label =
      optionalText(
        body.label
      ) ??
      defaultLabel(
        periodStart,
        periodEnd
      );

    const notes =
      optionalText(
        body.notes
      );

    const {
      data:
        attributionData,
      error:
        attributionError,
    } = await portal
      .from(
        "referral_attributions"
      )
      .select(
        [
          "id",
          "partner_id",
          "link_id",
          "click_id",
          "org_id",
          "signup_tier",
          "attributed_at",
        ].join(",")
      )
      .gte(
        "attributed_at",
        periodStart
      )
      .lt(
        "attributed_at",
        periodEnd
      )
      .order(
        "attributed_at",
        {
          ascending: true,
        }
      );

    if (
      attributionError
    ) {
      return jsonError(
        attributionError
          .message,
        500
      );
    }

    const attributions =
      (
        attributionData ??
        []
      ) as unknown as ReferralAttribution[];

    const partnerIds =
      Array.from(
        new Set(
          attributions
            .map(
              (row) =>
                row.partner_id
            )
            .filter(Boolean)
        )
      );

    const linkIds =
      Array.from(
        new Set(
          attributions
            .map(
              (row) =>
                row.link_id
            )
            .filter(
              (
                value
              ): value is string =>
                Boolean(value)
            )
        )
      );

    const clickIds =
      Array.from(
        new Set(
          attributions
            .map(
              (row) =>
                row.click_id
            )
            .filter(Boolean)
        )
      );

    const orgIds =
      Array.from(
        new Set(
          attributions
            .map(
              (row) =>
                row.org_id
            )
            .filter(Boolean)
        )
      );

    let partners:
      ReferralPartner[] = [];

    let links:
      ReferralLink[] = [];

    let clicks:
      ReferralClick[] = [];

    let organisations:
      Organisation[] = [];

    let billingAccounts:
      BillingAccount[] = [];

    if (
      partnerIds.length >
      0
    ) {
      const {
        data,
        error,
      } = await portal
        .from(
          "referral_partners"
        )
        .select(
          "id,name,email"
        )
        .in(
          "id",
          partnerIds
        );

      if (error) {
        return jsonError(
          error.message,
          500
        );
      }

      partners =
        (
          data ?? []
        ) as unknown as ReferralPartner[];
    }

    if (
      linkIds.length > 0
    ) {
      const {
        data,
        error,
      } = await portal
        .from(
          "referral_links"
        )
        .select(
          "id,name,code"
        )
        .in(
          "id",
          linkIds
        );

      if (error) {
        return jsonError(
          error.message,
          500
        );
      }

      links =
        (
          data ?? []
        ) as unknown as ReferralLink[];
    }

    if (
      clickIds.length > 0
    ) {
      const {
        data,
        error,
      } = await portal
        .from(
          "referral_clicks"
        )
        .select(
          "id,clicked_at"
        )
        .in(
          "id",
          clickIds
        );

      if (error) {
        return jsonError(
          error.message,
          500
        );
      }

      clicks =
        (
          data ?? []
        ) as unknown as ReferralClick[];
    }

    if (
      orgIds.length > 0
    ) {
      const [
        orgResult,
        billingResult,
      ] =
        await Promise.all([
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
            .in(
              "id",
              orgIds
            ),

          portal
            .from(
              "billing_accounts"
            )
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
            .in(
              "org_id",
              orgIds
            )
            .order(
              "updated_at",
              {
                ascending:
                  false,
              }
            ),
        ]);

      if (
        orgResult.error
      ) {
        return jsonError(
          orgResult
            .error.message,
          500
        );
      }

      if (
        billingResult.error
      ) {
        return jsonError(
          billingResult
            .error.message,
          500
        );
      }

      organisations =
        (
          orgResult.data ??
          []
        ) as unknown as Organisation[];

      billingAccounts =
        (
          billingResult.data ??
          []
        ) as unknown as BillingAccount[];
    }

    const partnerMap =
      new Map(
        partners.map(
          (partner) => [
            partner.id,
            partner,
          ]
        )
      );

    const linkMap =
      new Map(
        links.map(
          (link) => [
            link.id,
            link,
          ]
        )
      );

    const clickMap =
      new Map(
        clicks.map(
          (click) => [
            click.id,
            click,
          ]
        )
      );

    const organisationMap =
      new Map(
        organisations.map(
          (organisation) => [
            organisation.id,
            organisation,
          ]
        )
      );

    const billingMap =
      createBillingMap(
        billingAccounts
      );

    const capturedAt =
      new Date()
        .toISOString();

    const snapshotItems =
      attributions.map(
        (attribution) => {
          const partner =
            partnerMap.get(
              attribution.partner_id
            );

          const link =
            attribution.link_id
              ? linkMap.get(
                  attribution.link_id
                )
              : undefined;

          const click =
            clickMap.get(
              attribution.click_id
            );

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
            organisation
              ?.selected_tier ??
            null;

          return {
            attribution,
            isPaid:
              payment.isPaid,
            row: {
              attribution_id:
                attribution.id,
              partner_id:
                attribution.partner_id,
              referral_link_id:
                attribution.link_id,
              click_id:
                attribution.click_id,
              org_id:
                attribution.org_id,
              billing_account_id:
                billing?.id ??
                null,

              partner_name:
                partner?.name ??
                "Unknown partner",
              partner_email:
                partner?.email ??
                null,
              link_name:
                link?.name ??
                null,
              link_code:
                link?.code ??
                null,

              organisation_name:
                organisation
                  ?.name ??
                "Unknown organisation",
              organisation_slug:
                organisation
                  ?.slug ??
                null,

              click_at:
                click
                  ?.clicked_at ??
                null,
              signup_at:
                attribution
                  .attributed_at,

              signup_tier:
                attribution
                  .signup_tier,
              signup_plan:
                planLabel(
                  attribution
                    .signup_tier
                ),

              current_tier:
                currentTier,
              current_plan:
                planLabel(
                  currentTier
                ),

              payment_state:
                payment.state,
              payment_label:
                payment.label,
              stripe_status:
                billing
                  ?.stripe_status ??
                null,

              billing_type:
                billing
                  ?.billing_type ??
                null,
              billing_interval:
                billing
                  ?.billing_interval ??
                null,
              billing_source:
                billing
                  ?.billing_source ??
                null,

              stripe_customer_id:
                billing
                  ?.stripe_customer_id ??
                null,
              stripe_subscription_id:
                billing
                  ?.stripe_subscription_id ??
                null,
              billing_period_start:
                billing
                  ?.period_start ??
                null,
              billing_period_end:
                billing
                  ?.period_end ??
                null,

              captured_at:
                capturedAt,
            },
          };
        }
      );

    const paidCustomerCount =
      snapshotItems.filter(
        (item) =>
          item.isPaid
      ).length;

    const partnerCount =
      new Set(
        attributions.map(
          (row) =>
            row.partner_id
        )
      ).size;

    const {
      data:
        reconciliationData,
      error:
        reconciliationError,
    } = await portal
      .from(
        "referral_reconciliations"
      )
      .insert({
        label,
        period_start:
          periodStart,
        period_end:
          periodEnd,
        partner_count:
          partnerCount,
        signup_count:
          attributions.length,
        paid_customer_count:
          paidCustomerCount,
        notes,
        created_by:
          userId,
      })
      .select(
        [
          "id",
          "label",
          "period_start",
          "period_end",
          "partner_count",
          "signup_count",
          "paid_customer_count",
          "notes",
          "created_by",
          "created_at",
        ].join(",")
      )
      .single();

    if (
      reconciliationError ||
      !reconciliationData
    ) {
      return jsonError(
        reconciliationError
          ?.message ??
          "Could not create referral reconciliation.",
        500
      );
    }

    const reconciliation =
      reconciliationData as unknown as ReconciliationRow;

    if (
      snapshotItems.length >
      0
    ) {
      const rows =
        snapshotItems.map(
          (item) => ({
            reconciliation_id:
              reconciliation.id,
            ...item.row,
          })
        );

      const {
        error:
          itemInsertError,
      } = await portal
        .from(
          "referral_reconciliation_items"
        )
        .insert(
          rows as any
        );

      if (
        itemInsertError
      ) {
        await rollbackReconciliation(
          portal,
          reconciliation.id
        );

        return jsonError(
          `Could not save reconciliation snapshot: ${itemInsertError.message}`,
          500
        );
      }
    }

    return NextResponse.json(
      {
        ok: true,
        reconciliation: {
          id:
            reconciliation.id,
          label:
            reconciliation.label,
          periodStart:
            reconciliation.period_start,
          periodEnd:
            reconciliation.period_end,
          partnerCount:
            reconciliation.partner_count,
          signupCount:
            reconciliation.signup_count,
          paidCustomerCount:
            reconciliation.paid_customer_count,
          notes:
            reconciliation.notes,
          createdBy:
            reconciliation.created_by,
          createdAt:
            reconciliation.created_at,
        },
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

    console.error(
      "[admin/referrals/reconciliations] POST failed",
      error
    );

    return jsonError(
      message,
      500
    );
  }
}

