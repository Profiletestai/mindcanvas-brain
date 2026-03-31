// apps/web/app/portal/[slug]/database/[takerId]/page.tsx
export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import FrequencyPie from "@/components/charts/FrequencyPie";
import ProfileBar from "@/components/charts/ProfileBar";
import {
  QscMatrix,
  type PersonalityKey,
  type MindsetKey,
} from "@/app/qsc/QscMatrix";

type ScoreMap = Record<string, number>;

type FrequencyPieData = {
  A: number;
  B: number;
  C: number;
  D: number;
};

const PERSONALITY_META = {
  A: { name: "Fire", qscKey: "QSC_PERSONALITY_FIRE", uiKey: "FIRE" as PersonalityKey },
  B: { name: "Flow", qscKey: "QSC_PERSONALITY_FLOW", uiKey: "FLOW" as PersonalityKey },
  C: { name: "Form", qscKey: "QSC_PERSONALITY_FORM", uiKey: "FORM" as PersonalityKey },
  D: { name: "Field", qscKey: "QSC_PERSONALITY_FIELD", uiKey: "FIELD" as PersonalityKey },
} as const;

const MINDSET_META = {
  ORIGIN: {
    name: "Origin",
    level: 1,
    qscKey: "QSC_MINDSET_ORIGIN",
    uiKey: "ORIGIN" as MindsetKey,
  },
  MOMENTUM: {
    name: "Momentum",
    level: 2,
    qscKey: "QSC_MINDSET_MOMENTUM",
    uiKey: "MOMENTUM" as MindsetKey,
  },
  VECTOR: {
    name: "Vector",
    level: 3,
    qscKey: "QSC_MINDSET_VECTOR",
    uiKey: "VECTOR" as MindsetKey,
  },
  ORBIT: {
    name: "Orbit",
    level: 4,
    qscKey: "QSC_MINDSET_ORBIT",
    uiKey: "ORBIT" as MindsetKey,
  },
  QUANTUM: {
    name: "Quantum",
    level: 5,
    qscKey: "QSC_MINDSET_QUANTUM",
    uiKey: "QUANTUM" as MindsetKey,
  },
} as const;

