//apps/web/app/admin/frameworks/[frameworkId]/blocks/page.tsx
import "server-only";
import { getServiceClient } from "@/app/_lib/supabase";
import BlocksClient, { type BlockRowClient } from "./BlocksClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type Params = { frameworkId: string };

type FrameworkRow = {
  id: string;
  slug: string;
  name: string | null;
};

type BlockRow = {
  id: string;
  framework_id: string;
  block_key: string;
  entity_type: "global" | "frequency" | "profile";
  entity_code: string | null;
  version: string;
  status: string;
  content_json: any;
  created_at: string;
};

function normEntityCode(x: string | null | undefined) {
  const v = String(x || "").trim();
  return v ? v.toUpperCase() : null;
}

export default async function Page({ params }: { params: Params }) {
  const frameworkId = params.frameworkId;
  const sb = getServiceClient();
  const portal = sb.schema("portal");

  const { data: fw, error: fwErr } = await portal
    .from("frameworks")
    .select("id, slug, name")
    .eq("id", frameworkId)
    .maybeSingle();

  if (fwErr || !fw) {
    return (
      <div className="p-6 text-sm text-red-600">
        Framework not found: {fwErr?.message || "unknown"}
      </div>
    );
  }

  const { data: blocksData, error: blocksErr } = await portal
    .from("framework_content_blocks")
    .select("id, framework_id, block_key, entity_type, entity_code, version, status, content_json, created_at")
    .eq("framework_id", frameworkId)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (blocksErr) {
    return (
      <div className="p-6 text-sm text-red-600">
        Failed to load blocks: {blocksErr.message}
      </div>
    );
  }

  const blocks = ((blocksData || []) as BlockRow[]).map((b) => ({
    ...b,
    entity_code: b.entity_code ? String(b.entity_code).toUpperCase() : null,
  })) as BlockRowClient[];

  async function createBlockAction(payload: {
    block_key: string;
    entity_type: "global" | "frequency" | "profile";
    entity_code?: string | null;
    version: string;
    status: "draft" | "active" | "archived";
    content_json: any;
  }): Promise<{ ok: boolean; error?: string }> {
    "use server";

    try {
      const sb2 = getServiceClient();
      const portal2 = sb2.schema("portal");

      const row = {
        framework_id: frameworkId,
        block_key: payload.block_key.trim(),
        entity_type: payload.entity_type,
        entity_code: normEntityCode(payload.entity_code ?? null),
        version: String(payload.version || "").trim() || "1.0",
        status: payload.status,
        content_json: payload.content_json ?? {},
      };

      const { error } = await portal2.from("framework_content_blocks").insert(row);
      if (error) return { ok: false, error: error.message };

      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: String(e?.message || e) };
    }
  }

  async function createNewVersionAction(payload: {
    from_id: string;
    version: string;
    status: "draft" | "active";
    content_json: any;
  }): Promise<{ ok: boolean; error?: string }> {
    "use server";

    try {
      const sb2 = getServiceClient();
      const portal2 = sb2.schema("portal");

      const { data: fromRow, error: fromErr } = await portal2
        .from("framework_content_blocks")
        .select("id, framework_id, block_key, entity_type, entity_code")
        .eq("id", payload.from_id)
        .maybeSingle();

      if (fromErr || !fromRow) return { ok: false, error: fromErr?.message || "Source block not found." };

      const row = {
        framework_id: fromRow.framework_id,
        block_key: fromRow.block_key,
        entity_type: fromRow.entity_type,
        entity_code: fromRow.entity_code,
        version: String(payload.version || "").trim() || "1.0",
        status: payload.status,
        content_json: payload.content_json ?? {},
      };

      const { error } = await portal2.from("framework_content_blocks").insert(row);
      if (error) return { ok: false, error: error.message };

      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: String(e?.message || e) };
    }
  }

  async function setStatusAction(payload: {
    id: string;
    status: "draft" | "active" | "archived";
  }): Promise<{ ok: boolean; error?: string }> {
    "use server";

    try {
      const sb2 = getServiceClient();
      const portal2 = sb2.schema("portal");

      const { error } = await portal2
        .from("framework_content_blocks")
        .update({ status: payload.status })
        .eq("id", payload.id);

      if (error) return { ok: false, error: error.message };
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: String(e?.message || e) };
    }
  }

  return (
    <BlocksClient
      framework={fw as FrameworkRow}
      initialBlocks={blocks}
      createBlockAction={createBlockAction}
      createNewVersionAction={createNewVersionAction}
      setStatusAction={setStatusAction}
    />
  );
}