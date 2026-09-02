# The Inevitable Standard — report copy content layer (pre-commit review)

Built and verified locally. **Nothing committed yet.**

## Files

| File | Status | What |
|---|---|---|
| `apps/web/lib/inevitable-standard/content/reportCopy.ts` | new | Typed TS data module (matches the flat `lib/inevitable-standard/` convention — no JSON precedent in repo). `source_version`, `authoring_standard`, `pillars → status/note → bands → sections`, two pure accessors. |
| `apps/web/lib/inevitable-standard/content/README.md` | new | Part 4 note: source doc, direct-quote-or-labeled-application standard, `text` vs `note` rule, Positioning provisional pending Genene. |
| `apps/web/lib/inevitable-standard/content/reportCopy.test.ts` | new | 8 tests — source version, key validity, non-empty/trimmed copy, valid provenance, **no source-document references in `text`**, Positioning provisional with exactly 3 sections, graceful `{}`/`null`. |
| `apps/web/app/t/[token]/report/InevitableStandardReportClient.tsx` | modified | +28 lines. `PILLAR_CONSTRAINT_COPY` retained verbatim as fallback. |

Not on the do-not-touch list. `docs/inevitable-standard-spec.md` and
`tsconfig.tsbuildinfo` were already dirty at session start — not staged.

## Checks

- **Tests:** 118 passed (110 baseline + 8 new).
- **Typecheck:** `tsc --noEmit` clean.
- **Text audit:** all 30 `text` fields scanned — zero citations (`Ch5`, `(Ch6/7)`),
  zero meta ("the book / the source assumes…"), zero `[direct]`/`[applied]`
  labels. All rationale and citations live in `note` (never rendered).

## Design decisions (confirmed)

1. Part 3 section priority: `what_this_means` → `where_leaking` → hardcoded fallback.
2. `text` = customer-ready prose only; `note` = citation + rationale; `provenance`
   = the direct/applied label. Applied to **every** entry, not just the flagged few.
3. Extraction splits confirmed for the four `identity` entries.
4. Positioning stays wired to the content layer (its `what_this_means` now reads
   cleanly): *"A named, packaged offer only does its work if the right people
   recognize themselves in it."*

## Part 3 behaviour — Report 1 layout unchanged

Only the primary-constraint sentence in "Key Diagnosis" changes source:

| pillar / band | rendered sentence |
|---|---|
| identity / amber | People rarely fail to convert because they can't sell. They fail because, somewhere beneath her own awareness, the founder has decided she isn't allowed to. |
| identity / green | When identity is strong, it's very unlikely to be the primary constraint. Where it still shows up as worth attention, that's a maintenance note, not an urgent one. |
| positioning / amber | A named, packaged offer only does its work if the right people recognize themselves in it. |
| offer / amber | Most founders sell what they do — the session, the hour, the service — priced by the unit of time. This is the first and most expensive structural mistake… |
| sales / amber | Between a founder and a prospect sits a short conversation, and in that conversation the entire model either becomes a client or dissolves into a polite maybe… |
| revenue_model / amber | A great many founders price to win the sale and never check whether the sale leaves a profit — a full calendar and an empty account… |
| decision / amber | The knowledge of what to do is rarely missing. What's missing is the doing, repeated, on the days it's dull or frightening… |
| all `*/red`, `*/green` except identity | **unchanged** — falls back to today's `PILLAR_CONSTRAINT_COPY` |

## Full content dump (every entry)

### IDENTITY — complete

