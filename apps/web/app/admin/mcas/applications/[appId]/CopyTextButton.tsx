//apps/web/app/admin/mcas/applications/[appId]/CopyTextButton.tsx
"use client";

import { useState } from "react";

export default function CopyTextButton({
  text,
  label = "Copy",
  copiedLabel = "Copied",
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          // no-op
        }
      }}
      title="Copy to clipboard"
    >
      {copied ? copiedLabel : label}
    </button>
  );
}