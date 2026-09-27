// apps/web/app/api/admin/tests/base/list/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireSuperadminApi } from "@/lib/server/adminApiAuth";
import { getServiceClient } from "../../../../../_lib/supabase";

export async function GET() {
  const auth = await requireSuperadminApi();

  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status },
    );
  }

  const supabase = getServiceClient();
  const qs = await supabase
    .from("base_questions")
    .select("id,qnum,text,base_options(id,onum,text,points,profile_index,frequency)")
    .order("qnum", { ascending: true });

  if (qs.error) return NextResponse.json({ error: qs.error.message }, { status: 500 });

  return NextResponse.json({ items: qs.data ?? [] });
}