// apps/web/components/portal/ui.ts
// Shared style constants + tiny helpers for the redesigned portal surfaces.
// Pure values (no JSX) so they import cleanly into server and client files.

export const JAKARTA = '"Plus Jakarta Sans", sans-serif';
export const JAKARTA_STYLE = { fontFamily: JAKARTA } as const;

// The dark rounded card surface used across dashboard, profile, tests, etc.
export const cardClass =
  "rounded-[20px] border border-white/[0.08] bg-[#0e2a45] backdrop-blur-[24px]";

// Uppercase muted field label (above form controls).
export const labelClass =
  "mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-white/[0.36]";

// Uppercase muted section eyebrow (e.g. "Choose usage level").
export const sectionLabelClass =
  "text-[10px] font-bold uppercase tracking-[0.08em] text-white/[0.36]";

// White input / textarea / select surface.
export const inputClass =
  "w-full rounded-[10px] border border-transparent bg-white px-3.5 py-2.5 text-[13px] text-[#2e3740] shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#54AFE0] focus:ring-2 focus:ring-[#54AFE0]/30";

// Primary "Save changes" style button.
export const primaryBtnClass =
  "inline-flex h-[30px] items-center justify-center rounded-lg bg-[linear-gradient(101.83deg,#54AFE0_0%,#54AFE0_100%)] px-4 text-[12px] font-bold leading-none text-white shadow-[0_6px_20px_0_rgba(26,106,232,0.38)] transition-opacity hover:opacity-90 disabled:opacity-60";

// Secondary / ghost button.
export const ghostBtnClass =
  "inline-flex h-[30px] items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.04] px-4 text-[12px] font-bold leading-none text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white";

// Compact table-row action button (Edit / Remove / Resend …).
export const smallBtnClass =
  "inline-flex h-[28px] items-center justify-center rounded-md border border-white/[0.12] bg-white/[0.04] px-3 text-[12px] font-semibold text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-60";

// --- Avatar helpers -------------------------------------------------------

// Deterministic avatar colour classes keyed off a name seed.
export const avatarPalette = [
  "bg-sky-500/15 text-sky-300",
  "bg-emerald-500/15 text-emerald-300",
  "bg-amber-500/15 text-amber-300",
  "bg-violet-500/15 text-violet-300",
  "bg-rose-500/15 text-rose-300",
  "bg-cyan-500/15 text-cyan-300",
];

// Up-to-two-letter initials from a name.
export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "—"
  );
}

// Stable palette entry for a seed string.
export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return avatarPalette[Math.abs(h) % avatarPalette.length];
}
