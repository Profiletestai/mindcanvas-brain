//apps/web/app/admin/frameworks/[frameworkId]/blocks/BlocksClient.tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";

export type BlockRowClient = {
  id: string;
  framework_id: string;
  block_key: string;
  entity_type: "global" | "frequency" | "profile";
  entity_code: string | null;
  version: string;
  status: string;
  content_json: any;
  created_at: string;
};

type FrameworkRow = { id: string; slug: string; name: string | null };

type Props = {
  framework: FrameworkRow;
  initialBlocks: BlockRowClient[];

  createBlockAction: (payload: {
    block_key: string;
    entity_type: "global" | "frequency" | "profile";
    entity_code?: string | null;
    version: string;
    status: "draft" | "active" | "archived";
    content_json: any;
  }) => Promise<{ ok: boolean; error?: string }>;

  createNewVersionAction: (payload: {
    from_id: string;
    version: string;
    status: "draft" | "active";
    content_json: any;
  }) => Promise<{ ok: boolean; error?: string }>;

  setStatusAction: (payload: { id: string; status: "draft" | "active" | "archived" }) => Promise<{ ok: boolean; error?: string }>;
};

function prettyJson(x: any) {
  try {
    return JSON.stringify(x ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

function safeParseJson(text: string): { ok: true; value: any } | { ok: false; error: string } {
  try {
    const v = JSON.parse(text);
    return { ok: true, value: v };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

export default function BlocksClient({
  framework,
  initialBlocks,
  createBlockAction,
  createNewVersionAction,
  setStatusAction,
}: Props) {
  const [pending, startTransition] = useTransition();

  const [query, setQuery] = useState("");
  const [entityType, setEntityType] = useState<"" | "global" | "frequency" | "profile">("");
  const [status, setStatus] = useState<"" | "draft" | "active" | "archived">("");

  const [selectedId, setSelectedId] = useState<string | null>(initialBlocks[0]?.id ?? null);

  const selected = useMemo(
    () => initialBlocks.find((b) => b.id === selectedId) ?? null,
    [initialBlocks, selectedId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initialBlocks.filter((b) => {
      if (entityType && b.entity_type !== entityType) return false;
      if (status && b.status !== status) return false;
      if (!q) return true;

      const hay = [
        b.block_key,
        b.entity_type,
        b.entity_code ?? "",
        b.version,
        b.status,
        JSON.stringify(b.content_json ?? {}),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [initialBlocks, query, entityType, status]);

  const [editorText, setEditorText] = useState<string>(() => prettyJson(selected?.content_json));
  const [editorError, setEditorError] = useState<string | null>(null);

  // When selection changes, refresh editor text
  useMemo(() => {
    setEditorText(prettyJson(selected?.content_json));
    setEditorError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const [newBlockOpen, setNewBlockOpen] = useState(false);
  const [nbKey, setNbKey] = useState("profile.identity");
  const [nbType, setNbType] = useState<"global" | "frequency" | "profile">("profile");
  const [nbCode, setNbCode] = useState("PROFILE_1");
  const [nbVersion, setNbVersion] = useState("1.0");
  const [nbStatus, setNbStatus] = useState<"draft" | "active">("draft");
  const [nbJson, setNbJson] = useState<string>('{\n  "title": "",\n  "body": ""\n}');

  function validateEditorJson() {
    const parsed = safeParseJson(editorText);
    if (!parsed.ok) {
      setEditorError(parsed.error);
      return null;
    }
    setEditorError(null);
    return parsed.value;
  }

  async function saveAsNewVersion(statusToSet: "draft" | "active") {
    if (!selected) return;

    const json = validateEditorJson();
    if (json == null) return;

    const nextVersion = prompt("New version (e.g. 1.1):", selected.version);
    if (!nextVersion) return;

    startTransition(async () => {
      const res = await createNewVersionAction({
        from_id: selected.id,
        version: nextVersion,
        status: statusToSet,
        content_json: json,
      });

      if (!res.ok) alert(res.error || "Failed to create new version.");
      else alert("Saved. Refresh the page to see the new row.");
    });
  }

  async function updateStatus(next: "draft" | "active" | "archived") {
    if (!selected) return;

    startTransition(async () => {
      const res = await setStatusAction({ id: selected.id, status: next });
      if (!res.ok) alert(res.error || "Failed to update status.");
      else alert("Updated. Refresh the page to see the change.");
    });
  }

  async function createNewBlock() {
    const parsed = safeParseJson(nbJson);
    if (!parsed.ok) {
      alert(`Invalid JSON: ${parsed.error}`);
      return;
    }

    startTransition(async () => {
      const res = await createBlockAction({
        block_key: nbKey.trim(),
        entity_type: nbType,
        entity_code: nbType === "global" ? null : nbCode.trim().toUpperCase(),
        version: nbVersion.trim() || "1.0",
        status: nbStatus,
        content_json: parsed.value,
      });

      if (!res.ok) alert(res.error || "Failed to create block.");
      else {
        alert("Created. Refresh the page to see the new row.");
        setNewBlockOpen(false);
      }
    });
  }

  function formatJson() {
    const parsed = safeParseJson(editorText);
    if (!parsed.ok) {
      setEditorError(parsed.error);
      return;
    }
    setEditorError(null);
    setEditorText(JSON.stringify(parsed.value, null, 2));
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Content Blocks</h1>
          <p className="mt-1 text-sm text-slate-600">
            Framework: <span className="font-mono text-xs">{framework.slug}</span> ({framework.name || "—"})
          </p>
        </div>

        <div className="flex gap-2">
          <Link className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50" href="/admin/frameworks">
            Back
          </Link>
          <button
            onClick={() => setNewBlockOpen((v) => !v)}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            + New block
          </button>
        </div>
      </div>

      {newBlockOpen ? (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <label className="text-xs font-semibold text-slate-600">block_key</label>
              <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={nbKey} onChange={(e) => setNbKey(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">entity_type</label>
              <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={nbType} onChange={(e) => setNbType(e.target.value as any)}>
                <option value="global">global</option>
                <option value="frequency">frequency</option>
                <option value="profile">profile</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">entity_code</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
                value={nbCode}
                disabled={nbType === "global"}
                onChange={(e) => setNbCode(e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-500">A/B/C/D or PROFILE_1..PROFILE_8</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">version + status</label>
              <div className="mt-1 flex gap-2">
                <input className="w-1/2 rounded-lg border border-slate-200 px-3 py-2 text-sm" value={nbVersion} onChange={(e) => setNbVersion(e.target.value)} />
                <select className="w-1/2 rounded-lg border border-slate-200 px-3 py-2 text-sm" value={nbStatus} onChange={(e) => setNbStatus(e.target.value as any)}>
                  <option value="draft">draft</option>
                  <option value="active">active</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-3">
            <label className="text-xs font-semibold text-slate-600">content_json</label>
            <textarea className="mt-1 h-40 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs" value={nbJson} onChange={(e) => setNbJson(e.target.value)} />
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button disabled={pending} onClick={createNewBlock} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
              Create
            </button>
            <button onClick={() => setNewBlockOpen(false)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-[420px_1fr]">
        {/* List */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-3">
            <div className="grid gap-2 md:grid-cols-3">
              <input
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Search block_key, code, content…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={entityType} onChange={(e) => setEntityType(e.target.value as any)}>
                <option value="">All types</option>
                <option value="global">global</option>
                <option value="frequency">frequency</option>
                <option value="profile">profile</option>
              </select>
              <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value as any)}>
                <option value="">All status</option>
                <option value="draft">draft</option>
                <option value="active">active</option>
                <option value="archived">archived</option>
              </select>
            </div>
          </div>

          <div className="max-h-[70vh] overflow-auto">
            {filtered.map((b) => {
              const isSel = b.id === selectedId;
              return (
                <button
                  key={b.id}
                  onClick={() => setSelectedId(b.id)}
                  className={`w-full border-b border-slate-100 px-3 py-3 text-left hover:bg-slate-50 ${isSel ? "bg-slate-50" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">{b.block_key}</div>
                      <div className="mt-1 text-xs text-slate-600">
                        {b.entity_type}
                        {b.entity_code ? ` · ${b.entity_code}` : ""} · v{b.version}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                        b.status === "active"
                          ? "bg-emerald-50 text-emerald-700"
                          : b.status === "draft"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {b.status}
                    </span>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 ? (
              <div className="p-4 text-sm text-slate-600">No blocks match your filters.</div>
            ) : null}
          </div>
        </div>

        {/* Editor */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-4">
            {selected ? (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{selected.block_key}</div>
                  <div className="mt-1 text-xs text-slate-600">
                    {selected.entity_type}
                    {selected.entity_code ? ` · ${selected.entity_code}` : ""} · v{selected.version}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button disabled={pending} onClick={formatJson} className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60">
                    Format JSON
                  </button>
                  <button
                    disabled={pending}
                    onClick={() => saveAsNewVersion("draft")}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
                  >
                    Save new version (draft)
                  </button>
                  <button
                    disabled={pending}
                    onClick={() => saveAsNewVersion("active")}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    Save new version (active)
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-600">Select a block to edit.</div>
            )}
          </div>

          <div className="p-4">
            {selected ? (
              <>
                <textarea
                  className="h-[52vh] w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
                  value={editorText}
                  onChange={(e) => setEditorText(e.target.value)}
                />

                {editorError ? (
                  <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    JSON error: {editorError}
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button disabled={pending} onClick={() => updateStatus("active")} className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60">
                    Mark active
                  </button>
                  <button disabled={pending} onClick={() => updateStatus("draft")} className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60">
                    Mark draft
                  </button>
                  <button disabled={pending} onClick={() => updateStatus("archived")} className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60">
                    Archive
                  </button>

                  {pending ? <span className="text-xs text-slate-500">Saving…</span> : null}
                </div>

                <p className="mt-3 text-xs text-slate-500">
                  Best practice: don’t edit a live row. Save a new version, then mark it active.
                </p>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}