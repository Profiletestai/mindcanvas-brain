import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/_lib/supabaseAdmin";
import { getAuthUser } from "../_lib/auth";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function POST(req: Request) {
  const { user, error: authError } = await getAuthUser();
  if (authError) return authError;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "missing file" }, { status: 400 });
  }

  const ext = MIME_TO_EXT[file.type];
  if (!ext) {
    return NextResponse.json(
      { ok: false, error: "unsupported file type (allowed: png, jpeg, webp)" },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { ok: false, error: `file exceeds ${MAX_SIZE_BYTES} bytes` },
      { status: 400 }
    );
  }

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
