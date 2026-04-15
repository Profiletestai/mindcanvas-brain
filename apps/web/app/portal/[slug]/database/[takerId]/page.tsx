// apps/web/app/portal/[slug]/database/[takerId]/page.tsx
export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import FrequencyPie from "@/components/charts/FrequencyPie";
import ProfileBar from "@/components/charts/ProfileBar";

type ScoreMap = Record<string, number>;

type FrequencyPieData = {
  A: number;
  B: number;
  C: number;
  D: number;
};

type PersonalityKey = "FIRE" | "FLOW" | "FORM" | "FIELD";
type MindsetKey = "ORIGIN" | "MOMENTUM" | "VECTOR" | "ORBIT" | "QUANTUM";

type PersonalityPercMap = Partial<Record<PersonalityKey, number>>;
type MindsetPercMap = Partial<Record<MindsetKey, number>>;

const PERSONALITIES: { key: PersonalityKey; label: string; code: string }[] = [
  { key: "FIRE", label: "Fire", code: "A" },
  { key: "FLOW", label: "Flow", code: "B" },
  { key: "FORM", label: "Form", code: "C" },
  { key: "FIELD", label: "Field", code: "D" },
];

const MINDSETS: { key: MindsetKey; label: string; level: number }[] = [
  { key: "ORIGIN", label: "Origin", level: 1 },
  { key: "MOMENTUM", label: "Momentum", level: 2 },
  { key: "VECTOR", label: "Vector", level: 3 },
  { key: "ORBIT", label: "Orbit", level: 4 },
  { key: "QUANTUM", label: "Quantum", level: 5 },
];

const FREQUENCY_COLORS: Record<PersonalityKey, string> = {
  FIRE: "#f97316",
  FLOW: "#0ea5e9",
  FORM: "#22c55e",
  FIELD: "#a855f7",
};

async function getData(takerId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase
    .from("test_taker_reports_view")
    .select("*")
    .eq("taker_id", takerId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

function normalisePercent(raw: number | undefined | null): number {
  if (raw == null || !Number.isFinite(raw)) return 0;
  if (raw > 0 && raw <= 1.5) return raw * 100;
  return Math.min(Math.max(raw, 0), 100);
}

function percentLabel(value: number | undefined | null): string {
  const v = typeof value === "number" ? value : 0;
  return `${v.toFixed(1).replace(/\.0$/, "")}%`;
}

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function toScoreMap(value: unknown): ScoreMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const out: ScoreMap = {};

  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const n =
      typeof raw === "number"
        ? raw
        : typeof raw === "string"
          ? parseFloat(raw)
          : 0;

    out[key] = Number.isFinite(n) ? n : 0;
  }

  return out;
}

function toFrequencyPieData(freqScores: ScoreMap): FrequencyPieData {
  return {
    A: freqScores.A ?? 0,
    B: freqScores.B ?? 0,
    C: freqScores.C ?? 0,
    D: freqScores.D ?? 0,
  };
}

function safeSections(value: unknown): Record<string, string> {
  if (!value) return {};

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, string>;
      }
    } catch {
      return {};
    }
    return {};
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, string>;
  }

  return {};
}

function isQscProfile(data: any, profileScores: ScoreMap): boolean {
  return Boolean(
    data?.combined_profile_code ||
      data?.primary_personality ||
      data?.primary_mindset ||
      data?.personality_percentages ||
      data?.mindset_percentages ||
      Object.keys(profileScores).some((k) => k.toUpperCase().startsWith("QSC_")),
  );
}

