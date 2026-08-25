import { NextResponse } from "next/server";
import { getServerSupabase } from "@/app/_lib/portal";

export const dynamic = "force-dynamic";

function clean(value: unknown, max = 160): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function GET() {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  const user = data.user;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  return NextResponse.json({ ok: true, account: { email: user.email ?? "", first_name: clean(meta.first_name), last_name: clean(meta.last_name), phone: clean(meta.phone), job_title: clean(meta.job_title), timezone: clean(meta.timezone) || "Africa/Johannesburg", email_verified: Boolean(user.email_confirmed_at) } });
}

export async function PATCH(req: Request) {
  const supabase = await getServerSupabase();
  const { data: current } = await supabase.auth.getUser();
  if (!current.user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const password = clean(body.password, 72);
  if (password && (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password))) {
    return NextResponse.json({ ok: false, error: "Password must be at least 8 characters and include upper-case, lower-case and a number." }, { status: 400 });
  }
  const metadata = { ...(current.user.user_metadata ?? {}), first_name: clean(body.first_name), last_name: clean(body.last_name), phone: clean(body.phone), job_title: clean(body.job_title), timezone: clean(body.timezone) || "Africa/Johannesburg" };
  const { error } = await supabase.auth.updateUser({ data: metadata, ...(password ? { password } : {}) });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
