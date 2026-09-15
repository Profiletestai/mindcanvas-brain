// apps/web/app/api/admin/referrals/[partnerId]/links/route.ts

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

type RouteContext = {
  params: Promise<{
    partnerId: string;
  }>;
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

function requiredText(
  value: unknown
) {
  if (
    typeof value !== "string"
  ) {
    return "";
  }

  return value.trim();
}

function safeInternalPath(
  value: unknown
) {
  const path =
    typeof value === "string"
      ? value.trim()
      : "";

  return (
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.includes("\\")
  );
}

export async function POST(
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
      partnerId,
    } = await context.params;

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
      requiredText(
        body.name
      );

    const code =
      normaliseReferralCode(
        body.code
      );

    const destinationPath =
      typeof body.destination_path ===
        "string" &&
      body.destination_path.trim()
        ? body.destination_path.trim()
        : DEFAULT_REFERRAL_DESTINATION;

    const status =
      body.status === "paused"
        ? "paused"
        : "active";

    if (!name) {
      return jsonError(
        "Link name is required.",
        400
      );
    }

    if (
      !code ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
        code
      )
    ) {
      return jsonError(
        "Referral code may contain lowercase letters, numbers and single hyphens only.",
        400
      );
    }

    if (
      !safeInternalPath(
        destinationPath
      )
    ) {
      return jsonError(
        "Destination must be an internal MindCanvas path beginning with /.",
        400
      );
    }

    const {
      data: partner,
      error: partnerError,
    } = await portal
      .from(
        "referral_partners"
      )
      .select("id")
      .eq(
        "id",
        partnerId
      )
      .maybeSingle();

    if (partnerError) {
      return jsonError(
        partnerError.message,
        500
      );
    }

    if (!partner) {
      return jsonError(
        "Referral partner not found.",
        404
      );
    }

    const {
      data: linkData,
      error: linkError,
    } = await portal
      .from(
        "referral_links"
      )
      .insert({
        partner_id:
          partnerId,
        name,
        code,
        destination_path:
          destinationPath,
        status,
        created_by:
          userId,
      })
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
      .single();

    if (
      linkError?.code ===
      "23505"
    ) {
      return jsonError(
        "That referral code is already in use.",
        409
      );
    }

    if (
      linkError ||
      !linkData
    ) {
      return jsonError(
        linkError?.message ??
          "Could not create referral link.",
        500
      );
    }

    const link =
      linkData as unknown as ReferralLink;

    return NextResponse.json(
      {
        ok: true,
        link: {
          id:
            link.id,
          partnerId:
            link.partner_id,
          name:
            link.name,
          code:
            link.code,
          destinationPath:
            link.destination_path,
          status:
            link.status,
          createdAt:
            link.created_at,
          updatedAt:
            link.updated_at,
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
      "[admin/referrals/links] POST failed",
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

    const {
      portal,
    } = auth;

    const {
      partnerId,
    } = await context.params;

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

    const linkId =
      typeof body.link_id ===
        "string"
        ? body.link_id.trim()
        : typeof body.linkId ===
            "string"
          ? body.linkId.trim()
          : "";

    const status =
      body.status;

    if (!isUuid(linkId)) {
      return jsonError(
        "Invalid referral link.",
        400
      );
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
      data: linkData,
      error: linkError,
    } = await portal
      .from(
        "referral_links"
      )
      .update({
        status,
        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        linkId
      )
      .eq(
        "partner_id",
        partnerId
      )
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
      .maybeSingle();

    if (linkError) {
      return jsonError(
        linkError.message,
        500
      );
    }

    if (!linkData) {
      return jsonError(
        "Referral link not found.",
        404
      );
    }

    const link =
      linkData as unknown as ReferralLink;

    return NextResponse.json({
      ok: true,
      link: {
        id:
          link.id,
        partnerId:
          link.partner_id,
        name:
          link.name,
        code:
          link.code,
        destinationPath:
          link.destination_path,
        status:
          link.status,
        createdAt:
          link.created_at,
        updatedAt:
          link.updated_at,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected error";

    console.error(
      "[admin/referrals/links] PATCH failed",
      error
    );

    return jsonError(
      message,
      500
    );
  }
}

