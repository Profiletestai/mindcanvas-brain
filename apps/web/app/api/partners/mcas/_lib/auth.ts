//apps/web/app/api/partners/mcas/_lib/auth.ts
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

function supa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { db: { schema: "mcas" } });
}

export type PartnerAuth = {
  partner_key: string;
  allowed_org_id?: string | null;
};

export async function requirePartnerAuth(req: Request): Promise<PartnerAuth> {
  const partnerKey = req.headers.get("x-mcas-partner-key")?.trim();
  const apiKey = req.headers.get("x-mcas-api-key")?.trim();

  if (!partnerKey || !apiKey) {
    throw new Error("AUTH_MISSING_HEADERS");
  }

  const hash = crypto.createHash("sha256").update(apiKey).digest("hex");
  const sb = supa();

  const { data, error } = await sb
    .from("partners")
    .select("partner_key, api_key_hash, is_active, allowed_org_id")
    .eq("partner_key", partnerKey)
    .maybeSingle();

  if (error) throw new Error("AUTH_DB_ERROR");
  if (!data || !data.is_active) throw new Error("AUTH_INVALID_PARTNER");
  if (data.api_key_hash !== hash) throw new Error("AUTH_INVALID_KEY");

  return { partner_key: data.partner_key, allowed_org_id: data.allowed_org_id };
}