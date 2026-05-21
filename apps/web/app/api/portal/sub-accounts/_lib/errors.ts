import { NextResponse } from "next/server";
import type { ZodError, ZodSchema } from "zod";

type ErrEntry = { error: string; status: number; field?: string };
type ErrMap = Record<string, ErrEntry>;

export const CREATE_RPC_ERRORS: ErrMap = {
  parent_not_found: { error: "parent_not_found", status: 404 },
  parent_archived: { error: "parent_archived", status: 409 },
  forbidden: { error: "forbidden", status: 403 },
  tier_unavailable: { error: "tier_definition_missing", status: 500 },
  invalid_payer_mode: {
    error: "invalid_payer_mode",
    status: 400,
    field: "payer_mode",
  },
  slug_taken: { error: "slug_taken", status: 409 },
};

export const PATCH_RPC_ERRORS: ErrMap = {
  invalid_transition: { error: "invalid_transition", status: 409 },
  child_not_found: { error: "child_not_found", status: 404 },
  invalid_action: { error: "invalid_action", status: 400, field: "action" },
};

function errResponse(entry: ErrEntry) {
  const body: { ok: false; error: string; field?: string } = {
    ok: false,
    error: entry.error,
  };
  if (entry.field) body.field = entry.field;
  return NextResponse.json(body, { status: entry.status });
}

export function mapRpcError(
  rpcMessage: string | undefined,
  rpcCode: string | undefined,
  table: ErrMap,
): NextResponse | null {
  if (rpcCode === "23505" && table.slug_taken) {
    return errResponse(table.slug_taken);
  }
  const msg = rpcMessage || "";
  for (const key of Object.keys(table)) {
    if (msg.includes(key)) return errResponse(table[key]);
  }
  return null;
}

export function zodErrorResponse(err: ZodError) {
  const issue = err.issues[0];
  const field = typeof issue?.path[0] === "string" ? issue.path[0] : undefined;
  const body: { ok: false; error: string; field?: string } = {
    ok: false,
    error: issue?.message ?? "Invalid input",
  };
  if (field) body.field = field;
  return NextResponse.json(body, { status: 400 });
}

export function parseOr400<T>(
  schema: ZodSchema<T>,
  input: unknown,
):
  | { ok: true; data: T }
  | { ok: false; response: NextResponse } {
  const r = schema.safeParse(input);
  if (!r.success) return { ok: false, response: zodErrorResponse(r.error) };
  return { ok: true, data: r.data };
}