**amber**
- `snapshot_line` [applied] — What happens in the room when the price is actually on the table.
- `what_this_means` [direct] — People rarely fail to convert because they can't sell. They fail because, somewhere beneath her own awareness, the founder has decided she isn't allowed to.
- `what_appears_working` [applied] — The founder is not avoiding the sale outright; the avoidance shows up selectively, under specific pressure, not as a blanket pattern.
- `where_leaking` [direct] — The quiet architecture of avoidance: over-explaining rather than asking, prices drifting downward before anyone objects, waiting for the right people to simply arrive ready to buy. Each looks like diligence. Each is a way of staying out of the one moment that produces revenue.
- `pathway_impact` [direct] — A business is a system, only as strong as its weakest link. Effort poured into a strong link while identity is the actual constraint moves almost nothing, because the system can only move as much as its narrowest point allows.
- `focus_now` [direct] — Confidence sits downstream of action, not the other way around. State the real price once, and let the silence sit. Do it ten times and the correction sets.
- `what_to_watch` [direct] — The reflex, not the mood — discounting before anyone has asked, or explaining a price instead of stating it.
- `progress_looks_like` [applied] — A real price, held without the pre-emptive discount, across a defined number of real conversations.

**green**
- `what_this_means` [applied] — When identity is strong, it's very unlikely to be the primary constraint. Where it still shows up as worth attention, that's a maintenance note, not an urgent one.
- `what_appears_working` [applied] — A strong result absorbs weakness elsewhere.
- `where_leaking` [direct] — A standard is a decision held regardless of how one day feels.

### POSITIONING — provisional (pending source material from Genene)

**amber**
- `what_this_means` [applied, weak] — A named, packaged offer only does its work if the right people recognize themselves in it.
- `where_leaking` [applied, weak] — If the offer is hard to explain in a single sentence, or attracts a wide, undifferentiated range of enquiries, the packaging — and likely the pricing — isn't yet doing the work of pre-qualifying who it's for.
- `focus_now` [applied, weak] — State plainly who the work is for and why. Give the market description edges the same way a strong offer has them: a name, a promise, a described outcome.
- Blank: `snapshot_line`, `what_appears_working`, `pathway_impact`, `what_to_watch`, `progress_looks_like`

### OFFER — complete

**amber**
- `what_this_means` [direct] — Most founders sell what they do — the session, the hour, the service — priced by the unit of time. This is the first and most expensive structural mistake: it turns a founder into a commodity measured in hours, with a ceiling on both the price and the volume.
- `what_appears_working` [applied] — At this level, some packaging exists — the work isn't being sold as pure raw time — but the offer likely still lacks a full shape: a defined product with a name, a promise, and a clear outcome the client can picture.
- `where_leaking` [direct] — A single offer at a single price forces every prospect into the same yes or no. It turns away the person who'd have started smaller, and caps the person who'd happily pay for more. Without a ladder — entry, core, premium — revenue per client has a ceiling the founder built herself.
- `pathway_impact` [direct] — An irresistible offer that carries no margin isn't a triumph — it's a busier way to earn nothing. The offer determines what everything downstream (structure, pricing, path) actually has to work with.
- `focus_now` [direct] — Give the work edges: name it, state what it delivers, describe the outcome the client walks away with. Then build three rungs, not seven — past a certain point, more options stop helping a buyer choose and start freezing her.
- `what_to_watch` [applied] — Too many tiers freeze a buyer rather than helping her choose. If new options are being added without a clear promise for each, that's the pattern to watch for.
- `progress_looks_like` [applied] — Revenue per client roughly triples within two quarters once a named offer and a three-rung ladder exist — a reasonable target shape, not a specific number to promise.

### SALES — complete

