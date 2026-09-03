/**
 * Curated quote library for profiletest.ai.
 * Source notes: ProfileTest Quote Bank (Desktop xlsx). Do not commit the xlsx.
 * PullQuote cite (LOCKED): real first name + role only (e.g. `Tash, sales trainer`).
 * QuoteWall cite: anonymised initials + generic role via `wallName` / `wallRole`
 * (honest anonymity; no fake companies). Quote text stays bank-real.
 * Full legal names + LinkedIn live in metadata (`fullName`, `linkedIn`) only.
 * Partner disclosure only for Chandell on PullQuotes (`founder, Life Puzzle, partner`).
 * Faces: licensed assets under public/profiletest-home/build-stories/ only. QuoteWall is text-only (no faces).
 */

export type QuoteFace = {
  src: string;
  alt: string;
};

export type Quote = {
  id: string;
  /** Spoken line (site copy may lightly tidy punctuation). */
  quote: string;
  /** Display first name for PullQuote cite (never surname). */
  name: string;
  /** Occupation / role for PullQuote cite (includes partner tag when required). */
  role: string;
  /**
   * QuoteWall-only display first name / initials.
   * Prefer initials (e.g. `J.R.`) or a light alias. Not used by PullQuote.
   */
  wallName?: string;
  /** QuoteWall-only generic role (no invented company brands). */
  wallRole?: string;
  /** Full legal name for library / ops reference only. Not shown in PullQuote. */
  fullName?: string;
  /** Short outcome line under the cite when used on home. */
  result?: string;
  /** Needle score for home / conversion surfaces (1–5). Soft fluff stays library-only. */
  needle: 1 | 2 | 3 | 4 | 5;
  /** Where this quote earns its keep. */
  themes: Array<
    | "accuracy"
    | "conversion"
    | "cheat-code"
    | "before-after"
    | "rapport"
    | "objections"
    | "ownership"
    | "recommend"
  >;
  /** Licensed face path if we have one in-repo. PullQuote only; never on QuoteWall. */
  face?: QuoteFace;
  /** Profile URL for internal reference only. Do not hotlink LinkedIn CDN images. */
  linkedIn?: string;
  /** Bank sheet + row id for traceability. */
  source?: string;
  /** home = live on homepage; library = reusable later. */
  homeSlot?:
    | "proofbar"
    | "how"
    | "diff"
    | "who-a"
    | "who-b"
    | "pricing"
    | "build";
  /** Home profiling chapter rotator (short one-liners). */
  homeProfiling?: boolean;
  /** demo-ged = live on /demo-ged Catherine sales spine. */
  demoGedSlot?: "proofbar" | "samples" | "flow" | "book";
  /** Dense credibility wall (home, demo-ged, plan, products). */
  quoteWall?: boolean;
};

/** Known licensed faces already in the repo. Alt uses first name (matches display cite). */
export const quoteFaces = {
  chandell: { src: "/profiletest-home/build-stories/chandell.jpg", alt: "Chandell" },
  nick: { src: "/profiletest-home/build-stories/nick.jpg", alt: "Nick" },
  brett: { src: "/profiletest-home/build-stories/brett.jpg", alt: "Brett" },
  gillian: { src: "/profiletest-home/build-stories/gillian.jpg", alt: "Gillian" },
  terri: { src: "/profiletest-home/build-stories/terri.jpg", alt: "Terri" },
  tash: { src: "/profiletest-home/build-stories/tash.png", alt: "Tash" },
  leigh: { src: "/profiletest-home/build-stories/leigh.png", alt: "Leigh" },
  /** Portrait only. /profiletest-home/build-stories/bogdan.png is the WhatsWhat logo. */
  bogdan: { src: "/profiletest-home/build-stories/bogdan-portrait.png", alt: "Bogdan" },
} as const satisfies Record<string, QuoteFace>;

/**
 * High-value quotes still without faces in-repo.
 * Drop licensed files into public/profiletest-home/build-stories/ when ready.
 * Do not invent or scrape faces for these.
 * Note: public/profiletest-home/build-stories/bogdan.png is the WhatsWhat logo, not a portrait.
 */
export const missingQuoteFaces = [] as const;

