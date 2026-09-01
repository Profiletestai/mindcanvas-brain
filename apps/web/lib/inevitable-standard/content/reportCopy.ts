import type { InevitableStandardPillar } from "../definition";

/* -------------------------------------------------------------------------- */
/* The Inevitable Standard — report copy content layer                         */
/* -------------------------------------------------------------------------- */
/*
 * This module is DATA, not logic. It holds the report-facing prose for each
 * pillar, keyed by band and then by section. The scoring/constraint engines do
 * not read it; only the report components do.
 *
 * `text` is customer-ready prose ONLY — it must read as if a founder is reading
 * it directly, with no citations ("Ch5"), no meta-commentary ("the book
 * assumes…"), and no direct/applied labelling. All of that lives in `provenance`
 * and `note`, which are never rendered.
 *
 * Source, sourcing standard and update rules: see ./README.md
 */

/** Fixed section set for a pillar chapter. Not every pillar/band fills all of them. */
export const INEVITABLE_STANDARD_CONTENT_SECTIONS = [
  "snapshot_line",
  "what_this_means",
  "what_appears_working",
  "where_leaking",
  "pathway_impact",
  "focus_now",
  "what_to_watch",
  "progress_looks_like",
] as const;

export type InevitableStandardContentSection =
  (typeof INEVITABLE_STANDARD_CONTENT_SECTIONS)[number];

/**
 * Band keys mirror the report's Green / Amber / Red vocabulary. The score model
 * keys the same three states as low_risk / medium_risk / high_risk; the report
 * already maps risk -> band via garForRisk(), so content is keyed by band here.
 */
export const INEVITABLE_STANDARD_CONTENT_BANDS = ["red", "amber", "green"] as const;

export type InevitableStandardContentBand =
  (typeof INEVITABLE_STANDARD_CONTENT_BANDS)[number];

/**
 * How a line traces back to the Knowledge Base document:
 * - "direct"  — a close paraphrase of an actual passage
 * - "applied" — the book's own reasoning, extended to a case it does not narrate
 *               directly (e.g. a partial/Amber state), where the logic clearly
 *               carries over
 *
 * Nothing is added outside these two categories. See ./README.md.
 */
export type InevitableStandardContentProvenance = "direct" | "applied";

export type InevitableStandardContentEntry = {
  /**
   * Report-facing copy. Customer-ready prose only — no source-document
   * references, citations, or meta-commentary.
   */
  text: string;
  provenance: InevitableStandardContentProvenance;
  /**
   * Sourcing note: the passage cited, or the rationale for an "applied" line.
   * Preserved for auditability against the source document. Never rendered.
   */
  note?: string;
};

export type InevitableStandardPillarBandContent = Partial<
  Record<InevitableStandardContentSection, InevitableStandardContentEntry>
>;

export type InevitableStandardPillarContent = {
  /**
   * "complete"    — every section is grounded in the source to the same standard
   * "provisional" — known coverage gap; treat entries as placeholders
   */
  status: "complete" | "provisional";
  /** Explains a "provisional" status. Not rendered. */
  note?: string;
  bands: Partial<
    Record<InevitableStandardContentBand, InevitableStandardPillarBandContent>
  >;
};

export type InevitableStandardReportContent = {
  /** Link back to the source document, for anyone revising this content. */
  source_version: string;
  /** The standard every line in this file must meet. */
  authoring_standard: string;
  pillars: Record<InevitableStandardPillar, InevitableStandardPillarContent>;
};

