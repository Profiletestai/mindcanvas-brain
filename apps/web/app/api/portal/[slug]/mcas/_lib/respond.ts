// apps/web/app/api/portal/[slug]/mcas/_lib/respond.ts
// Shared response shaping for the portal MCAS routes.

import { NextResponse } from "next/server";

import type { PortalAccessFailure } from "@/lib/portal/authz";

export function accessDenied(failure: PortalAccessFailure) {
  return NextResponse.json(
    { ok: false, code: failure.code, error: failure.error },
    { status: failure.status },
  );
}

export function badRequest(error: string, code = "invalid_request") {
  return NextResponse.json({ ok: false, code, error }, { status: 400 });
}

export function notFound(error: string, code = "not_found") {
  return NextResponse.json({ ok: false, code, error }, { status: 404 });
}

/**
 * Logs the real cause server-side and returns a generic message. Supabase error
 * text can name schemas, columns and constraints — none of that belongs in a
 * tenant-facing response.
 */
export function serverError(scope: string, caught: unknown) {
  console.error(`[portal-mcas] ${scope}`, caught);

  return NextResponse.json(
    { ok: false, code: "server_error", error: "Something went wrong" },
    { status: 500 },
  );
}
