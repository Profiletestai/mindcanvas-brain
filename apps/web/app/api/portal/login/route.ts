import { NextResponse } from "next/server";
import { getServerSupabase } from "@/app/_lib/portal";
import { resolvePostLoginNext } from "@/app/_lib/portal-postauth";

export const dynamic = "force-dynamic";

type LoginResponse =
  | {
      ok: true;
      next: string;
      is_superadmin: boolean;
      org_slug: string | null;
    }
  | { ok: false; error: string };

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = (body?.email || "").trim();
    const password = String(body?.password || "");

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, error: "Email and password required" },
        { status: 400 }
      );
    }

    const sb = await getServerSupabase();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });

    if (error || !data?.user) {
      return NextResponse.json(
        { ok: false, error: error?.message || "Invalid credentials" },
        { status: 401 }
      );
    }

    const post = await resolvePostLoginNext(data.user.id);

    return NextResponse.json({
      ok: true,
      is_superadmin: post.is_superadmin,
      org_slug: post.org_slug,
      next: post.next,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