/** Full curated bank (home + library). Soft fluff kept for later pages. */
export const quotes: Quote[] = [
  {
    id: "tash-sold-me",
    quote:
      "It sold me before you'd even spoken to me. I read my report and thought, this is correct. And if anything had been wrong, I would have told you.",
    name: "Tash",
    fullName: "Tash Rebuck",
    role: "sales trainer",
    wallName: "A.K.",
    wallRole: "sales trainer",
    result: "The report sold her before the call",
    needle: 5,
    themes: ["accuracy", "conversion", "before-after"],
    face: quoteFaces.tash,
    linkedIn: "https://www.linkedin.com/in/tashrebuck/",
    source: "About us #35",
    homeSlot: "proofbar",
    quoteWall: true,
  },
  {
    id: "leigh-rapport",
    quote:
      "I was reading his profile back to him over the phone and he kept saying, yeah, that really resonates. I couldn't believe the rapport it created.",
    name: "Leigh",
    fullName: "Leigh Farnell",
    role: "sales and AI coach",
    wallName: "J.R.",
    wallRole: "sales coach",
    result: "Rapport on a live call, mid-read",
    needle: 5,
    themes: ["rapport", "cheat-code", "conversion"],
    face: quoteFaces.leigh,
    linkedIn: "https://www.linkedin.com/in/leighfarnell/",
    source: "site (home How)",
    homeSlot: "how",
    quoteWall: true,
  },
  {
    id: "leigh-objections",
    quote:
      "Using the profile to preempt objections in advance is super powerful. When you handle an objection in their own language, it brings a whole other level of connection, rapport and understanding.",
    name: "Leigh",
    fullName: "Leigh Farnell",
    role: "sales and AI coach",
    wallName: "J.R.",
    wallRole: "sales coach",
    result: "Objections handled in their language",
    needle: 5,
    themes: ["objections", "rapport", "cheat-code"],
    face: quoteFaces.leigh,
    linkedIn: "https://www.linkedin.com/in/leighfarnell/",
    source: "Market observations #60 (tightened for site)",
    demoGedSlot: "flow",
    quoteWall: true,
  },
  {
    id: "chandell-half-million",
    quote:
      "We're in a half a million dollar deal negotiation right now. How I deal with the CEO versus the CFO is a completely different conversation, because they're different profiles.",
    name: "Chandell",
    fullName: "Chandell Labbozzetta",
    role: "founder, Life Puzzle, partner",
    wallName: "S.L.",
    wallRole: "founder",
    result: "One deal. Two profiles. Two conversations.",
    needle: 5,
    themes: ["conversion", "cheat-code", "before-after"],
    face: quoteFaces.chandell,
    linkedIn: "https://www.linkedin.com/in/chandelllabbozzetta/",
    source: "site (home Who)",
    homeSlot: "who-a",
    quoteWall: true,
  },
  {
    id: "leigh-once-done",
    quote: "Once they've done the 10-minute test, you know how to sell to them.",
    name: "Leigh",
    fullName: "Leigh Farnell",
    role: "sales and AI coach",
    wallName: "J.R.",
    wallRole: "sales coach",
    result: "Ten minutes. Then you know how to sell.",
    needle: 5,
    themes: ["cheat-code", "conversion"],
    face: quoteFaces.leigh,
    linkedIn: "https://www.linkedin.com/in/leighfarnell/",
    source: "About us #50",
    homeProfiling: true,
    quoteWall: true,
  },
  {
    id: "tash-uncomfortable",
    quote:
      "I nodded along to the whole thing. It was incredibly accurate. The part that got me, I resisted at first, then you explained it and I realised it described something I had literally done the day before. Uncomfortably accurate.",
    name: "Tash",
    fullName: "Tash Rebuck",
    role: "sales trainer",
    wallName: "A.K.",
    wallRole: "sales trainer",
    result: "Uncomfortably accurate, same-day proof",
    needle: 5,
    themes: ["accuracy", "before-after"],
    face: quoteFaces.tash,
    linkedIn: "https://www.linkedin.com/in/tashrebuck/",
    source: "site (home Pricing)",
    demoGedSlot: "samples",
    quoteWall: true,
  },
  {
    id: "brett-advanced",
    quote:
      "Any future discussions really start off at a more advanced stage than just jumping on a call after an assessment with having no real feedback yet from the individual as to what their thoughts were of the results.",
    name: "Brett",
    fullName: "Brett Gordon",
    role: "founder, Businesses Are People Too",
    wallName: "R.B.",
    wallRole: "consultant",
    result: "Next call starts further along",
    needle: 4,
    themes: ["before-after", "cheat-code"],
    face: quoteFaces.brett,
    source: "About us #45",
    homeSlot: "build",
    quoteWall: true,
  },
  {
    id: "chandell-snapshot",
    quote:
      "I didn't have time to read the full report of this particular person, and so I got the snapshot, and it was everything that I needed to know in that moment.",
    name: "Chandell",
    fullName: "Chandell Labbozzetta",
    role: "founder, Life Puzzle, partner",
    wallName: "S.L.",
    wallRole: "founder",
    result: "Snapshot alone carried the call",
    needle: 5,
    themes: ["cheat-code", "conversion"],
    face: quoteFaces.chandell,
    linkedIn: "https://www.linkedin.com/in/chandelllabbozzetta/",
    source: "About us #136",
    quoteWall: true,
  },
  {
    id: "chandell-blown-away",
    quote:
      "When I first saw this I was blown away. I thought, my goodness, I wish I'd had this for the last 20 years of training people. And I'm so excited to get it into the hands of my clients.",
    name: "Chandell",
    fullName: "Chandell Labbozzetta",
    role: "founder, Life Puzzle, partner",
    wallName: "S.L.",
    wallRole: "founder",
    result: "Wish she'd had it for 20 years",
    needle: 5,
    themes: ["recommend", "cheat-code", "before-after"],
    face: quoteFaces.chandell,
    linkedIn: "https://www.linkedin.com/in/chandelllabbozzetta/",
    source: "site (demo-ged Proof)",
    demoGedSlot: "proofbar",
    quoteWall: true,
  },

  // Library + home / demo mid-page (needle-moving)
  {
    id: "nick-eye-opener",
    quote:
      "After a few of these, you can give people insights they relate to instantly but have never thought about themselves. It's almost always a massive eye-opener.",
    name: "Nick",
    fullName: "Nick Pye",
    role: "leadership coach",
    wallName: "D.P.",
    wallRole: "leadership coach",
    result: "Insights they already sense, finally named",
    needle: 4,
    themes: ["accuracy", "cheat-code"],
    face: quoteFaces.nick,
    linkedIn: "https://www.linkedin.com/in/nick-pye-focalpoint/",
    source: "Market observations #66",
    homeSlot: "who-b",
    quoteWall: true,
  },
  {
    id: "bogdan-gate",
    quote:
      "This assessment becomes my main tool of selling. I won't take a call with anyone unless they take the assessment.",
    name: "Bogdan",
    fullName: "Petru Bogdan Stan",
    role: "founder, WhatsWhat Global",
    wallName: "M.V.",
    wallRole: "founder",
    result: "No assessment, no call",
    needle: 5,
    themes: ["conversion", "cheat-code", "before-after"],
    face: quoteFaces.bogdan,
    linkedIn: "https://www.linkedin.com/in/petru-bogdan-stan-8aa2416a/",
    source: "About us #14",
    demoGedSlot: "book",
    quoteWall: true,
  },
  {
    id: "bogdan-sales-gold",
    quote:
      "I think those are gold for a sales agent afterwards. They receive this, they call him, and they know exactly how to say, and how to sell.",
    name: "Bogdan",
    fullName: "Petru Bogdan Stan",
    role: "founder, WhatsWhat Global",
    wallName: "M.V.",
    wallRole: "founder",
    result: "Reps know what to say before they dial",
    needle: 5,
    themes: ["cheat-code", "conversion"],
    face: quoteFaces.bogdan,
    linkedIn: "https://www.linkedin.com/in/petru-bogdan-stan-8aa2416a/",
    source: "About us #17",
    homeSlot: "diff",
    quoteWall: true,
  },

  // Home profiling chapter: short one-liners (prefer voices not already heavy on home)
  {
    id: "chandell-wish-short",
    quote: "I wish I'd had this for the last 20 years of training people.",
    name: "Chandell",
    fullName: "Chandell Labbozzetta",
    role: "founder, Life Puzzle, partner",
    result: "Wish she'd had it for 20 years",
    needle: 5,
    themes: ["recommend", "cheat-code", "before-after"],
    face: quoteFaces.chandell,
    linkedIn: "https://www.linkedin.com/in/chandelllabbozzetta/",
    source: "site (chandell-blown-away, one-liner)",
    homeProfiling: true,
  },
  {
    id: "bogdan-no-call",
    quote: "I won't take a call with anyone unless they take the assessment.",
    name: "Bogdan",
    fullName: "Petru Bogdan Stan",
    role: "founder, WhatsWhat Global",
    result: "No assessment, no call",
    needle: 5,
    themes: ["conversion", "cheat-code", "before-after"],
    face: quoteFaces.bogdan,
    linkedIn: "https://www.linkedin.com/in/petru-bogdan-stan-8aa2416a/",
    source: "About us #14 (one-liner)",
    homeProfiling: true,
  },
  {
    id: "nick-eye-short",
    quote: "It's almost always a massive eye-opener.",
    name: "Nick",
    fullName: "Nick Pye",
    role: "leadership coach",
    result: "Insights they already sense, finally named",
    needle: 4,
    themes: ["accuracy", "cheat-code"],
    face: quoteFaces.nick,
    linkedIn: "https://www.linkedin.com/in/nick-pye-focalpoint/",
    source: "Market observations #66 (one-liner)",
    homeProfiling: true,
  },
  {
    id: "bogdan-know-how",
    quote: "They know exactly how to say, and how to sell.",
    name: "Bogdan",
    fullName: "Petru Bogdan Stan",
    role: "founder, WhatsWhat Global",
    result: "Reps know what to say before they dial",
    needle: 5,
    themes: ["cheat-code", "conversion"],
    face: quoteFaces.bogdan,
    linkedIn: "https://www.linkedin.com/in/petru-bogdan-stan-8aa2416a/",
    source: "About us #17 (one-liner)",
  },
  {
    id: "brett-advanced-short",
    quote: "Future discussions start at a more advanced stage than a cold jump on a call.",
    name: "Brett",
    fullName: "Brett Gordon",
    role: "founder, Businesses Are People Too",
    result: "Next call starts further along",
    needle: 4,
    themes: ["before-after", "cheat-code"],
    face: quoteFaces.brett,
    source: "About us #45 (one-liner)",
    homeProfiling: true,
  },
  {
    id: "terri-raving",
    quote:
      "I'm happy to even fully promote what you're doing, because I'm already a part of it, I'm a raving fan of it. Even though I haven't got the benefit from it yet, I already am before I even do anything.",
    name: "Terri",
    fullName: "Terri Vincent",
    role: "founder, Competency Revolution",
    result: "Raving fan before the return",
    needle: 3,
    themes: ["recommend"],
    face: quoteFaces.terri,
    source: "About us #5",
    homeSlot: "pricing",
  },
  {
    id: "tash-recommend",
    quote: "I think it is brilliant. I am already recommending it to people I have in mind.",
    name: "Tash",
    fullName: "Tash Rebuck",
    role: "sales trainer",
    needle: 2,
    themes: ["recommend"],
    face: quoteFaces.tash,
    linkedIn: "https://www.linkedin.com/in/tashrebuck/",
    source: "site (former Final CTA)",
  },
  {
    id: "tash-validation",
    quote:
      "Really brilliant validation. As a sales trainer, I love to keep learning about sales, and it has been really nice to get training from people with the same methodology as me.",
    name: "Tash",
    fullName: "Tash Rebuck",
    role: "sales trainer",
    needle: 2,
    themes: ["recommend"],
    face: quoteFaces.tash,
    linkedIn: "https://www.linkedin.com/in/tashrebuck/",
    source: "About us #36 / former Build",
  },

  // QuoteWall expansions (bank-real; wall cites anonymised)
  {
    id: "genene-presold",
    quote:
      "At the beginning of all of this, my idea was that people are going to be pre-sold by the time they even get to speak to me. And I think that that predictive tool is just another way to pre-sell them.",
    name: "Genene",
    role: "business coach",
    wallName: "E.W.",
    wallRole: "business coach",
    result: "Pre-sold before the call",
    needle: 5,
    themes: ["conversion", "cheat-code", "before-after"],
    source: "About us #61",
    quoteWall: true,
  },
  {
    id: "steve-predict",
    quote:
      "Through the profiling, we determined that even though she was suitable and could do the job, she would get bored after 6 months and leave. And she's now confirming that's exactly what's happening six months later. We literally predict the future with profiling.",
    name: "Steve",
    role: "tech founder",
    wallName: "O.N.",
    wallRole: "tech founder",
    result: "Predicted the leave. Six months later, confirmed.",
    needle: 5,
    themes: ["accuracy", "before-after", "cheat-code"],
    source: "About us #147",
    quoteWall: false,
  },
  {
    id: "john-conversion",
    quote:
      "What I'm seeing is that the mechanism that you're suggesting slash providing massively increases the conversion rate of people if you have it in a room. What it's not going to do is get new people into the room.",
    name: "John",
    role: "consultant",
    wallName: "T.H.",
    wallRole: "consultant",
    result: "Conversion in the room, named plainly",
    needle: 5,
    themes: ["conversion", "cheat-code"],
    source: "About us #78",
    quoteWall: true,
  },
  {
    id: "david-22-questions",
    quote:
      "I'm surprised you got that insight from 22 questions. No, it makes a lot of sense. I think you summarized the results quite accurately.",
    name: "David",
    role: "general manager",
    wallName: "H.B.",
    wallRole: "general manager",
    result: "Accuracy from 22 questions",
    needle: 5,
    themes: ["accuracy"],
    source: "About us #21",
    quoteWall: true,
  },
  {
    id: "scott-dont-sell",
    quote:
      "Please don't sell this to anyone that sells to me, as it'll cost me a fortune. If they can profile my buying patterns, oh my goodness, I'll be more broke than I am now.",
    name: "Scott",
    role: "consultant",
    wallName: "K.M.",
    wallRole: "consultant",
    result: "Worried about being on the receiving end",
    needle: 5,
    themes: ["conversion", "cheat-code"],
    source: "About us #9",
    quoteWall: true,
  },
  {
    id: "andrew-on-mark",
    quote:
      "I feel like everything Dan said so far, there's the initial observation, then there's an extension of the observation. And I think they've all been pretty much on the mark.",
    name: "Andrew",
    role: "managing director",
    wallName: "C.D.",
    wallRole: "managing director",
    result: "Pretty much on the mark",
    needle: 5,
    themes: ["accuracy"],
    source: "About us #23",
    quoteWall: false,
  },
  {
    id: "charlie-tin",
    quote:
      "All that work, all that work, and in 6 minutes, you can explain it. But then it does what it says on the tin.",
    name: "Charlie",
    role: "founder",
    wallName: "B.F.",
    wallRole: "founder",
    result: "Does what it says on the tin",
    needle: 4,
    themes: ["accuracy", "cheat-code"],
    source: "About us #38",
    quoteWall: true,
  },
  {
    id: "emma-own-profile",
    quote:
      "Turning your model into a profile, I think that that's a very exciting prospect for people. Because everyone wants their own profile test, for God's sake.",
    name: "Emma",
    role: "business coach",
    wallName: "L.P.",
    wallRole: "business coach",
    result: "Everyone wants their own profile",
    needle: 4,
    themes: ["ownership", "conversion"],
    source: "About us #42",
    quoteWall: false,
  },
  {
    id: "kahlia-so-me",
    quote:
      "The last time I saw the Team Puzzle report was the very first iteration, and to see this now. When I saw my report and reading through it, I was smiling at myself, because I'm like, that is so me.",
    name: "Kahlia",
    role: "business owner",
    wallName: "I.S.",
    wallRole: "business owner",
    result: "Self-recognition: that is so me",
    needle: 4,
    themes: ["accuracy"],
    source: "About us #132",
    quoteWall: false,
  },
  {
    id: "gillian-aha",
    quote:
      "It brings it home, really, because that's where people go, I can see that's where we clash. And they get the aha's actually from the comparison bit.",
    name: "Gillian",
    role: "consultant",
    wallName: "P.C.",
    wallRole: "consultant",
    result: "Ahas from the comparison",
    needle: 4,
    themes: ["accuracy", "rapport"],
    face: quoteFaces.gillian,
    source: "About us #47",
    quoteWall: false,
  },
  {
    id: "brandon-team",
    quote:
      "I'm looking at this and, like, reflecting, like, this is good, this is really good insight. I'd like each of my sales team to take this. So that I can understand them better, too.",
    name: "Brandon",
    role: "head of sales",
    wallName: "W.J.",
    wallRole: "head of sales",
    result: "Wants it for the whole sales team",
    needle: 4,
    themes: ["conversion", "cheat-code"],
    source: "About us #10",
    quoteWall: true,
  },
  {
    id: "jp-quiz-journey",
    quote:
      "People would come to my website, take the quiz, understand their own problems, where they are, and get the results in their emails, and then book a call to work with me, knowing what the problem is.",
    name: "JP",
    role: "consultant",
    wallName: "Q.R.",
    wallRole: "consultant",
    result: "Quiz first. Book knowing the problem.",
    needle: 5,
    themes: ["conversion", "before-after", "cheat-code"],
    source: "Market observations #14",
    quoteWall: false,
  },
];