function getPersonalityPercentages(data: any, freqScores: ScoreMap): PersonalityPercMap {
  const raw = toScoreMap(data?.personality_percentages);

  if (Object.keys(raw).length > 0) {
    return {
      FIRE: normalisePercent(raw.FIRE ?? raw.fire ?? raw.A ?? raw.a ?? 0),
      FLOW: normalisePercent(raw.FLOW ?? raw.flow ?? raw.B ?? raw.b ?? 0),
      FORM: normalisePercent(raw.FORM ?? raw.form ?? raw.C ?? raw.c ?? 0),
      FIELD: normalisePercent(raw.FIELD ?? raw.field ?? raw.D ?? raw.d ?? 0),
    };
  }

  return {
    FIRE: normalisePercent(freqScores.A ?? 0),
    FLOW: normalisePercent(freqScores.B ?? 0),
    FORM: normalisePercent(freqScores.C ?? 0),
    FIELD: normalisePercent(freqScores.D ?? 0),
  };
}

function getMindsetPercentages(data: any, profileScores: ScoreMap): MindsetPercMap {
  const raw = toScoreMap(data?.mindset_percentages);

  if (Object.keys(raw).length > 0) {
    return {
      ORIGIN: normalisePercent(raw.ORIGIN ?? raw.origin ?? 0),
      MOMENTUM: normalisePercent(raw.MOMENTUM ?? raw.momentum ?? 0),
      VECTOR: normalisePercent(raw.VECTOR ?? raw.vector ?? 0),
      ORBIT: normalisePercent(raw.ORBIT ?? raw.orbit ?? 0),
      QUANTUM: normalisePercent(raw.QUANTUM ?? raw.quantum ?? 0),
    };
  }

  return {
    ORIGIN: normalisePercent(
      profileScores.QSC_MINDSET_ORIGIN ?? profileScores.ORIGIN ?? 0,
    ),
    MOMENTUM: normalisePercent(
      profileScores.QSC_MINDSET_MOMENTUM ?? profileScores.MOMENTUM ?? 0,
    ),
    VECTOR: normalisePercent(
      profileScores.QSC_MINDSET_VECTOR ?? profileScores.VECTOR ?? 0,
    ),
    ORBIT: normalisePercent(
      profileScores.QSC_MINDSET_ORBIT ?? profileScores.ORBIT ?? 0,
    ),
    QUANTUM: normalisePercent(
      profileScores.QSC_MINDSET_QUANTUM ?? profileScores.QUANTUM ?? 0,
    ),
  };
}

function coercePersonality(value: unknown): PersonalityKey | null {
  const v = String(value || "").trim().toUpperCase();
  if (v === "FIRE" || v === "FLOW" || v === "FORM" || v === "FIELD") return v;
  return null;
}

function coerceMindset(value: unknown): MindsetKey | null {
  const v = String(value || "").trim().toUpperCase();
  if (
    v === "ORIGIN" ||
    v === "MOMENTUM" ||
    v === "VECTOR" ||
    v === "ORBIT" ||
    v === "QUANTUM"
  ) {
    return v;
  }
  return null;
}

function rankPersonalityKeys(map: PersonalityPercMap): PersonalityKey[] {
  return [...PERSONALITIES]
    .sort((a, b) => (map[b.key] ?? 0) - (map[a.key] ?? 0))
    .map((p) => p.key);
}

function rankMindsetKeys(map: MindsetPercMap): MindsetKey[] {
  return [...MINDSETS]
    .sort((a, b) => (map[b.key] ?? 0) - (map[a.key] ?? 0))
    .map((m) => m.key);
}

function getPrimarySecondaryPersonality(
  data: any,
  personalityPerc: PersonalityPercMap,
): { primary: PersonalityKey | null; secondary: PersonalityKey | null } {
  const ranked = rankPersonalityKeys(personalityPerc);
  return {
    primary: coercePersonality(data?.primary_personality) ?? ranked[0] ?? null,
    secondary: coercePersonality(data?.secondary_personality) ?? ranked[1] ?? null,
  };
}

function getPrimarySecondaryMindset(
  data: any,
  mindsetPerc: MindsetPercMap,
): { primary: MindsetKey | null; secondary: MindsetKey | null } {
  const ranked = rankMindsetKeys(mindsetPerc);
  return {
    primary: coerceMindset(data?.primary_mindset) ?? ranked[0] ?? null,
    secondary: coerceMindset(data?.secondary_mindset) ?? ranked[1] ?? null,
  };
}

