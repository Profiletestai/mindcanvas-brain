"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Org = { id: string; slug: string | null; name: string | null };

type SupabaseTarget = { url: string; host: string; projectRef: string };

type ExistingLink = {
  token: string;
  name: string | null;
  is_active: boolean;
  url: string;
};

type Preflight = {
  ok: true;
  supabase: SupabaseTarget;
  site_origin: string;
  expected_question_count: number;
  test:
    | {
        id: string;
        slug: string | null;
        name: string | null;
        org_id: string | null;
        status: string | null;
        question_count: number;
      }
    | null;
  links: ExistingLink[];
  orgs: Org[];
};

type SeedResult = {
  ok: true;
  supabase: SupabaseTarget;
  org: Org;
  test: {
    id: string;
    slug: string | null;
    name: string | null;
    status: string | null;
    question_count: number;
  };
  link: { token: string; url: string } | null;
  steps: string[];
};

const ENDPOINT = "/api/admin/inevitable-standard/seed";

function looksLikeProfileTest(org: Org) {
  const s = `${org.slug ?? ""} ${org.name ?? ""}`.toLowerCase();
  return s.includes("profiletest") || s.includes("profile test");
}

export default function InevitableStandardSeedClient() {
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [orgId, setOrgId] = useState("");
  const [createLink, setCreateLink] = useState(true);
  const [linkName, setLinkName] = useState("Inevitable Standard — test run");
  const [currency, setCurrency] = useState("AUD");

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SeedResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const loadPreflight = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch(ENDPOINT, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || `Request failed (${res.status})`);
      }
      setPreflight(json as Preflight);
      const existingOrg = (json.test?.org_id as string | undefined) || "";
      const auto =
        existingOrg ||
        ((json.orgs as Org[]).find(looksLikeProfileTest)?.id ?? "");
      setOrgId((current) => current || auto);
    } catch (e: any) {
      setLoadError(e?.message || "Could not load current state.");
    }
  }, []);

  useEffect(() => {
    loadPreflight();
  }, [loadPreflight]);

  const runSeed = useCallback(async () => {
    setBusy(true);
    setActionError(null);
    setResult(null);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, createLink, linkName, currency }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || `Request failed (${res.status})`);
      }
      setResult(json as SeedResult);
      await loadPreflight();
    } catch (e: any) {
      setActionError(e?.message || "Seeding failed.");
    } finally {
      setBusy(false);
    }
  }, [orgId, createLink, linkName, currency, loadPreflight]);

  const copy = useCallback(async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setTimeout(() => setCopied((c) => (c === value ? null : c)), 1500);
    } catch {
      /* clipboard blocked — the link is still selectable in the page */
    }
  }, []);

  const target = preflight?.supabase;
  const orgs = preflight?.orgs ?? [];

  const targetHint = useMemo(() => {
    if (!target?.host) return "unknown";
    return `${target.host}`;
  }, [target]);

  const card =
    "rounded-2xl border border-white/10 bg-white/5 p-5 shadow";
  const label = "block text-xs font-medium uppercase tracking-wide text-white/50";
  const inputCls =
    "mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-sky-400";

  return (
    <div className="space-y-6">
      {/* Connected environment */}
      <section className={card}>
        <h2 className="text-sm font-semibold text-white/80">Connected database</h2>
        {loadError ? (
          <p className="mt-2 text-sm text-rose-300">{loadError}</p>
        ) : !preflight ? (
          <p className="mt-2 text-sm text-white/50">Checking…</p>
        ) : (
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="w-32 shrink-0 text-white/40">Supabase host</dt>
              <dd className="font-mono text-white/90">{targetHint}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-32 shrink-0 text-white/40">Project ref</dt>
              <dd className="font-mono text-white/90">
                {target?.projectRef || "unknown"}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-32 shrink-0 text-white/40">Link origin</dt>
              <dd className="font-mono text-white/90">
                {preflight.site_origin || "—"}
              </dd>
            </div>
          </dl>
        )}
        <p className="mt-3 text-xs text-white/45">
          Writes go to whatever database this deployment is configured for. Open
          this page on the staging preview to target the staging database, not
          production.
        </p>
      </section>

      {/* Current state */}
      {preflight ? (
        <section className={card}>
          <h2 className="text-sm font-semibold text-white/80">Current test</h2>
          {preflight.test ? (
            <div className="mt-2 space-y-1 text-sm">
              <p className="text-white/90">
                {preflight.test.name}{" "}
                <span className="text-white/40">({preflight.test.slug})</span>
              </p>
              <p className="text-white/60">
                {preflight.test.question_count} / {preflight.expected_question_count}{" "}
                questions · status {preflight.test.status} · id{" "}
                <span className="font-mono">{preflight.test.id}</span>
              </p>
              {preflight.links.length > 0 ? (
                <div className="mt-3">
                  <p className="text-xs uppercase tracking-wide text-white/40">
                    Existing links
                  </p>
                  <ul className="mt-1 space-y-1">
                    {preflight.links.map((l) => (
                      <li key={l.token} className="flex flex-wrap items-center gap-2">
                        <a
                          href={l.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-sky-300 hover:underline"
                        >
                          {l.url}
                        </a>
                        {!l.is_active ? (
                          <span className="text-xs text-amber-300">inactive</span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => copy(l.url)}
                          className="rounded border border-white/15 px-2 py-0.5 text-xs text-white/70 hover:bg-white/10"
                        >
                          {copied === l.url ? "Copied" : "Copy"}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-sm text-white/50">
              Not created yet in this database.
            </p>
          )}
        </section>
      ) : null}

      {/* Action */}
      <section className={card}>
        <h2 className="text-sm font-semibold text-white/80">
          Create / refresh &amp; get a link
        </h2>

        <div className="mt-3 space-y-4">
          <div>
            <label className={label} htmlFor="org">
              Organisation (owns the test &amp; link)
            </label>
            <select
              id="org"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              className={inputCls}
            >
              <option value="">Select an organisation…</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name || o.slug || o.id}
                  {looksLikeProfileTest(o) ? "  ·  (profiletest.ai)" : ""}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-white/80">
            <input
              type="checkbox"
              checked={createLink}
              onChange={(e) => setCreateLink(e.target.checked)}
            />
            Also mint a fresh public link
          </label>

          {createLink ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={label} htmlFor="linkName">
                  Link label
                </label>
                <input
                  id="linkName"
                  value={linkName}
                  onChange={(e) => setLinkName(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={label} htmlFor="currency">
                  Currency (revenue-in-structure)
                </label>
                <input
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                  className={inputCls}
                  maxLength={3}
                />
              </div>
            </div>
          ) : null}

          <button
            type="button"
            disabled={busy || !orgId}
            onClick={runSeed}
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 px-4 py-2 text-sm font-medium text-white shadow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Working…" : "Create / refresh test"}
          </button>

          {actionError ? (
            <p className="text-sm text-rose-300">{actionError}</p>
          ) : null}
        </div>
      </section>

      {/* Result */}
      {result ? (
        <section className={card}>
          <h2 className="text-sm font-semibold text-emerald-300">Done</h2>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-white/70">
            {result.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          {result.link ? (
            <div className="mt-4">
              <p className={label}>Shareable link</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <a
                  href={result.link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all font-mono text-sky-300 hover:underline"
                >
                  {result.link.url}
                </a>
                <button
                  type="button"
                  onClick={() => copy(result.link!.url)}
                  className="rounded border border-white/15 px-2 py-0.5 text-xs text-white/70 hover:bg-white/10"
                >
                  {copied === result.link.url ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="mt-2 text-xs text-white/45">
                Open it in a browser to take the assessment from scratch; the
                report renders at the end.
              </p>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