export const homeQuotes = {
  proofbar: quotes.find((q) => q.homeSlot === "proofbar")!,
  how: quotes.find((q) => q.homeSlot === "how")!,
  diff: quotes.find((q) => q.homeSlot === "diff")!,
  whoA: quotes.find((q) => q.homeSlot === "who-a")!,
  whoB: quotes.find((q) => q.homeSlot === "who-b")!,
  pricing: quotes.find((q) => q.homeSlot === "pricing")!,
  build: quotes.find((q) => q.homeSlot === "build")!,
} as const;

/**
 * Curated credibility wall (18 sales-spine needle-movers: clean 3-column rows).
 * Display cites use wallName/wallRole (initials + generic role). No faces.
 * Hiring, Team Puzzle, call-debrief, and soft ownership lines stay library-only.
 */
export const quoteWall: Quote[] = [
  quotes.find((q) => q.id === "leigh-once-done")!,
  quotes.find((q) => q.id === "bogdan-gate")!,
  quotes.find((q) => q.id === "genene-presold")!,
  quotes.find((q) => q.id === "tash-sold-me")!,
  quotes.find((q) => q.id === "john-conversion")!,
  quotes.find((q) => q.id === "chandell-half-million")!,
  quotes.find((q) => q.id === "david-22-questions")!,
  quotes.find((q) => q.id === "leigh-objections")!,
  quotes.find((q) => q.id === "scott-dont-sell")!,
  quotes.find((q) => q.id === "bogdan-sales-gold")!,
  quotes.find((q) => q.id === "tash-uncomfortable")!,
  quotes.find((q) => q.id === "nick-eye-opener")!,
  quotes.find((q) => q.id === "charlie-tin")!,
  quotes.find((q) => q.id === "chandell-snapshot")!,
  quotes.find((q) => q.id === "brett-advanced")!,
  quotes.find((q) => q.id === "brandon-team")!,
  quotes.find((q) => q.id === "leigh-rapport")!,
  quotes.find((q) => q.id === "chandell-blown-away")!,
];

