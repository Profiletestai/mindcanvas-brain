//apps/web/app/admin/frameworks/[frameworkId]/templates/page.tsx
import "server-only";
import { getServiceClient } from "@/app/_lib/supabase";
import TemplatesClient from "./TemplatesClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type Params = { frameworkId: string };

type TemplateRow = {
  id: string;
  slug: string;
  version: string;
  status: string;
  sections_json: any;
  created_at: string;
};

export default async function Page({ params }: { params: Params }) {
  const frameworkId = params.frameworkId;
  const sb = getServiceClient();
  const portal = sb.schema("portal");

  const { data: fw } = await portal.from("frameworks").select("id, slug, name").eq("id", frameworkId).maybeSingle();

  const { data, error } = await portal
    .from("report_layout_templates")
    .select("id, slug, version, status, sections_json, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return <div className="p-6 text-sm text-red-600">Failed to load templates: {error.message}</div>;
  }

  async function updateTemplateAction(payload: { id: string; sections_json: any; status?: string }): Promise<{ ok: boolean; error?: string }> {
    "use server";
    try {
      const sb2 = getServiceClient();
      const portal2 = sb2.schema("portal");

      const patch: any = { sections_json: payload.sections_json };
      if (payload.status) patch.status = payload.status;

      const { error: upErr } = await portal2.from("report_layout_templates").update(patch).eq("id", payload.id);
      if (upErr) return { ok: false, error: upErr.message };
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: String(e?.message || e) };
    }
  }

  return (
    <TemplatesClient
      frameworkLabel={`${fw?.name || fw?.slug || frameworkId}`}
      initialTemplates={(data || []) as TemplateRow[]}
      updateTemplateAction={updateTemplateAction}
    />
  );
}