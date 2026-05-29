//apps/web/app/admin/mcas/test-lab/page.tsx
"use client";

import { useState } from "react";

export default function McasTestLabPage() {
  const [title, setTitle] = useState("Internal MCAS Test");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createLink() {
    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/mcas/test-lab/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to create test lab link");
      }

      window.location.href = json.url;
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8">
          <p className="text-sm text-slate-400">MCAS</p>
          <h1 className="text-3xl font-semibold">Test Lab</h1>
          <p className="mt-2 max-w-2xl text-slate-300">
            Private internal testing area for MCAS reverse profile scoring. This
            does not use Atumaphire routes or partner records.
          </p>
        </div>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">Create internal test link</h2>

          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm text-slate-300">Test title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm"
                placeholder="e.g. Software Engineering Team Lead"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-300">Optional role / notes</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm"
                placeholder="Add any internal notes or role context you want to see on the test page."
              />
            </div>

            {error ? (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <button
              type="button"
              onClick={createLink}
              disabled={creating || !title.trim()}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Test Lab Link"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}