/** Five short needle-movers for the home profiling chapter rotator. */
export const homeProfilingQuotes: Quote[] = [
  quotes.find((q) => q.id === "leigh-once-done")!,
  quotes.find((q) => q.id === "bogdan-no-call")!,
  quotes.find((q) => q.id === "nick-eye-short")!,
  quotes.find((q) => q.id === "chandell-wish-short")!,
  quotes.find((q) => q.id === "brett-advanced-short")!,
];

/** Needle-moving PullQuotes for /demo-ged (Catherine sales spine). */
export const demoGedQuotes = {
  proofbar: quotes.find((q) => q.demoGedSlot === "proofbar")!,
  samples: quotes.find((q) => q.demoGedSlot === "samples")!,
  flow: quotes.find((q) => q.demoGedSlot === "flow")!,
  book: quotes.find((q) => q.demoGedSlot === "book")!,
} as const;

/** Locked PullQuote display cite: first name + role. Never surnames. */
export function citeLine(q: Pick<Quote, "name" | "role">): string {
  return `${q.name}, ${q.role}`;
}

/** QuoteWall display cite: anonymised initials/alias + generic role when set. */
export function wallCiteLine(q: Pick<Quote, "name" | "role" | "wallName" | "wallRole">): string {
  return citeLine({
    name: q.wallName ?? q.name,
    role: q.wallRole ?? q.role,
  });
}
