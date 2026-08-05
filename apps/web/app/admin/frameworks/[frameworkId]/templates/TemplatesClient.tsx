//apps/web/app/admin/frameworks/[frameworkId]/templates/TemplatesClient.tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";

type TemplateRow = {
  id: string;
  slug: string;
  version: string;
  status: string;
  sections_json: any;
  created_at: string;
};

function safeParseJson(text: string): { ok: true; value: any } | { ok: false; error: string } {
  try {
    const v = JSON.parse(text);
    return { ok: true, value: v };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

export default function TemplatesClient({
  frameworkLabel,
  initialTemplates,
  updateTemplateAction,
}: {
  frameworkLabel: string;
  initialTemplates: TemplateRow[];
  updateTemplateAction: (payload: { id: string; sections_json: any; status?: string }) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(initialTemplates[0]?.id ?? null);
  const selected = useMemo(() => initialTemplates.find((t) => t.id === selectedId) ?? null, [initialTemplates, selectedId]);

  const [text, setText] = useState(() => JSON.stringify(selected?.sections_json ?? [], null, 2));
  const [err, setErr] = useState<string | null>(null);

  useMemo(() => {
    setText(JSON.stringify(selected?.sections_json ?? [], null, 2));
    setErr(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  function format() {
    const parsed = safeParseJson(text);
    if (!parsed.ok) return setErr(parsed.error);
    setErr(null);
    setText(JSON.stringify(parsed.value, null, 2));
  }

  function save(status?: string) {
    if (!selected) return;
    const parsed = safeParseJson(text);
    if (!parsed.ok) return setErr(parsed.error);
    setErr(null);

    startTransition(async () => {
      const res = await updateTemplateAction({ id: selected.id, sections_json: parsed.value, status });
      if (!res.ok) alert(res.error || "Failed to save template.");
      else alert("Saved. Refresh to confirm.");
    });
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Layout Templates</h1>
          <p className="mt-1 text-sm text-slate-600">Framework: {frameworkLabel}</p>
        </div>
        <Link className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50" href="/admin/frameworks">
          Back
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-[420px_1fr]">
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="max-h-[75vh] overflow-auto">
            {initialTemplates.map((t) => {
              const sel = t.id === selectedId;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full border-b border-slate-100 px-3 py-3 text-left hover:bg-slate-50 ${sel ? "bg-slate-50" : ""}`}
                >
                  <div className="text-sm font-semibold text-slate-900">{t.slug}</div>
                  <div className="mt-1 text-xs text-slate-600">
                    v{t.version} · {t.status}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <button disabled={pending} onClick={format} className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60">
                Format JSON
              </button>
              <button disabled={pending} onClick={() => save()} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
                Save
              </button>
              <button disabled={pending} onClick={() => save("active")} className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60">
                Save + mark active
              </button>
              {pending ? <span className="text-xs text-slate-500">Saving…</span> : null}
            </div>
            {err ? <div className="mt-2 text-xs text-red-700">JSON error: {err}</div> : null}
          </div>

          <div className="p-4">
            <textarea className="h-[62vh] w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} />
            <p className="mt-3 text-xs text-slate-500">
              sections_json should be an array like: [{"{"}"key":"intro"{"}"}, {"{"}"key":"summary_dashboard"{"}"}…]
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}