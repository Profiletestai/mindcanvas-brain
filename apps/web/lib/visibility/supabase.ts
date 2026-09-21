// apps/web/lib/visibility/supabase.ts
import { createClient } from "@supabase/supabase-js";

export function getVisibilityServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    "";

  if (!url || !key) {
    throw new Error("Missing Supabase service-role configuration");
  }

  return createClient(url, key, {
    db: { schema: "visibility" },
  });
}