function getCombinedTitle(
  data: any,
  primaryPersonality: PersonalityKey | null,
  primaryMindset: MindsetKey | null,
): string {
  if (data?.profile_label) return String(data.profile_label);
  if (data?.profile) return String(data.profile);

  const personalityLabel =
    PERSONALITIES.find((p) => p.key === primaryPersonality)?.label ?? "";
  const mindsetLabel = MINDSETS.find((m) => m.key === primaryMindset)?.label ?? "";

  return personalityLabel && mindsetLabel
    ? `${personalityLabel} ${mindsetLabel}`
    : "QSC Snapshot";
}

function getCombinedCode(
  data: any,
  primaryPersonality: PersonalityKey | null,
  primaryMindset: MindsetKey | null,
): string {
  if (data?.combined_profile_code) return String(data.combined_profile_code);

  const pCode = PERSONALITIES.find((p) => p.key === primaryPersonality)?.code ?? "";
  const mLevel = MINDSETS.find((m) => m.key === primaryMindset)?.level ?? "";

  return pCode && mLevel ? `${pCode}${mLevel}` : "—";
}

function classifyMatrixCell(
  row: MindsetKey,
  col: PersonalityKey,
  primaryPersonality: PersonalityKey | null,
  secondaryPersonality: PersonalityKey | null,
  primaryMindset: MindsetKey | null,
  secondaryMindset: MindsetKey | null,
): "primary" | "secondary" | "related" | "other" {
  if (col === primaryPersonality && row === primaryMindset) return "primary";

  const secondaryCombo =
    (col === secondaryPersonality && row === primaryMindset) ||
    (col === primaryPersonality && row === secondaryMindset) ||
    (col === secondaryPersonality && row === secondaryMindset);

  if (secondaryCombo) return "secondary";

  const related =
    col === primaryPersonality ||
    col === secondaryPersonality ||
    row === primaryMindset ||
    row === secondaryMindset;

  return related ? "related" : "other";
}

function matrixCellClass(cat: "primary" | "secondary" | "related" | "other"): string {
  switch (cat) {
    case "primary":
      return "border-sky-400 bg-sky-500 text-slate-50 shadow-xl shadow-sky-900/60";
    case "secondary":
      return "border-sky-400/80 bg-sky-500/15 text-slate-50 shadow-md shadow-sky-900/40";
    case "related":
      return "border-sky-400/40 bg-sky-500/5 text-slate-100";
    default:
      return "border-slate-700/60 bg-slate-900/70 text-slate-400";
  }
}

