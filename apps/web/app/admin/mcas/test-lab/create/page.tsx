//apps/web/app/api/admin/mcas/test-lab/create/route.ts
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function McasTestLabCreatePage() {
  const router = useRouter();

  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);

  async function createRun() {
    try {
      setLoading(true);

      const res = await fetch("/api/admin/mcas/test-lab/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          job_title: jobTitle,
          job_description: jobDescription,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        alert(json?.error || "Failed to create test run");
        return;
      }

      router.push(`/admin/mcas/test-lab/${json.run_id}`);
    } catch (err: any) {
      alert(err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-8">
          <p className="text-sm text-slate-400">MCAS Test Lab</p>
          <h1 className="text-3xl font-semibold">
            Create Internal Reverse Profile Test
          </h1>
          <p className="mt-2 text-slate-400">
            Create a private MCAS reverse profile test run for scorer validation
            and calibration work.
          </p>
        </div>

        <div className="space-y-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div>
            <label className="mb-2 block text-sm text-slate-300">
              Job title
            </label>

            <input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Software Engineering Team Lead"
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">
              Job description
            </label>

            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={10}
              placeholder="Describe the role..."
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none"
            />
          </div>

          <button
            onClick={createRun}
            disabled={loading}
            className="rounded-xl bg-white px-5 py-3 font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Test Run"}
          </button>
        </div>
      </div>
    </main>
  );
}