// apps/web/lib/links/normalize.ts
// Value coercion shared by the test-link routes (create, list, patch) so the
// same input always lands in the database the same way.

export type ReportVariant = "lite" | "full";

// Any non-positive / non-integer / empty value means "no limit".
export function normalizeMaxUses(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null;
  return n;
}

export function normalizeReportVariant(v: any): ReportVariant {
  return String(v || "")
    .trim()
    .toLowerCase() === "lite"
    ? "lite"
    : "full";
}