function prettifyQscKey(key: string): string {
  const upper = key.toUpperCase();

  const mindset = MINDSETS.find((m) => upper.includes(m.key));
  if (mindset) return mindset.label;

  const personality = PERSONALITIES.find((p) => upper.includes(p.key));
  if (personality) return personality.label;

  return key
    .replace(/^QSC_/, "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

type FrequencyDonutDatum = {
  key: PersonalityKey;
  label: string;
  value: number;
};

function FrequencyDonut({ data }: { data: FrequencyDonutDatum[] }) {
  const total = data.reduce((sum, d) => sum + (Number.isFinite(d.value) ? d.value : 0), 0) || 1;

  const radius = 60;
  const strokeWidth = 20;
  const center = 80;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  return (
    <svg viewBox="0 0 160 160" className="h-40 w-40 md:h-48 md:w-48" aria-hidden="true">
      <circle
        cx={center}
        cy={center}
        r={radius}
        stroke="rgba(15,23,42,0.9)"
        strokeWidth={strokeWidth}
        fill="transparent"
      />
      {data.map((d) => {
        const fraction = (Number.isFinite(d.value) ? d.value : 0) / total;
        const dash = circumference * fraction;
        const dashArray = `${dash} ${circumference}`;
        const strokeDashoffset = offset;
        offset -= dash;

        return (
          <circle
            key={d.key}
            cx={center}
            cy={center}
            r={radius}
            stroke={FREQUENCY_COLORS[d.key]}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={dashArray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        );
      })}

      <circle cx={center} cy={center} r={radius - strokeWidth} fill="#020617" />

      <text
        x={center}
        y={center - 4}
        textAnchor="middle"
        fill="#e5e7eb"
        style={{
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          fontSize: 10,
        }}
      >
        BUYER
      </text>
      <text
        x={center}
        y={center + 10}
        textAnchor="middle"
        fill="#e5e7eb"
        style={{
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          fontSize: 10,
        }}
      >
        FREQUENCY
      </text>
    </svg>
  );
}

function Bar({ pct }: { pct: number }) {
  const width = `${clampPct(pct)}%`;

  return (
    <div className="w-full h-2 rounded-full bg-slate-800/90 overflow-hidden">
      <div className="h-2 rounded-full bg-sky-500" style={{ width }} />
    </div>
  );
}

function BarList({
  title,
  entries,
}: {
  title: string;
  entries: Array<{ label: string; value: number; meta?: string }>;
}) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 md:p-7 shadow-lg shadow-black/40 text-slate-50">
      <h3 className="text-lg font-semibold">{title}</h3>

      <div className="mt-5 space-y-3">
        {entries.length === 0 ? (
          <div className="text-sm text-slate-400">No data available.</div>
        ) : null}

        {entries.map((entry) => (
          <div key={`${title}-${entry.label}-${entry.meta ?? ""}`} className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-xs">
              <div className="min-w-0">
                <div className="truncate font-medium text-slate-100">{entry.label}</div>
                {entry.meta ? (
                  <div className="truncate text-[11px] text-slate-400">{entry.meta}</div>
                ) : null}
              </div>
              <div className="shrink-0 text-slate-400">{percentLabel(entry.value)}</div>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-slate-800/90">
              <div
                className="h-full rounded-full bg-sky-500"
                style={{ width: `${clampPct(entry.value)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QscSnapshot({
  data,
  personalityPerc,
  mindsetPerc,
  primaryPersonality,
  secondaryPersonality,
  primaryMindset,
  secondaryMindset,
  profileScores,
}: {
  data: any;
  personalityPerc: PersonalityPercMap;
  mindsetPerc: MindsetPercMap;
  primaryPersonality: PersonalityKey | null;
  secondaryPersonality: PersonalityKey | null;
  primaryMindset: MindsetKey | null;
  secondaryMindset: MindsetKey | null;
  profileScores: ScoreMap;
}) {
  const combinedTitle = getCombinedTitle(data, primaryPersonality, primaryMindset);
  const combinedCode = getCombinedCode(data, primaryPersonality, primaryMindset);

  const createdAt =
    data?.created_at || data?.completed_at || data?.submitted_at
      ? new Date(data.created_at || data.completed_at || data.submitted_at)
      : null;

  const frequencyDonutData: FrequencyDonutDatum[] = PERSONALITIES.map((p) => ({
    key: p.key,
    label: p.label,
    value: normalisePercent(personalityPerc[p.key]),
  }));

  const profileMixEntries = Object.entries(profileScores)
    .map(([key, value]) => ({
      label: prettifyQscKey(key),
      value: normalisePercent(value),
      meta: key,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  return (
    <div className="space-y-8">
      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 md:p-7 shadow-xl shadow-black/50 text-slate-50">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300/90">
            QSC Snapshot
          </p>

          <h2 className="mt-3 text-2xl font-semibold">{combinedTitle}</h2>

          <p className="mt-1 text-xs text-slate-400">
            Code: <span className="font-mono text-slate-100">{combinedCode}</span>
          </p>

          <dl className="mt-5 grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">
                Primary personality
              </dt>
              <dd className="mt-0.5 font-medium">{primaryPersonality || "—"}</dd>
            </div>

            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">
                Secondary personality
              </dt>
              <dd className="mt-0.5 font-medium">{secondaryPersonality || "—"}</dd>
            </div>

            <div className="mt-2">
              <dt className="text-xs uppercase tracking-wide text-slate-400">
                Primary mindset
              </dt>
              <dd className="mt-0.5 font-medium">{primaryMindset || "—"}</dd>
            </div>

            <div className="mt-2">
              <dt className="text-xs uppercase tracking-wide text-slate-400">
                Secondary mindset
              </dt>
              <dd className="mt-0.5 font-medium">{secondaryMindset || "—"}</dd>
            </div>
          </dl>

          {createdAt ? (
            <p className="mt-5 text-xs text-slate-500">
              Created at{" "}
              {createdAt.toLocaleString(undefined, {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          ) : null}
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 md:p-7 shadow-lg shadow-black/40 text-slate-50">
          <h3 className="text-lg font-semibold">Buyer Frequency Type</h3>
          <p className="mt-1 text-sm text-slate-300">
            Emotional and energetic style across Fire, Flow, Form and Field.
          </p>

          <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center">
            <div className="flex justify-center">
              <FrequencyDonut data={frequencyDonutData} />
            </div>

            <div className="space-y-3 text-sm">
              {frequencyDonutData.map((d) => (
                <div key={d.key} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: FREQUENCY_COLORS[d.key] }}
                    />
                    <span className="font-medium text-slate-100">{d.label}</span>
                  </div>
                  <span className="text-sm text-slate-300">{percentLabel(d.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 md:p-7 shadow-lg shadow-black/40 text-slate-50">
          <h3 className="text-lg font-semibold">Buyer Mindset Levels</h3>
          <p className="mt-1 text-sm text-slate-300">
            Where they are in their current business or leadership journey.
          </p>

          <div className="mt-5 space-y-3">
            {MINDSETS.map((m) => {
              const pct = normalisePercent(mindsetPerc[m.key]);
              return (
                <div key={m.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-100">{m.label}</span>
                    <span className="text-slate-400">{percentLabel(pct)}</span>
                  </div>
                  <Bar pct={pct} />
                </div>
              );
            })}
          </div>
        </div>

        <BarList title="Profile Mix" entries={profileMixEntries} />
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 md:p-7 shadow-lg shadow-black/40 text-slate-50">
        <h3 className="text-lg font-semibold">Buyer Persona Matrix</h3>
        <p className="mt-1 text-sm text-slate-300">
          Visual intersection of buyer frequency type and buyer mindset level.
        </p>

        <div className="mt-5 overflow-x-auto">
          <div className="inline-grid grid-cols-[auto_repeat(4,minmax(140px,1fr))] gap-3 md:gap-4 items-stretch">
            <div />
            {PERSONALITIES.map((p) => (
              <div
                key={`head-${p.key}`}
                className="px-3 pb-1 pt-0.5 text-center text-xs font-semibold tracking-wide text-slate-300"
              >
                <div>{p.label}</div>
                <div className="text-[11px] text-slate-500">Frequency {p.code}</div>
              </div>
            ))}

            {MINDSETS.map((m) => (
              <div key={`row-${m.key}`} className="contents">
                <div className="flex flex-col justify-center text-xs font-medium text-slate-300 pr-2">
                  <span>{m.label}</span>
                  <span className="text-[11px] text-slate-500">Mindset {m.level}</span>
                </div>

                {PERSONALITIES.map((p) => {
                  const cat = classifyMatrixCell(
                    m.key,
                    p.key,
                    primaryPersonality,
                    secondaryPersonality,
                    primaryMindset,
                    secondaryMindset,
                  );

                  return (
                    <div
                      key={`${m.key}_${p.key}`}
                      className={[
                        "min-h-[96px] rounded-2xl border px-3 py-3 md:px-4 md:py-4 flex flex-col justify-between text-xs transition-colors",
                        matrixCellClass(cat),
                      ].join(" ")}
                    >
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.15em] mb-1">
                          {p.label} {m.label}
                        </div>
                        <div className="text-[11px] text-slate-300/90">
                          Code:{" "}
                          <span className="font-mono">
                            {p.code}
                            {m.level}
                          </span>
                        </div>
                      </div>

                      {cat === "primary" ? (
                        <div className="mt-2 text-[11px] font-medium text-slate-50">
                          Primary combined profile
                        </div>
                      ) : null}

                      {cat === "secondary" ? (
                        <div className="mt-2 text-[11px] font-medium text-slate-50/90">
                          Secondary / supporting profile
                        </div>
                      ) : null}

                      {cat === "related" ? (
                        <div className="mt-2 text-[11px] text-slate-200/85">
                          Related frequency or mindset
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function DetailSection({
  title,
  html,
}: {
  title: string;
  html: string;
}) {
  return (
    <div className="bg-white border rounded p-4">
      <div className="font-medium mb-2">{title}</div>
      <div
        className="prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: html || "<p>—</p>" }}
      />
    </div>
  );
}

export default async function TakerDetail({
  params,
}: {
  params: { takerId: string };
}) {
  try {
    const d = await getData(params.takerId);

    if (!d) {
      return (
        <div className="space-y-3 p-6 text-slate-700">
          <h1 className="text-xl font-semibold">Test Taker</h1>
          <p className="text-sm">No record was found for this test taker.</p>
        </div>
      );
    }

    const freqScores = toScoreMap(d?.freq_scores);
    const profileScores = toScoreMap(d?.profile_scores);
    const pieData = toFrequencyPieData(freqScores);
    const sections = safeSections(d?.sections);

    const qsc = isQscProfile(d, profileScores);

    const personalityPerc = getPersonalityPercentages(d, freqScores);
    const mindsetPerc = getMindsetPercentages(d, profileScores);

    const { primary: primaryPersonality, secondary: secondaryPersonality } =
      getPrimarySecondaryPersonality(d, personalityPerc);

    const { primary: primaryMindset, secondary: secondaryMindset } =
      getPrimarySecondaryMindset(d, mindsetPerc);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold">{d?.full_name ?? "Test Taker"}</h1>
          <div className="text-gray-600 text-sm">{d?.email ?? "—"}</div>
        </div>

        {qsc ? (
          <QscSnapshot
            data={d}
            personalityPerc={personalityPerc}
            mindsetPerc={mindsetPerc}
            primaryPersonality={primaryPersonality}
            secondaryPersonality={secondaryPersonality}
            primaryMindset={primaryMindset}
            secondaryMindset={secondaryMindset}
            profileScores={profileScores}
          />
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white border rounded p-4">
              <div className="font-medium mb-2">Frequency</div>
              <div className="text-sm mb-3">
                Top: <span className="font-semibold">{d?.frequency ?? "—"}</span>
              </div>
              <FrequencyPie data={pieData} />
            </div>

            <div className="bg-white border rounded p-4">
              <div className="font-medium mb-2">Profile</div>
              <div className="text-sm mb-3">
                Top: <span className="font-semibold">{d?.profile ?? "—"}</span>
              </div>
              <ProfileBar data={profileScores} />
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          <DetailSection
            title="Strengths"
            html={sections.strengths ?? "<p>—</p>"}
          />
          <DetailSection
            title="Challenges"
            html={sections.challenges ?? "<p>—</p>"}
          />
          <DetailSection
            title="Recommendations"
            html={sections.recommendations ?? "<p>—</p>"}
          />
        </div>
      </div>
    );
  } catch (err: any) {
    return (
      <div className="space-y-3 p-6 text-red-200">
        <h1 className="text-xl font-semibold">Taker page error</h1>
        <p className="text-sm">
          Something went wrong while loading this test taker profile.
        </p>
        <pre className="whitespace-pre-wrap rounded border border-red-700/40 bg-red-950/40 p-3 text-xs">
          {String(err?.message || err)}
        </pre>
        {err?.digest ? (
          <p className="text-xs text-red-300/80">Digest: {String(err.digest)}</p>
        ) : null}
      </div>
    );
  }
}