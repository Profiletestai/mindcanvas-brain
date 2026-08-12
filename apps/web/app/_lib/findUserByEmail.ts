import "server-only";

export type SupabaseAuthUser = {
  id: string;
  email?: string;
  email_confirmed_at?: string | null;
};

export async function findUserByEmail(
  email: string
): Promise<SupabaseAuthUser | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    "";
  const res = await fetch(
    `${url}/auth/v1/admin/users?filter=${encodeURIComponent(email)}&per_page=200`,
    {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    }
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { users?: SupabaseAuthUser[] };
  const match = (json.users || []).find(
    (u) => (u.email || "").toLowerCase() === email.toLowerCase()
  );
  return match ?? null;
}