**amber**
- `what_this_means` [direct] — Between a founder and a prospect sits a short conversation, and in that conversation the entire model either becomes a client or dissolves into a polite maybe. This pillar is where identity, structure and execution meet under real pressure.
- `what_appears_working` [applied] — Conversations are happening and some convert — the pillar isn't at zero — but the question is whether the same outcome happens without the founder specifically in the room, or whether conversion is tied to her personal presence each time.
- `where_leaking` [direct] — An unresolved "maybe" is the most expensive outcome in a sales conversation — it costs the prospect clarity and costs the founder the ability to plan, filling the pipeline with people who aren't moving anywhere.
- `pathway_impact` [direct] — A no closes cleanly and lets both people move on. A yes begins the work. A maybe is the only outcome that helps no one — and it's usually what an unstructured conversation defaults to.
- `focus_now` [direct] — Work the PROSPER structure: Permission, Reframe, Ownership, Structure, Power Questions, Embodiment, Result — seven parts, held in order. In particular: ask more, pitch less — the top-performing sellers spend noticeably more of the conversation listening. A conclusion the buyer reaches herself holds; one she's handed doesn't.
- `what_to_watch` [applied] — Decision drift: revenue momentum quietly slowed by decisions revisited, delayed or avoided, while the calendar stays busy. It feels like diligence from the inside.
- `progress_looks_like` [applied] — The target isn't more talent in the room — it's the same short structure, held consistently, conversation after conversation.

### REVENUE_MODEL — complete

**amber**
- `what_this_means` [direct] — A great many founders price to win the sale and never check whether the sale leaves a profit — a full calendar and an empty account. Revenue and profit are not the same thing, and the gap between them is where businesses quietly fail.
- `what_appears_working` [applied] — Revenue is arriving at this level — the model isn't broken outright — but arriving revenue says nothing about what's actually retained once the business has been fed.
- `where_leaking` [direct] — Growth without margin simply makes a leak bigger. Profit rarely arrives by accident when revenue grows large enough — it comes from deliberate structure: offers priced to carry a real margin, not numbers reached by nerve.
- `pathway_impact` [direct] — This is the second link in the Chain (Revenue → Profit → Personal Wealth → Freedom). Without it holding, nothing moves further down the chain, regardless of how much revenue arrives.
- `focus_now` [direct] — Know what each offer costs to deliver, price it to leave a real margin above that cost, and treat any offer that can't carry a margin as a structural fault to repair, not a shortfall to quietly absorb.
- `what_to_watch` [applied] — Don't treat revenue as a scoreboard. A high top-line number can mask a business keeping almost none of what it makes.
- `progress_looks_like` [applied] — A defined, known margin per offer — checked rather than assumed.

### DECISION — complete

**amber**
- `what_this_means` [direct] — The knowledge of what to do is rarely missing. What's missing is the doing, repeated, on the days it's dull or frightening. This pillar is about whether known actions actually happen, consistently, rather than in bursts.
- `what_appears_working` [applied] — Some rhythm exists — the founder isn't idle — but the distinction that matters is whether activity is aimed at a decision, or whether "safe" preparatory work (rebuilding, planning, reorganizing) is standing in for the exposing kind (asking, following up).
- `where_leaking` [direct] — "The retreat into building": actions that prepare for revenue are safe and feel productive; actions that produce revenue expose the founder to a no. Preparation can become a sophisticated way of avoiding the sale, wearing the costume of productivity.
- `pathway_impact` [direct] — Rhythm beats intensity. A founder who does the simple things most days will, within a year, stand somewhere entirely different from an equally talented founder who does them in bursts and stops. Talent doesn't compound. Rhythm does.
- `focus_now` [direct] — Decide in advance exactly when and where an action happens — this removes the moment avoidance was waiting for. A short list of revenue actions, done most days, held to when it's boring.
- `what_to_watch` [applied] — Notice when preparation (funnels, systems, planning) is quietly substituting for the exposing action — a real conversation, a follow-up, an ask.
- `progress_looks_like` [direct] — The founder who wins is rarely the most gifted — she's the one still doing the simple things in the eleventh month, when the novelty is long gone.

## Preview deploy note

Preview is push-triggered Vercel — it builds only after commit + push. The real
submission on file (`token 3f018587d78a4bdfac48409f2d826fa5`,
`tid e19689a1-42c9-4248-b7dd-60fe0e9fe6bb`) has primary constraint = `decision`
= red, so it renders the **unchanged fallback** sentence. To see sourced copy on
the preview I need a submission whose primary-constraint pillar is Amber.
