"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, isErr } from "../_lib/api";
import { BILLING_PATH, ORGANISATION_PATH } from "../_lib/progress";
import {
  ENGINES,
  ENGINE_LIST,
  TRIAL_TESTS_PER_ENGINE,
  dedupeEngines,
  engineListLabel,
  isTierAllowed,
  normalizeEngines,
  recommendedTier,
  totalTrialTests,
  trialAllocation,
  type EngineKey,
} from "../_lib/engines";
import { StepCard } from "../_components/StepCard";
import { EngineCard } from "./EngineCard";
import { TierCard, type TierCardData } from "./TierCard";


// Figma screen 3 accent — engine pills in the summary rail.
const ACCENT = "rgb(84,175,224)";
const RAIL_LABEL = "rgba(230,240,250,0.62)";
const RAIL_VALUE = "rgb(234,242,251)";

// Rail copy from the Figma summary card — longer than the terse tier-card
// taglines, keyed by the plan name coming out of PLAN_CARDS.
const RAIL_TAGLINE: Record<string, string> = {
  Starter: "For independent consultants and coaches ready to sell smarter.",
  Pro: "For growing service businesses scaling their sales and delivery.",
  Niche: "For niche experts building authority and licensing their IP.",
};

function formatUsd(cents: number): string {
  const major = cents / 100;
  return `$${Number.isInteger(major) ? major : major.toFixed(2)}`;
}