const FREQUENCY_CODES = ["A", "B", "C", "D"] as const;

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

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function sortScoreEntries(map: ScoreMap): Array<[string, number]> {
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

function isQscProfile(profileScores: ScoreMap): boolean {
  return Object.keys(profileScores).some((k) => k.toUpperCase().startsWith("QSC_"));
}

function getTopTwoPersonalities(freqScores: ScoreMap): PersonalityKey[] {
  return FREQUENCY_CODES.map((code) => ({
    code,
    value: freqScores[code] ?? 0,
  }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 2)
    .map((item) => PERSONALITY_META[item.code].uiKey);
}

function getTopTwoMindsets(profileScores: ScoreMap): MindsetKey[] {
  return Object.values(MINDSET_META)
    .map((meta) => ({
      uiKey: meta.uiKey,
      value: profileScores[meta.qscKey] ?? 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 2)
    .map((item) => item.uiKey);
}

function getCombinedTitle(
  primaryPersonality: PersonalityKey | null,
  primaryMindset: MindsetKey | null,
): string {
  if (!primaryPersonality || !primaryMindset) return "QSC Snapshot";

  const personalityName =
    Object.values(PERSONALITY_META).find((p) => p.uiKey === primaryPersonality)?.name ?? "";
  const mindsetName =
    Object.values(MINDSET_META).find((m) => m.uiKey === primaryMindset)?.name ?? "";

  if (!personalityName || !mindsetName) return "QSC Snapshot";
  return `${personalityName} ${mindsetName}`;
}

function getCombinedCode(
  primaryPersonality: PersonalityKey | null,
  primaryMindset: MindsetKey | null,
): string | null {
  if (!primaryPersonality || !primaryMindset) return null;

  const personalityCode =
    Object.entries(PERSONALITY_META).find(([, value]) => value.uiKey === primaryPersonality)?.[0] ??
    null;

  const mindsetLevel =
    Object.values(MINDSET_META).find((value) => value.uiKey === primaryMindset)?.level ?? null;

  if (!personalityCode || !mindsetLevel) return null;
  return `${personalityCode}${mindsetLevel}`;
}

function formatFrequencyLabel(code: string): string {
  const upper = code.toUpperCase() as keyof typeof PERSONALITY_META;
  const meta = PERSONALITY_META[upper];
  if (!meta) return code;
  return `${upper} (${meta.name})`;
}

function formatQscScoreLabel(key: string): {
  label: string;
  category: "Mindset" | "Personality" | "Other";
  raw: string;
} {
  const upper = key.toUpperCase();

  for (const meta of Object.values(MINDSET_META)) {
    if (upper === meta.qscKey) {
      return {
        label: meta.name,
        category: "Mindset",
        raw: key,
      };
    }
  }

  for (const meta of Object.values(PERSONALITY_META)) {
    if (upper === meta.qscKey) {
      return {
        label: meta.name,
        category: "Personality",
        raw: key,
      };
    }
  }

  return {
    label: key,
    category: "Other",
    raw: key,
  };
}

function BarList({
  title,
  entries,
  valueFormatter = (n: number) => `${Math.round(n)}%`,
}: {
  title: string;
  entries: Array<{ label: string; value: number; meta?: string }>;
  valueFormatter?: (n: number) => string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 text-sm font-semibold text-slate-900">{title}</div>

      <div className="space-y-3">
        {entries.length === 0 ? (
          <div className="text-sm text-slate-500">No data available.</div>
        ) : null}

        {entries.map((entry) => (
          <div key={`${title}-${entry.label}-${entry.meta ?? ""}`} className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-xs">
              <div className="min-w-0">
                <div className="truncate font-medium text-slate-700">{entry.label}</div>
                {entry.meta ? (
                  <div className="truncate text-[11px] text-slate-400">{entry.meta}</div>
                ) : null}
              </div>
              <div className="shrink-0 font-semibold text-slate-500">
                {valueFormatter(entry.value)}
              </div>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-blue-500"
                style={{ width: `${clampPct(entry.value)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QscTopCards({
  topEntries,
}: {
  topEntries: Array<[string, number]>;
}) {
  const cardTitles = ["Primary", "Secondary", "Tertiary"];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cardTitles.map((cardTitle, idx) => {
        const item = topEntries[idx];
        const info = item ? formatQscScoreLabel(item[0]) : null;
        const value = item?.[1] ?? 0;

        return (
          <div
            key={cardTitle}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              {cardTitle}
            </div>

            <div className="mt-3 text-lg font-semibold text-slate-900">
              {info?.label ?? "—"}
            </div>

            <div className="mt-1 text-xs text-slate-500">
              {info?.category ?? "—"}
            </div>

            <div className="mt-3 text-sm font-medium text-slate-700">
              {Math.round(value)}% match
            </div>

            <div className="mt-1 text-[11px] text-slate-400">
              {info?.raw ?? "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function QscSnapshot({ data }: { data: any }) {
  const freqScores = toScoreMap(data?.freq_scores);
  const profileScores = toScoreMap(data?.profile_scores);

  const [primaryPersonality, secondaryPersonality] = getTopTwoPersonalities(freqScores);
  const [primaryMindset, secondaryMindset] = getTopTwoMindsets(profileScores);

  const combinedTitle = getCombinedTitle(primaryPersonality ?? null, primaryMindset ?? null);
  const combinedCode = getCombinedCode(primaryPersonality ?? null, primaryMindset ?? null);

  const frequencyEntries = FREQUENCY_CODES.map((code) => ({
    label: formatFrequencyLabel(code),
    value: freqScores[code] ?? 0,
  }));

  const profileEntries = sortScoreEntries(profileScores)
    .slice(0, 8)
    .map(([key, value]) => {
      const info = formatQscScoreLabel(key);
      return {
        label: info.label,
        meta: `${info.category} · ${info.raw}`,
        value,
      };
    });

  const topThree = sortScoreEntries(profileScores).slice(0, 3);

  const personalityPercentages: Partial<Record<PersonalityKey, number>> = {
    FIRE: freqScores.A ?? 0,
    FLOW: freqScores.B ?? 0,
    FORM: freqScores.C ?? 0,
    FIELD: freqScores.D ?? 0,
  };

  const mindsetPercentages: Partial<Record<MindsetKey, number>> = {
    ORIGIN: profileScores.QSC_MINDSET_ORIGIN ?? 0,
    MOMENTUM: profileScores.QSC_MINDSET_MOMENTUM ?? 0,
    VECTOR: profileScores.QSC_MINDSET_VECTOR ?? 0,
    ORBIT: profileScores.QSC_MINDSET_ORBIT ?? 0,
    QUANTUM: profileScores.QSC_MINDSET_QUANTUM ?? 0,
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              QSC Snapshot
            </div>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">
              {combinedTitle}
            </h2>
            <div className="mt-1 text-sm text-slate-600">
              {combinedCode ? `Combined code: ${combinedCode}` : "Combined code unavailable"}
            </div>
          </div>

          <div className="text-sm text-slate-600">
            Personality:{" "}
            <span className="font-semibold text-slate-900">
              {primaryPersonality
                ? Object.values(PERSONALITY_META).find(
                    (p) => p.uiKey === primaryPersonality,
                  )?.name ?? "—"
                : "—"}
            </span>
            {" · "}
            Mindset:{" "}
            <span className="font-semibold text-slate-900">
              {primaryMindset
                ? Object.values(MINDSET_META).find((m) => m.uiKey === primaryMindset)?.name ?? "—"
                : "—"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
        <QscMatrix
          primaryPersonality={primaryPersonality ?? null}
          secondaryPersonality={secondaryPersonality ?? null}
          primaryMindset={primaryMindset ?? null}
          secondaryMindset={secondaryMindset ?? null}
          personalityPercentages={personalityPercentages}
          mindsetPercentages={mindsetPercentages}
        />

        <div className="space-y-6">
          <BarList title="Frequency mix" entries={frequencyEntries} />
          <BarList title="Profile mix" entries={profileEntries} />
        </div>
      </div>

      <QscTopCards topEntries={topThree} />
    </div>
  );
}

export default async function TakerDetail({
  params,
}: {
  params: { takerId: string };
}) {
  const d = await getData(params.takerId);

  const freqScores = toScoreMap(d?.freq_scores);
  const profileScores = toScoreMap(d?.profile_scores);
  const pieData = toFrequencyPieData(freqScores);
  const qsc = isQscProfile(profileScores);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{d?.full_name ?? "Test Taker"}</h1>
        <div className="text-gray-600 text-sm">{d?.email}</div>
      </div>

      {qsc ? (
        <QscSnapshot data={d} />
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
        <div className="bg-white border rounded p-4">
          <div className="font-medium mb-2">Strengths</div>
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{
              __html: d?.sections?.strengths ?? "<p>—</p>",
            }}
          />
        </div>

        <div className="bg-white border rounded p-4">
          <div className="font-medium mb-2">Challenges</div>
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{
              __html: d?.sections?.challenges ?? "<p>—</p>",
            }}
          />
        </div>

        <div className="bg-white border rounded p-4">
          <div className="font-medium mb-2">Recommendations</div>
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{
              __html: d?.sections?.recommendations ?? "<p>—</p>",
            }}
          />
        </div>
      </div>
    </div>
  );
}
