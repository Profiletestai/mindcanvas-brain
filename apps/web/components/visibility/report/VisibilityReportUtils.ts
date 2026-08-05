// apps/web/components/visibility/report/VisibilityReportUtils.ts

import type { PillarItem, Readiness, Section, Tier } from "./VisibilityReportTypes";

export const BRAND = {
  bg: "#061A3A",
  border: "rgba(255,255,255,0.12)",
  borderSoft: "rgba(255,255,255,0.08)",
  text: "rgba(255,255,255,0.94)",
  textDim: "rgba(255,255,255,0.76)",
  textFaint: "rgba(255,255,255,0.56)",
  white: "#F8FAFC",
  blue: "#4F7DFF",
  teal: "#45E0D1",
  purple: "#8B5CF6",
  amber: "#F3B95C",
  red: "#EF4444",
  orange: "#FB923C",
  green: "#22C55E",
  slate: "#A7B3C7",
  tier: {
    Invisible: "#A7B3C7",
    Emerging: "#4F7DFF",
    Established: "#32D7C8",
    Magnetic: "#8B5CF6",
  } as Record<Tier, string>,
};

export function safeString(x: any): string {
  return typeof x === "string" ? x.trim() : "";
}

export function safeNumber(x: any, fallback = 0): number {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

export function safeText(x: any): string {
  if (typeof x === "string") return x;
  if (Array.isArray(x)) return x.map(String).join(" ");
  if (x == null) return "";
  return String(x);
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function fullName(taker?: any): string {
  const n = [taker?.first_name, taker?.last_name].filter(Boolean).join(" ").trim();
  return n || "Your";
}

export function readinessLabel(r?: Readiness): string {
  if (r === "ready_to_progress") return "Ready to progress";
  if (r === "stabilise") return "Stabilise";
  return "—";
}

export function formatDate(d?: string | null): string {
  const dt = d ? new Date(d) : new Date();
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function tierBand(level: number): Tier {
  if (level <= 5) return "Invisible";
  if (level <= 10) return "Emerging";
  if (level <= 15) return "Established";
  return "Magnetic";
}

export function getPillarColor(key: string): string {
  const k = key.toLowerCase();
  if (k === "visibility" || k === "discoverability") return BRAND.blue;
  if (k === "trust" || k === "credibility") return BRAND.teal;
  if (k === "authority" || k === "conversion") return BRAND.amber;
  if (k === "dominance" || k === "influence") return BRAND.purple;
  return BRAND.blue;
}

export function getPillarLabel(key: string): string {
  const k = key.toLowerCase();
  if (k === "visibility") return "Visibility";
  if (k === "discoverability") return "Discoverability";
  if (k === "trust") return "Trust";
  if (k === "credibility") return "Credibility";
  if (k === "authority") return "Authority";
  if (k === "conversion") return "Conversion";
  if (k === "dominance") return "Dominance";
  if (k === "influence") return "Influence";
  return key;
}

export function bandFromValue(value: number): string {
  if (value >= 75) return "Strong";
  if (value >= 50) return "Developing";
  return "Weak";
}

export function buildPillars(raw: Record<string, number> | undefined | null): PillarItem[] {
  const source = raw || {};
  const keys = Object.keys(source).map((k) => k.toLowerCase());
  const isPrime =
    keys.includes("visibility") || keys.includes("authority") || keys.includes("dominance");

  const order = isPrime
    ? ["visibility", "trust", "authority", "dominance"]
    : ["discoverability", "trust", "conversion"];

  return order.map((key) => {
    const value = clamp(safeNumber((source as any)?.[key]), 0, 100);
    return {
      key,
      label: getPillarLabel(key),
      value,
      band: bandFromValue(value),
      color: getPillarColor(key),
    };
  });
}

export function sectionSummary(section?: Section | null): string {
  if (!section) return "";
  const blocks = Array.isArray(section.blocks) ? section.blocks : [];
  for (const block of blocks) {
    const short = safeString(block.short_summary);
    if (short) return short;
    const para = (Array.isArray(block.paragraphs) ? block.paragraphs : [])
      .map((p) => safeString(p))
      .find(Boolean);
    if (para) return para;
  }
  return "";
}

export function sectionParagraphs(section?: Section | null): string[] {
  if (!section) return [];
  const out: string[] = [];
  const blocks = Array.isArray(section.blocks) ? section.blocks : [];
  for (const block of blocks) {
    const paras = Array.isArray(block.paragraphs) ? block.paragraphs : [];
    for (const p of paras) {
      const s = safeString(p);
      if (s) out.push(s);
    }
  }
  return out;
}

export function sectionBullets(section?: Section | null): string[] {
  if (!section) return [];
  const out: string[] = [];
  const blocks = Array.isArray(section.blocks) ? section.blocks : [];
  for (const block of blocks) {
    const bullets = Array.isArray(block.bullets) ? block.bullets : [];
    for (const b of bullets) {
      const s = safeString(b);
      if (s) out.push(s);
    }
  }
  return out;
}

export function firstItems(arr: string[], count: number): string[] {
  return arr.filter(Boolean).slice(0, count);
}