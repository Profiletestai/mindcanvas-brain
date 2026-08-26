import "server-only";

import { NextResponse } from "next/server";
import { getAdminClient, getServerSupabase } from "@/app/_lib/portal";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);

async function authenticatedUser() {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  return { supabase, user: error ? null : data.user };
}

export async function POST(req: Request) {
  const { supabase, user } = await authenticatedUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "No profile image supplied" }, { status: 400 });
  const extension = ALLOWED.get(file.type);
  if (!extension) return NextResponse.json({ ok: false, error: "Use a JPG, PNG or WebP image." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ ok: false, error: "Profile image must be 2MB or smaller." }, { status: 400 });

  const admin = await getAdminClient();
  const path = `users/${user.id}/avatar-${Date.now()}.${extension}`;
  const storage = admin.storage.from("branding");
  const { error: uploadError } = await storage.upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (uploadError) return NextResponse.json({ ok: false, error: uploadError.message }, { status: 500 });

  const { data } = storage.getPublicUrl(path);
  const avatarUrl = data.publicUrl;
  const metadata = { ...(user.user_metadata ?? {}), avatar_url: avatarUrl };
  const { error: updateError } = await supabase.auth.updateUser({ data: metadata });
  if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 400 });

  return NextResponse.json({ ok: true, avatar_url: avatarUrl });
}

export async function DELETE() {
  const { supabase, user } = await authenticatedUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const metadata = { ...(user.user_metadata ?? {}), avatar_url: null };
  const { error } = await supabase.auth.updateUser({ data: metadata });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
