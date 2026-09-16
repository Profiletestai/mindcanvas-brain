// apps/web/app/api/admin/referrals/reconciliations/[reconciliationId]/export/route.ts

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
    reconciliationId: string;
  }>;
};

type ExportKind =
  | "partner_summary"
  | "conversion_detail";

type Reconciliation = {
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

type ReconciliationItem = {
  id: string;
  reconciliation_id: string;
  attribution_id: string;
  partner_id: string;
  referral_link_id: string | null;
  click_id: string;
  org_id: string;
  billing_account_id: string | null;

  partner_name: string;
  partner_email: string | null;
  link_name: string | null;
  link_code: string | null;

  organisation_name: string;
  organisation_slug: string | null;

  click_at: string | null;
  signup_at: string;

  signup_tier: number | null;
  signup_plan: string;

  current_tier: number | null;
  current_plan: string;

  payment_state: string;
  payment_label: string;
  stripe_status: string | null;

  billing_type: string | null;
  billing_interval: string | null;
  billing_source: string | null;

  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  billing_period_start: string | null;
  billing_period_end: string | null;

  captured_at: string;
};

type PartnerSummary = {
  partnerId: string;
  partnerName: string;
  partnerEmail: string | null;
  linkCodes: Set<string>;
  signupCount: number;
  paidCount: number;
  trialCount: number;
  overdueCount: number;
  setupRequiredCount: number;
  pausedCount: number;
  cancelledCount: number;
  complimentaryCount: number;
  pendingCount: number;
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

function parseExportKind(
  value: string | null
): ExportKind | null {
  if (
    value === "partner_summary" ||
    value === "conversion_detail"
  ) {
    return value;
  }

  return null;
}

function safeFilenamePart(
  value: string
) {
  const part = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return part || "reconciliation";
}

function spreadsheetSafeText(
  value: string
) {
  if (
    /^[=+\-@]/.test(value)
  ) {
    return `'${value}`;
  }

  return value;
}

function csvCell(
  value: unknown
) {
  if (
    value === null ||
    value === undefined
  ) {
    return '""';
  }

  let text =
    value instanceof Date
      ? value.toISOString()
      : String(value);

  text =
    spreadsheetSafeText(text);

  return `"${text.replace(/"/g, '""')}"`;
}

function csvLine(
  values: unknown[]
) {
  return values
    .map(csvCell)
    .join(",");
}

function buildPartnerSummary(
  items: ReconciliationItem[]
) {
  const map =
    new Map<
      string,
      PartnerSummary
    >();

  for (const item of items) {
    let row =
      map.get(
        item.partner_id
      );

    if (!row) {
      row = {
        partnerId:
          item.partner_id,
        partnerName:
          item.partner_name,
        partnerEmail:
          item.partner_email,
        linkCodes:
          new Set<string>(),
        signupCount: 0,
        paidCount: 0,
        trialCount: 0,
        overdueCount: 0,
        setupRequiredCount: 0,
        pausedCount: 0,
        cancelledCount: 0,
        complimentaryCount: 0,
        pendingCount: 0,
      };

      map.set(
        item.partner_id,
        row
      );
    }

    if (item.link_code) {
      row.linkCodes.add(
        item.link_code
      );
    }

    row.signupCount += 1;

    switch (
      item.payment_state
    ) {
      case "paid":
        row.paidCount += 1;
        break;

      case "trial":
        row.trialCount += 1;
        break;

      case "overdue":
        row.overdueCount += 1;
        break;

      case "setup_required":
        row.setupRequiredCount +=
          1;
        break;

      case "paused":
        row.pausedCount += 1;
        break;

      case "cancelled":
        row.cancelledCount += 1;
        break;

      case "complimentary":
        row.complimentaryCount +=
          1;
        break;

      default:
        row.pendingCount += 1;
        break;
    }
  }

  return Array.from(
    map.values()
  ).sort(
    (a, b) =>
      b.paidCount -
        a.paidCount ||
      b.signupCount -
        a.signupCount ||
      a.partnerName.localeCompare(
        b.partnerName
      )
  );
}

function buildPartnerSummaryCsv(
  reconciliation:
    Reconciliation,
  items: ReconciliationItem[]
) {
  const headers = [
    "reconciliation_id",
    "reconciliation_label",
    "period_start",
    "period_end",
    "snapshot_created_at",
    "partner_id",
    "partner_name",
    "partner_email",
    "referral_links",
    "signup_count",
    "paid_customers",
    "trial_customers",
    "overdue_customers",
    "billing_setup_required",
    "paused_customers",
    "cancelled_customers",
    "complimentary_customers",
    "pending_customers",
  ];

  const summary =
    buildPartnerSummary(
      items
    );

  const rows =
    summary.map(
      (row) =>
        csvLine([
          reconciliation.id,
          reconciliation.label,
          reconciliation.period_start,
          reconciliation.period_end,
          reconciliation.created_at,
          row.partnerId,
          row.partnerName,
          row.partnerEmail,
          Array.from(
            row.linkCodes
          )
            .sort()
            .join(" | "),
          row.signupCount,
          row.paidCount,
          row.trialCount,
          row.overdueCount,
          row.setupRequiredCount,
          row.pausedCount,
          row.cancelledCount,
          row.complimentaryCount,
          row.pendingCount,
        ])
    );

  return [
    csvLine(headers),
    ...rows,
  ].join("\n");
}

function buildConversionDetailCsv(
  reconciliation:
    Reconciliation,
  items: ReconciliationItem[]
) {
  const headers = [
    "reconciliation_id",
    "reconciliation_label",
    "period_start",
    "period_end",
    "snapshot_created_at",
    "captured_at",

    "partner_id",
    "partner_name",
    "partner_email",

    "referral_link_id",
    "link_name",
    "link_code",

    "attribution_id",
    "click_id",
    "click_at",

    "org_id",
    "organisation_name",
    "organisation_slug",
    "signup_at",

    "signup_tier",
    "signup_plan",
    "current_tier",
    "current_plan",

    "payment_state",
    "payment_label",

    "billing_account_id",
    "billing_type",
    "billing_interval",
    "billing_source",

    "stripe_customer_id",
    "stripe_subscription_id",
    "stripe_status",
    "billing_period_start",
    "billing_period_end",
  ];

  const rows =
    items.map(
      (item) =>
        csvLine([
          reconciliation.id,
          reconciliation.label,
          reconciliation.period_start,
          reconciliation.period_end,
          reconciliation.created_at,
          item.captured_at,

          item.partner_id,
          item.partner_name,
          item.partner_email,

          item.referral_link_id,
          item.link_name,
          item.link_code,

          item.attribution_id,
          item.click_id,
          item.click_at,

          item.org_id,
          item.organisation_name,
          item.organisation_slug,
          item.signup_at,

          item.signup_tier,
          item.signup_plan,
          item.current_tier,
          item.current_plan,

          item.payment_state,
          item.payment_label,

          item.billing_account_id,
          item.billing_type,
          item.billing_interval,
          item.billing_source,

          item.stripe_customer_id,
          item.stripe_subscription_id,
          item.stripe_status,
          item.billing_period_start,
          item.billing_period_end,
        ])
    );

  return [
    csvLine(headers),
    ...rows,
  ].join("\n");
}

export async function GET(
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

    const {
      userId,
      portal,
    } = auth;

    const {
      reconciliationId,
    } = await context.params;

    if (
      !isUuid(
        reconciliationId
      )
    ) {
      return jsonError(
        "Invalid reconciliation.",
        400
      );
    }

    const url =
      new URL(req.url);

    const exportKind =
      parseExportKind(
        url.searchParams.get(
          "type"
        )
      );

    if (!exportKind) {
      return jsonError(
        "Export type must be partner_summary or conversion_detail.",
        400
      );
    }

    const {
      data:
        reconciliationData,
      error:
        reconciliationError,
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
      .eq(
        "id",
        reconciliationId
      )
      .maybeSingle();

    if (
      reconciliationError
    ) {
      return jsonError(
        reconciliationError
          .message,
        500
      );
    }

    if (
      !reconciliationData
    ) {
      return jsonError(
        "Reconciliation not found.",
        404
      );
    }

    const reconciliation =
      reconciliationData as unknown as Reconciliation;

    const {
      data: itemData,
      error: itemError,
    } = await portal
      .from(
        "referral_reconciliation_items"
      )
      .select(
        [
          "id",
          "reconciliation_id",
          "attribution_id",
          "partner_id",
          "referral_link_id",
          "click_id",
          "org_id",
          "billing_account_id",

          "partner_name",
          "partner_email",
          "link_name",
          "link_code",

          "organisation_name",
          "organisation_slug",

          "click_at",
          "signup_at",

          "signup_tier",
          "signup_plan",
          "current_tier",
          "current_plan",

          "payment_state",
          "payment_label",
          "stripe_status",

          "billing_type",
          "billing_interval",
          "billing_source",

          "stripe_customer_id",
          "stripe_subscription_id",
          "billing_period_start",
          "billing_period_end",

          "captured_at",
        ].join(",")
      )
      .eq(
        "reconciliation_id",
        reconciliationId
      )
      .order(
        "signup_at",
        {
          ascending: true,
        }
      );

    if (itemError) {
      return jsonError(
        itemError.message,
        500
      );
    }

    const items =
      (itemData ?? []) as unknown as ReconciliationItem[];

    const csv =
      exportKind ===
      "partner_summary"
        ? buildPartnerSummaryCsv(
            reconciliation,
            items
          )
        : buildConversionDetailCsv(
            reconciliation,
            items
          );

    const exportType =
      exportKind ===
      "partner_summary"
        ? "partner_summary_csv"
        : "conversion_detail_csv";

    const {
      error: auditError,
    } = await portal
      .from(
        "referral_reconciliation_exports"
      )
      .insert({
        reconciliation_id:
          reconciliationId,
        export_type:
          exportType,
        exported_by:
          userId,
      });

    if (auditError) {
      console.error(
        "[admin/referrals/reconciliations/export] audit insert failed",
        auditError
      );

      return jsonError(
        `Could not record export audit trail: ${auditError.message}`,
        500
      );
    }

    const labelPart =
      safeFilenamePart(
        reconciliation.label ??
          "referral-reconciliation"
      );

    const suffix =
      exportKind ===
      "partner_summary"
        ? "partner-summary"
        : "conversion-detail";

    const filename =
      `${labelPart}-${suffix}.csv`;

    return new NextResponse(
      `\uFEFF${csv}`,
      {
        status: 200,
        headers: {
          "Content-Type":
            "text/csv; charset=utf-8",
          "Content-Disposition":
            `attachment; filename="${filename}"`,
          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected error";

    console.error(
      "[admin/referrals/reconciliations/export] GET failed",
      error
    );

    return jsonError(
      message,
      500
    );
  }
}
