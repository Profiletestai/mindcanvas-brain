import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/_lib/supabaseAdmin";
import { getAuthUser } from "../_lib/auth";
import {
  uploadLogoSchema,
  LOGO_MIME_TO_EXT,
} from "@/app/(v2)/onboarding/v2/_lib/schema";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { user, error: authError } = await getAuthUser();
  if (authError) return authError;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "missing file" }, { status: 400 });
  }

  const parsed = uploadLogoSchema.safeParse({ type: file.type, size: file.size });
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid file" },
      { status: 400 }
    );
  }
  const ext = LOGO_MIME_TO_EXT[parsed.data.type];

  const supabase = supabaseAdmin();

  try {
    await supabase.storage.createBucket("branding-logos", { public: true });
  } catch (_) {
    // bucket already exists
  }

  const arrbuf = await file.arrayBuffer();
  const path = `${user.id}/${randomUUID()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("branding-logos")
    .upload(path, new Uint8Array(arrbuf), {
      contentType: file.type,
      upsert: false,
    });

  if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });

  const { data: pub } = supabase.storage.from("branding-logos").getPublicUrl(path);
  return NextResponse.json({ ok: true, url: pub.publicUrl });
}
