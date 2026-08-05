/* eslint-disable no-console */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

/**
 * This script seeds portal.report_blocks from the STYLED OperatingFrame JSON.
 *
 * ✅ Important assumptions based on your API:
 * - global blocks are fetched with entity_code = "GLOBAL"
 * - profile blocks are fetched with entity_code = top_profile_code (PROFILE_1..8)
 * - block_key must match layout section keys (global.cover, profile.identity, etc.)
 *
 * If your styled JSON uses different section ids (e.g. "next-steps"), we map them below.
 */

type AB = "A" | "B" | "C" | "D";

type Block = { type: string; [k: string]: any };
type Section = { id: string; title?: string; blocks?: Block[] };

// ---------- CONFIG: where the source JSON lives ----------
const SOURCE_JSON = "apps/web/data/frameworks/operatingframe/operatingframe_report_framework_v1_with_images_STYLED.json";

// ---------- CONFIG: map JSON section ids -> layout keys ----------
const GLOBAL_ID_TO_KEY: Record<string, string> = {
  // If your JSON uses these ids, map to the layout keys you showed earlier
  "global.cover": "global.cover",
  "global.welcome_letter": "global.welcome_letter",
  "global.summary_dashboard": "global.summary_dashboard",
  "global.how_to_use": "global.how_to_use",
  "global.framework_explainer": "global.framework_explainer",
  "global.conclusion": "global.conclusion",
  "global.cta_next_steps": "global.cta_next_steps",

  // common alternates from the styled file (examples)
  "how-to-use-this-report": "global.how_to_use",
  "the-framework": "global.framework_explainer",
  "closing-thoughts": "global.conclusion",
  "next-steps": "global.cta_next_steps",
};

const PROFILE_ID_TO_KEY: Record<string, string> = {
  "profile.identity": "profile.identity",
  "profile.strengths": "profile.strengths",
  "profile.development_areas": "profile.development_areas",
  "profile.communication_style": "profile.communication_style",
  "profile.reflection_questions": "profile.reflection_questions",
  "profile.collaboration": "profile.collaboration",
};

// ---------- helpers ----------
function safeText(x: any) {
  if (typeof x === "string") return x;
  if (x == null) return "";
  return String(x);
}

function readJson(): any {
  const filePath = path.join(process.cwd(), SOURCE_JSON);
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

// Try a few likely shapes (since frameworks can vary)
function pickGlobalSections(json: any): Section[] {
  if (Array.isArray(json?.globals?.sections)) return json.globals.sections;
  if (Array.isArray(json?.framework?.report?.sections)) return json.framework.report.sections;
  if (Array.isArray(json?.report?.sections)) return json.report.sections;
  return [];
}

function pickProfileSections(json: any): Record<string, Section[]> {
  // Expect profiles: { PROFILE_1: { sections: [...] }, ... }
  if (json?.profiles && typeof json.profiles === "object") {
    const out: Record<string, Section[]> = {};
    for (const [k, v] of Object.entries(json.profiles)) {
      const sections = Array.isArray((v as any)?.sections) ? (v as any).sections : [];
      out[String(k).toUpperCase()] = sections as Section[];
    }
    return out;
  }

  // Alternative: framework.report.profiles
  const pr = json?.framework?.report?.profiles;
  if (pr && typeof pr === "object") {
    const out: Record<string, Section[]> = {};
    for (const [k, v] of Object.entries(pr)) {
      const sections = Array.isArray((v as any)?.sections) ? (v as any).sections : [];
      out[String(k).toUpperCase()] = sections as Section[];
    }
    return out;
  }

  return {};
}

function mapGlobalKey(id: string): string | null {
  const k = safeText(id).trim();
  if (!k) return null;
  return GLOBAL_ID_TO_KEY[k] || (k.startsWith("global.") ? k : null);
}

function mapProfileKey(id: string): string | null {
  const k = safeText(id).trim();
  if (!k) return null;
  return PROFILE_ID_TO_KEY[k] || (k.startsWith("profile.") ? k : null);
}

function sbAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { db: { schema: "portal" }, auth: { persistSession: false } });
}

async function main() {
  const json = readJson();

  const globalSections = pickGlobalSections(json);
  const profileSectionsByCode = pickProfileSections(json);

  const rows: any[] = [];

  // ---- GLOBAL ----
  for (const s of globalSections) {
    const block_key = mapGlobalKey(s.id);
    if (!block_key) continue;

    rows.push({
      block_key,
      entity_type: "global",
      entity_code: "GLOBAL", // ✅ matches your API fetch
      version: "1.0",
      status: "active",
      content_json: {
        title: s.title ?? null,
        blocks: Array.isArray(s.blocks) ? s.blocks : [],
      },
    });
  }

  // ---- PROFILES ----
  for (const profileCode of Object.keys(profileSectionsByCode)) {
    const sections = profileSectionsByCode[profileCode] || [];

    for (const s of sections) {
      const block_key = mapProfileKey(s.id);
      if (!block_key) continue;

      rows.push({
        block_key,
        entity_type: "profile",
        entity_code: profileCode, // PROFILE_1..PROFILE_8
        version: "1.0",
        status: "active",
        content_json: {
          title: s.title ?? null,
          blocks: Array.isArray(s.blocks) ? s.blocks : [],
        },
      });
    }
  }

  if (rows.length === 0) {
    console.log("❌ No rows were created. That means the script couldn't find sections in the JSON or mapping didn't match.");
    console.log("Check SOURCE_JSON path and the mapping tables at the top.");
    process.exit(1);
  }

  console.log(`Upserting ${rows.length} rows into portal.report_blocks...`);

  const sb = sbAdmin();
  const { error } = await sb.from("report_blocks").upsert(rows, {
    onConflict: "block_key,entity_type,entity_code,version",
  });

  if (error) throw error;

  console.log("✅ Done. report_blocks is now populated.");
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});