// apps/web/lib/isValidUrl.ts
// Single URL validation rule shared by the create/edit link surfaces and the
// server routes that persist those URLs.

export function isValidUrl(value: string | null | undefined): boolean {
  const v = (value ?? "").trim();
  if (!v) return false;
  try {
    new URL(v);
    return true;
  } catch {
    return false;
  }
}

export default isValidUrl;