export const INEVITABLE_STANDARD_REPORT_CONTENT: InevitableStandardReportContent = {
  source_version: "The Inevitable Standard - Knowledge Base v1, 6 August 2026",
  authoring_standard:
    "Every line is drawn from the source document above under a direct-quote-or-labeled-application standard: either a close paraphrase of an actual passage (provenance \"direct\"), or the book's own reasoning extended to a case it does not narrate directly (provenance \"applied\"). Nothing is invented outside those two categories. `text` carries customer-ready prose only; citations and rationale live in `note`. Positioning is intentionally incomplete pending further source material from Genene.",

  pillars: {
    identity: {
      status: "complete",
      bands: {
        amber: {
          snapshot_line: {
            text: "What happens in the room when the price is actually on the table.",
            provenance: "applied",
            note: "Compresses Ch2's core subject (\"her relationship with the act of selling\") into a snapshot-length line.",
          },
          what_this_means: {
            text: "People rarely fail to convert because they can't sell. They fail because, somewhere beneath her own awareness, the founder has decided she isn't allowed to.",
            provenance: "direct",
          },
          what_appears_working: {
            text: "The founder is not avoiding the sale outright; the avoidance shows up selectively, under specific pressure, not as a blanket pattern.",
            provenance: "applied",
            note: "The source does not narrate a partial-strength (Amber) state directly, but its three-layer logic (Ch3) implies willingness is present often enough that revenue is inconsistent rather than stalled.",
          },
          where_leaking: {
            text: "The quiet architecture of avoidance: over-explaining rather than asking, prices drifting downward before anyone objects, waiting for the right people to simply arrive ready to buy. Each looks like diligence. Each is a way of staying out of the one moment that produces revenue.",
            provenance: "direct",
          },
          pathway_impact: {
            text: "A business is a system, only as strong as its weakest link. Effort poured into a strong link while identity is the actual constraint moves almost nothing, because the system can only move as much as its narrowest point allows.",
            provenance: "direct",
            note: "The source's binding-constraint logic.",
          },
          focus_now: {
            text: "Confidence sits downstream of action, not the other way around. State the real price once, and let the silence sit. Do it ten times and the correction sets.",
            provenance: "direct",
          },
          what_to_watch: {
            text: "The reflex, not the mood — discounting before anyone has asked, or explaining a price instead of stating it.",
            provenance: "direct",
          },
          progress_looks_like: {
            text: "A real price, held without the pre-emptive discount, across a defined number of real conversations.",
            provenance: "applied",
            note: "The source gives no day-count; its method (Ch4: repeated, witnessed action updates identity) implies a concrete, countable target rather than a vague intention.",
          },
        },
        green: {
          what_this_means: {
            text: "When identity is strong, it's very unlikely to be the primary constraint. Where it still shows up as worth attention, that's a maintenance note, not an urgent one.",
            provenance: "applied",
            note: "The source's Ch3 binding-constraint logic implies strong identity is very unlikely to be the binding constraint.",
          },
          what_appears_working: {
            text: "A strong result absorbs weakness elsewhere.",
            provenance: "applied",
            note: "A direct extension of the binding-constraint logic — a strong link can mask a weak one elsewhere by carrying more than its share. Applied inference, not a quote.",
          },
          where_leaking: {
            text: "A standard is a decision held regardless of how one day feels.",
            provenance: "direct",
            note: "At Green the source does not describe a leak; this section points forward instead — what holding the standard protects. Direct quote, Ch9.",
          },
        },
      },
    },

    positioning: {
      status: "provisional",
      note: "The Knowledge Base has no dedicated treatment of market positioning as a topic distinct from offer packaging (Ch5). Every entry below is [applied, weak] and should be treated as a placeholder, not a finished chapter. Rebuild once Genene has supplied direct source material for this pillar. Sections intentionally left blank: snapshot_line, what_appears_working, pathway_impact, what_to_watch, progress_looks_like.",
      bands: {
        amber: {
          what_this_means: {
            text: "A named, packaged offer only does its work if the right people recognize themselves in it.",
            provenance: "applied",
            note: "[applied, weak] — book coverage gap. Ch5 (\"sell a product, not an afternoon\") assumes this rather than arguing it directly.",
          },
          where_leaking: {
            text: "If the offer is hard to explain in a single sentence, or attracts a wide, undifferentiated range of enquiries, the packaging — and likely the pricing — isn't yet doing the work of pre-qualifying who it's for.",
            provenance: "applied",
            note: "[applied, weak] — book coverage gap. Extends the source's broader \"sell a product, not an afternoon\" logic (Ch5).",
          },
          focus_now: {
            text: "State plainly who the work is for and why. Give the market description edges the same way a strong offer has them: a name, a promise, a described outcome.",
            provenance: "applied",
            note: "[applied, weak] — book coverage gap. Extends the source's \"give it edges\" instinct for offers (Ch5) to the market description itself.",
          },
        },
      },
    },

    offer: {
      status: "complete",
      bands: {
        amber: {
          what_this_means: {
            text: "Most founders sell what they do — the session, the hour, the service — priced by the unit of time. This is the first and most expensive structural mistake: it turns a founder into a commodity measured in hours, with a ceiling on both the price and the volume.",
            provenance: "direct",
          },
          what_appears_working: {
            text: "At this level, some packaging exists — the work isn't being sold as pure raw time — but the offer likely still lacks a full shape: a defined product with a name, a promise, and a clear outcome the client can picture.",
            provenance: "applied",
            note: "The source (Ch5) describes the full offer shape as a named product with a promise and a clear outcome; extended here to a partial/Amber state.",
          },
          where_leaking: {
            text: "A single offer at a single price forces every prospect into the same yes or no. It turns away the person who'd have started smaller, and caps the person who'd happily pay for more. Without a ladder — entry, core, premium — revenue per client has a ceiling the founder built herself.",
            provenance: "direct",
          },
          pathway_impact: {
            text: "An irresistible offer that carries no margin isn't a triumph — it's a busier way to earn nothing. The offer determines what everything downstream (structure, pricing, path) actually has to work with.",
            provenance: "direct",
          },
          focus_now: {
            text: "Give the work edges: name it, state what it delivers, describe the outcome the client walks away with. Then build three rungs, not seven — past a certain point, more options stop helping a buyer choose and start freezing her.",
            provenance: "direct",
          },
          what_to_watch: {
            text: "Too many tiers freeze a buyer rather than helping her choose. If new options are being added without a clear promise for each, that's the pattern to watch for.",
            provenance: "applied",
            note: "The source's caution on ladders — past a point, more tiers freeze rather than help.",
          },
          progress_looks_like: {
            text: "Revenue per client roughly triples within two quarters once a named offer and a three-rung ladder exist — a reasonable target shape, not a specific number to promise.",
            provenance: "applied",
            note: "The source's example (the \"studio that stopped selling hours,\" Ch5) shows revenue per client roughly tripling within two quarters after a named offer and three-rung ladder existed.",
          },
        },
      },
    },

    sales: {
      status: "complete",
      bands: {
        amber: {
          what_this_means: {
            text: "Between a founder and a prospect sits a short conversation, and in that conversation the entire model either becomes a client or dissolves into a polite maybe. This pillar is where identity, structure and execution meet under real pressure.",
            provenance: "direct",
          },
          what_appears_working: {
            text: "Conversations are happening and some convert — the pillar isn't at zero — but the question is whether the same outcome happens without the founder specifically in the room, or whether conversion is tied to her personal presence each time.",
            provenance: "applied",
            note: "The source's own diagnostic question about founder-dependence (Ch6).",
          },
          where_leaking: {
            text: "An unresolved \"maybe\" is the most expensive outcome in a sales conversation — it costs the prospect clarity and costs the founder the ability to plan, filling the pipeline with people who aren't moving anywhere.",
            provenance: "direct",
          },
          pathway_impact: {
            text: "A no closes cleanly and lets both people move on. A yes begins the work. A maybe is the only outcome that helps no one — and it's usually what an unstructured conversation defaults to.",
            provenance: "direct",
          },
          focus_now: {
            text: "Work the PROSPER structure: Permission, Reframe, Ownership, Structure, Power Questions, Embodiment, Result — seven parts, held in order. In particular: ask more, pitch less — the top-performing sellers spend noticeably more of the conversation listening. A conclusion the buyer reaches herself holds; one she's handed doesn't.",
            provenance: "direct",
            note: "The source's PROSPER framework (Ch7).",
          },
          what_to_watch: {
            text: "Decision drift: revenue momentum quietly slowed by decisions revisited, delayed or avoided, while the calendar stays busy. It feels like diligence from the inside.",
            provenance: "applied",
            note: "\"Decision drift\" is the source's named pattern.",
          },
          progress_looks_like: {
            text: "The target isn't more talent in the room — it's the same short structure, held consistently, conversation after conversation.",
            provenance: "applied",
            note: "The source's contrast between \"the gifted one and the consistent one\" (Ch6/7).",
          },
        },
      },
    },

    revenue_model: {
      status: "complete",
      bands: {
        amber: {
          what_this_means: {
            text: "A great many founders price to win the sale and never check whether the sale leaves a profit — a full calendar and an empty account. Revenue and profit are not the same thing, and the gap between them is where businesses quietly fail.",
            provenance: "direct",
          },
          what_appears_working: {
            text: "Revenue is arriving at this level — the model isn't broken outright — but arriving revenue says nothing about what's actually retained once the business has been fed.",
            provenance: "applied",
            note: "The source's revenue-vs-profit distinction (Ch8), applied to an Amber state.",
          },
          where_leaking: {
            text: "Growth without margin simply makes a leak bigger. Profit rarely arrives by accident when revenue grows large enough — it comes from deliberate structure: offers priced to carry a real margin, not numbers reached by nerve.",
            provenance: "direct",
          },
          pathway_impact: {
            text: "This is the second link in the Chain (Revenue → Profit → Personal Wealth → Freedom). Without it holding, nothing moves further down the chain, regardless of how much revenue arrives.",
            provenance: "direct",
          },
          focus_now: {
            text: "Know what each offer costs to deliver, price it to leave a real margin above that cost, and treat any offer that can't carry a margin as a structural fault to repair, not a shortfall to quietly absorb.",
            provenance: "direct",
          },
          what_to_watch: {
            text: "Don't treat revenue as a scoreboard. A high top-line number can mask a business keeping almost none of what it makes.",
            provenance: "applied",
            note: "The source's caution against treating revenue as a scoreboard.",
          },
          progress_looks_like: {
            text: "A defined, known margin per offer — checked rather than assumed.",
            provenance: "applied",
            note: "The source's framing of \"deliberate structure\" over time; no specific figure given in the source.",
          },
        },
      },
    },

    decision: {
      status: "complete",
      bands: {
        amber: {
          what_this_means: {
            text: "The knowledge of what to do is rarely missing. What's missing is the doing, repeated, on the days it's dull or frightening. This pillar is about whether known actions actually happen, consistently, rather than in bursts.",
            provenance: "direct",
          },
          what_appears_working: {
            text: "Some rhythm exists — the founder isn't idle — but the distinction that matters is whether activity is aimed at a decision, or whether \"safe\" preparatory work (rebuilding, planning, reorganizing) is standing in for the exposing kind (asking, following up).",
            provenance: "applied",
            note: "The source's distinction between preparatory and exposing action (Ch6).",
          },
          where_leaking: {
            text: "\"The retreat into building\": actions that prepare for revenue are safe and feel productive; actions that produce revenue expose the founder to a no. Preparation can become a sophisticated way of avoiding the sale, wearing the costume of productivity.",
            provenance: "direct",
          },
          pathway_impact: {
            text: "Rhythm beats intensity. A founder who does the simple things most days will, within a year, stand somewhere entirely different from an equally talented founder who does them in bursts and stops. Talent doesn't compound. Rhythm does.",
            provenance: "direct",
            note: "The source's contrast between the consistent and the bursty founder.",
          },
          focus_now: {
            text: "Decide in advance exactly when and where an action happens — this removes the moment avoidance was waiting for. A short list of revenue actions, done most days, held to when it's boring.",
            provenance: "direct",
          },
          what_to_watch: {
            text: "Notice when preparation (funnels, systems, planning) is quietly substituting for the exposing action — a real conversation, a follow-up, an ask.",
            provenance: "applied",
            note: "Mirrors the source's diagnostic language on preparation versus exposure.",
          },
          progress_looks_like: {
            text: "The founder who wins is rarely the most gifted — she's the one still doing the simple things in the eleventh month, when the novelty is long gone.",
            provenance: "direct",
            note: "The source's example, Ch6/7.",
          },
        },
      },
    },
  },
};

/* -------------------------------------------------------------------------- */
/* Accessors — pure lookups, graceful on missing entries                       */
/* -------------------------------------------------------------------------- */

/** All section copy for one pillar/band. Returns {} when nothing is defined. */
export function getInevitableStandardPillarBandContent(
  pillar: InevitableStandardPillar,
  band: InevitableStandardContentBand,
): InevitableStandardPillarBandContent {
  return INEVITABLE_STANDARD_REPORT_CONTENT.pillars[pillar]?.bands[band] ?? {};
}

/** One section entry for a pillar/band, or null when it is intentionally blank. */
export function getInevitableStandardContentEntry(
  pillar: InevitableStandardPillar,
  band: InevitableStandardContentBand,
  section: InevitableStandardContentSection,
): InevitableStandardContentEntry | null {
  return getInevitableStandardPillarBandContent(pillar, band)[section] ?? null;
}
