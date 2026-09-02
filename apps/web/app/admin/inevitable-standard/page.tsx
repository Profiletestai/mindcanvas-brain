// apps/web/app/admin/inevitable-standard/page.tsx
// Superadmin console (gated by app/admin/layout.tsx) for creating / refreshing
// the Inevitable Standard Diagnostic test and minting a shareable test link.
import "server-only";

import Link from "next/link";
import InevitableStandardSeedClient from "./InevitableStandardSeedClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function InevitableStandardAdminPage() {
  return (
    <div className="fixed inset-0 mc-bg overflow-auto text-white">
      <div className="mx-auto max-w-3xl space-y-6 px-6 py-10">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Inevitable Standard — test setup</h1>
            <p className="mt-1 text-sm text-white/60">
              Create or refresh the diagnostic and generate a link anyone can take.
            </p>
          </div>
          <Link
            href="/admin"
            className="text-sm text-sky-300 underline-offset-4 hover:text-sky-100 hover:underline"
          >
            Back to admin
          </Link>
        </header>

        <InevitableStandardSeedClient />
      </div>
    </div>
  );
}
