import "server-only";
import { NextResponse } from "next/server";
import { getServerSupabase } from "@/app/_lib/portal";
import type { User } from "@supabase/supabase-js";

export async function getAuthUser(): Promise<{ user: User; error: null } | { user: null; error: NextResponse }> {
  const sb = await getServerSupabase();
  const { data, error } = await sb.auth.getUser();

  if (error || !data?.user) {
    return {
      user: null,
      error: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { user: data.user, error: null };
}
