// apps/web/lib/visibility/supabase.ts
import { createClient } from "@supabase/supabase-js";

export function getVisibilityServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY!; // service role strongly recommended
  return createClient(url, key, { db: { schema: "visibility" } });
}