export function PlanClient({ cards }: { cards: TierCardData[] }) {
  const router = useRouter();
  const [engines, setEngines] = useState<EngineKey[]>([]);
  const [tier, setTier] = useState<number | null>(null);
  // Distinguishes "we picked the recommended tier for you" from "the client
  // clicked a tier" — the rail wording differs, the saved value does not.
  const [tierPickedByUser, setTierPickedByUser] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  // Which call-to-action is in flight, so both buttons lock and only the
  // pressed one shows its progress label.
  const [pending, setPending] = useState<null | "subscribe" | "skip">(null);

  // Restore a previous visit's selection so it survives refresh / sign-out.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await api.getPlanSelection();
      if (cancelled) return;
      if (!isErr(res) && res.selection) {
        setEngines(normalizeEngines(res.selection.engines));
        setTier(res.selection.tier);
        setTierPickedByUser(true);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const count = engines.length;
  const minTier = recommendedTier(count);

  const toggleEngine = (key: EngineKey) => {
    setError("");
    const adding = !engines.includes(key);
    // Selection order, not catalogue order — the rail lists engines in the
    // order they were picked. normalizeEngines runs only on the way out.
    const next = adding
      ? dedupeEngines([...engines, key])
      : engines.filter((k) => k !== key);
    setEngines(next);

    if (next.length === 0) {
      setTier(null);
      setTierPickedByUser(false);
      setNotice("");
      return;
    }

    // A tier is always explicitly selected: the recommendation is applied for
    // the client whenever their current pick is missing or no longer valid.
    if (tier === null || !isTierAllowed(tier, next.length)) {
      const replaced = tier !== null;
      setTier(recommendedTier(next.length));
      setTierPickedByUser(false);
      setNotice(
        replaced
          ? "Your subscription recommendation has changed because you selected an additional engine."
          : ""
      );
    } else {
      setNotice("");
    }
  };

  const selectTier = (t: number) => {
    if (!isTierAllowed(t, count)) return;
    setError("");
    setNotice("");
    setTier(t);
    setTierPickedByUser(true);
  };

  const canContinue = count > 0 && tier !== null && pending === null;

  // Persist the engine/tier pick before either path leaves this screen. The
  // backend re-derives the minimum tier and the trial allocation from it.
  async function saveSelection(): Promise<boolean> {
    if (tier === null) return false;
    const res = await api.savePlanSelection({
      engines: normalizeEngines(engines),
      tier,
    });
    if (isErr(res)) {
      setError(res.error);
      return false;
    }
    return true;
  }

  // Primary CTA: hand off to the billing screen, which starts Stripe checkout.
  async function onSubscribe() {
    if (!canContinue) return;
    setPending("subscribe");
    setError("");
    if (!(await saveSelection())) {
      setPending(null);
      return;
    }
    router.push(BILLING_PATH);
  }

  // Secondary CTA: skip payment. skipBilling creates the org, which grants the
  // per-engine free trial tests, then onboarding continues at the org step.
  async function onSkip() {
    if (!canContinue) return;
    setPending("skip");
    setError("");
    if (!(await saveSelection())) {
      setPending(null);
      return;
    }
    const res = await api.skipBilling();
    if (isErr(res)) {
      setError(res.error);
      setPending(null);
      return;
    }
    router.push(ORGANISATION_PATH);
  }

  if (loading) {
    return <div className="py-8 text-center text-white/70">Loading…</div>;
  }

  const trials = trialAllocation(engines);
  // The rail previews the plan the client is heading for: their pick if they
  // made one, otherwise the recommended minimum for the engine count.
  const recommendedCard = cards.find((c) => c.tier === minTier);
  const activeCard = cards.find((c) => c.tier === tier) ?? recommendedCard;
  const planName = activeCard?.name ?? "";
  const planTagline = activeCard
    ? (RAIL_TAGLINE[activeCard.name] ?? activeCard.tagline)
    : "";
  const recommendedName = recommendedCard?.name ?? `Tier ${minTier}`;
  const planPrice = activeCard ? formatUsd(activeCard.amountCents) : "";

  return (
    <StepCard
      width="100%"
      minHeight="auto"
      titleNoWrap={false}
      className="lg:px-[80px] lg:pt-[31px]"
      title={
        <>
          Choose your <span style={{ color: ACCENT }}>MindCanvas</span> engines
        </>
      }
      subtitle={
        <span className="mx-auto block max-w-[578px]">
          Select the solutions you would like to use in your organisation. You
          can choose one engine or combine multiple engines as your organisation
          grows.
        </span>
      }
    >
      <div className="mt-10 grid gap-[18px] md:grid-cols-2 lg:grid-cols-3">
        {ENGINE_LIST.map((engine) => (
          <EngineCard
            key={engine.key}
            engine={engine}
            selected={engines.includes(engine.key)}
            onToggle={() => toggleEngine(engine.key)}
          />
        ))}
      </div>

      <div className="mt-12 flex flex-col gap-[26px] lg:flex-row lg:items-start">
        <section className="lg:flex-1">
          <p
            className="text-[17.6px] font-semibold leading-[21px]"
            style={{ color: "rgb(234,242,251)" }}
          >
            Recommended for your engine selection
          </p>

          {notice && (
            <p
              role="status"
              className="mt-3 rounded-[8px] border px-[13px] py-[10px] text-[12.65px] leading-[20px]"
              style={{
                background: "rgba(84,175,224,0.10)",
                borderColor: "rgba(84,175,224,0.35)",
                color: "rgb(234,242,251)",
              }}
            >
              {notice}
            </p>
          )}

          <div className="mt-6 grid gap-[15px] md:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <TierCard
                key={card.tier}
                card={card}
                selected={tier === card.tier}
                recommended={count > 0 && card.tier === minTier}
                disabled={count > 0 && !isTierAllowed(card.tier, count)}
                onSelect={() => selectTier(card.tier)}
              />
            ))}
          </div>
        </section>

        <aside className="w-full lg:w-[352px] lg:shrink-0">
          <div
            className="rounded-[10px] border border-white/[0.09] p-[25px]"
            style={{ background: "rgb(15,32,53)" }}
          >
            {count === 0 ? (
              <p
                className="text-center text-[13px] leading-[20px]"
                style={{ color: "rgba(210,225,245,0.38)" }}
              >
                Select at least one engine to see your plan.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-[7px]">
                  {engines.map((key) => (
                    <span
                      key={key}
                      className="rounded-full px-[10px] py-[4px] text-[10px] font-bold uppercase leading-[12px]"
                      style={{
                        background: "rgba(84,175,224,0.10)",
                        color: ACCENT,
                      }}
                    >
                      {ENGINES[key].name}
                    </span>
                  ))}
                </div>

                <div className="mt-[10px] flex items-baseline justify-between gap-3">
                  <p
                    className="text-[18.7px] font-semibold leading-[23px]"
                    style={{ color: "rgb(234,242,251)" }}
                  >
                    MindCanvas {planName}
                  </p>
                  <p className="flex shrink-0 items-baseline gap-[2px]">
                    <span
                      className="text-[22px] font-bold leading-[27px]"
                      style={{ color: "rgb(234,242,251)" }}
                    >
                      {planPrice}
                    </span>
                    <span
                      className="text-[12.1px] leading-[15px]"
                      style={{ color: "rgba(210,225,245,0.38)" }}
                    >
                      /mo
                    </span>
                  </p>
                </div>
                <p
                  className="mt-[6px] text-[12.65px] leading-[20px]"
                  style={{ color: "rgba(230,240,250,0.62)" }}
                >
                  {planTagline}
                </p>

                <div
                  className="mt-[16px] h-px"
                  style={{ background: "rgba(255,255,255,0.09)" }}
                />

                {/* Label muted, value bright — the Figma rail highlights the
                    part of each line that depends on the selection. */}
                <p
                  className="mt-[16px] text-[13px] leading-[20px]"
                  style={{ color: RAIL_LABEL }}
                >
                  You selected {count} {count === 1 ? "engine" : "engines"}:{" "}
                  <span style={{ color: RAIL_VALUE }}>
                    {engineListLabel(engines)}
                  </span>
                </p>
                <p
                  className="mt-[6px] text-[13px] leading-[20px]"
                  style={{ color: RAIL_LABEL }}
                >
                  {tierPickedByUser ? "Selected" : "Recommended"} subscription:{" "}
                  <span style={{ color: RAIL_VALUE }}>
                    {tierPickedByUser ? planName : recommendedName} Plan
                  </span>
                </p>
                <p
                  className="mt-[4px] text-[13px] leading-[20px]"
                  style={{ color: RAIL_LABEL }}
                >
                  Included trial usage:{" "}
                  <span style={{ color: RAIL_VALUE }}>
                    {totalTrialTests(engines)} tests
                  </span>
                </p>

                <div className="mt-[10px] flex flex-wrap gap-[7px]">
                  {trials.map((t) => (
                    <span
                      key={t.engine}
                      className="rounded-full border px-[10px] py-[5px] text-[10.5px] font-semibold uppercase leading-[13px]"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        borderColor: "rgba(255,255,255,0.09)",
                        color: "rgba(230,240,250,0.62)",
                      }}
                    >
                      {t.product}: {TRIAL_TESTS_PER_ENGINE} trial tests
                    </span>
                  ))}
                </div>
              </>
            )}

            {error && (
              <p className="mt-4 text-[13px] leading-[20px] text-rose-400">
                {error}
              </p>
            )}

            {/* Before any engine is picked the rail is just the hint — the
                design has no call to action in that state. */}
            {count > 0 && (
              <>
                {/* Primary: subscribe now → Stripe checkout (via billing). */}
                <button
                  type="button"
                  onClick={onSubscribe}
                  disabled={!canContinue}
                  className={`mt-[22px] flex h-[52px] w-full items-center justify-center gap-[10px] rounded-[12px] text-[15px] font-bold tracking-[0.2px] text-white transition ${
                    canContinue
                      ? "cursor-pointer hover:brightness-105"
                      : "cursor-not-allowed opacity-40"
                  }`}
                  style={{ background: "rgb(107,178,222)" }}
                >
                  {pending === "subscribe" ? (
                    "Redirecting…"
                  ) : (
                    <>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#fff"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M5 12.5l4.5 4.5L19 7" />
                      </svg>
                      <span>Subscribe to {planName}</span>
                      <span
                        className="rounded-full px-[11px] py-[3px] text-[13px] font-semibold"
                        style={{ background: "rgba(255,255,255,0.24)" }}
                      >
                        {planPrice}/mo
                      </span>
                    </>
                  )}
                </button>

                {/* Secondary: skip payment, keep the free trial tests. */}
                <button
                  type="button"
                  onClick={onSkip}
                  disabled={!canContinue}
                  className={`mt-[12px] flex h-[52px] w-full items-center justify-center rounded-[12px] border text-[15px] font-medium text-white transition ${
                    canContinue
                      ? "cursor-pointer hover:bg-white/[0.06]"
                      : "cursor-not-allowed opacity-40"
                  }`}
                  style={{ borderColor: "rgba(255,255,255,0.35)" }}
                >
                  {pending === "skip"
                    ? "Setting up…"
                    : "Skip for now — start with my free tests"}
                </button>

                <p
                  className="mt-[11px] text-center text-[11.55px] leading-[18px]"
                  style={{ color: "rgba(210,225,245,0.38)" }}
                >
                  At least one engine and a supported tier are required to
                  continue.
                </p>
              </>
            )}
          </div>
        </aside>
      </div>
    </StepCard>
  );
}
