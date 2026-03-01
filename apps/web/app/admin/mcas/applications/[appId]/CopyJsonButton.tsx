//apps/web/app/admin/mcas/applications/[appId]/CopyJsonButton.tsx
"use client";

import { useState } from "react";

export default function CopyJsonButton({ json }: { json: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 hover:bg-white/10"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(json);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          // no-op
        }
      }}
      title="Copy JSON payload"
    >
      {copied ? "Copied" : "Copy JSON"}
    </button>
  );
}