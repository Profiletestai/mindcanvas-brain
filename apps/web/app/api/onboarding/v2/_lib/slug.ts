import "server-only";
import { portalAdmin } from "@/app/_lib/supabaseAdmin";

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

export async function generateUniqueSlug(name: string): Promise<string> {
  const base = toSlug(name) || "org";
  let candidate = base;

  for (let i = 0; i < 5; i++) {
    const { data } = await portalAdmin()
      .from("orgs")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();

    if (!data) return candidate;
    candidate = `${base}_${randomSuffix()}`;
  }

  return candidate;
}
