//apps/web/app/admin/mcas/applications/CopyButton.tsx
"use client";

export default function CopyButton({ text }: { text: string }) {
  return (
    <button
      type="button"
      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 hover:bg-white/10"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          // no-op
        }
      }}
    >
      Copy
    </button>
  );
}