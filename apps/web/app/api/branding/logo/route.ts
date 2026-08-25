import "server-only";
import { NextResponse } from "next/server";
import { getAdminClient } from "@/app/_lib/portal";
import { requireOrgAccess } from "@/lib/server/orgAccess";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/svg+xml", "image/jpeg"]);

export async function POST(req: Request) {
  const form = await req.formData();
  const orgId = typeof form.get("orgId") === "string" ? String(form.get("orgId")) : "";
  const file = form.get("file");
  const access = await requireOrgAccess(orgId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  if (!(file instanceof File)) return NextResponse.json({ error: "No logo supplied" }, { status: 400 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: "Use a PNG, SVG or JPEG logo." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Logo must be 2MB or smaller." }, { status: 400 });

  const admin = await getAdminClient();
  const extension = file.type === "image/svg+xml" ? "svg" : file.type === "image/jpeg" ? "jpg" : "png";
  const path = `${orgId}/logo-${Date.now()}.${extension}`;
  const storage = admin.storage.from("branding");
  const { error: uploadError } = await storage.upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: true });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });
  const { data } = storage.getPublicUrl(path);
  const url = data.publicUrl;
  const { error: saveError } = await admin.schema("portal").from("orgs").update({ logo_url: url }).eq("id", orgId);
  if (saveError) return NextResponse.json({ error: saveError.message }, { status: 500 });
  return NextResponse.json({ url });
}
