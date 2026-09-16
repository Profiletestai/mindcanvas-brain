/**
 * Central config for profiletest.ai marketing CTAs and nav.
 * Edit destinations here in one place.
 * Agent site reference: docs/SITE.md. Home copy mirror: home-page-copy.md.
 */

/** Google Analytics 4 measurement ID (gtag). Loaded only after cookie consent Accept. */
export const gaMeasurementId = "G-8PFMVC0F0C" as const;

/** Hotjar site ID. Loaded only after cookie consent Accept. */
export const hotjarId = 6752585 as const;

export const links = {
  /** Start Free Trial / onboarding (direct; no experience gate). */
  startNow: "/onboarding/v2",
  /** Existing customer login (MindCanvas / app portal). */
  appLogin: "/portal/login",
  /**
   * Book a talk (GED / sales). Direct HighLevel calendar.
   * `/demo-ged` closed; redirects to `/`.
   */
  bookDemo:
    "https://api.leadconnectorhq.com/widget/booking/tv4bMgkFCI5H917PNxns",
  /** Alias: same calendar (was `/demo-ged#book`). */
  bookDemoBook:
    "https://api.leadconnectorhq.com/widget/booking/tv4bMgkFCI5H917PNxns",
  bookDemoAbsolute:
    "https://api.leadconnectorhq.com/widget/booking/tv4bMgkFCI5H917PNxns",
  /** MCAS experience page (book walkthrough; test sent before call). */
  demoMcas: "/demo-mcas",
  /** MCAS booking anchor. */
  demoMcasBook: "/demo-mcas#book",
  /**
   * BIP 100 booking. `/demo-bip` closed; redirects to `/`.
   * Short link `/da-bip` still hits this calendar.
   */
  demoBip:
    "https://api.leadconnectorhq.com/widget/bookings/one-to-one-daniel-acutt-bip-100",
  demoBipBook:
    "https://api.leadconnectorhq.com/widget/bookings/one-to-one-daniel-acutt-bip-100",
  /** BIP 100 HighLevel calendar (long-form bookings slug). */
  bipBooking:
    "https://api.leadconnectorhq.com/widget/bookings/one-to-one-daniel-acutt-bip-100",
  /** MindCanvas app welcome (staging on apex; eventual profiletest.app home). */
  app: "/app",
  /** MindCanvas MPS demo (stub until full experience ships). */
  demoMps: "/demo-mps",
  /** Neuroscience-framed home variant. */
  neuroscience: "/neuroscience",
  demoAssessment:
    "https://www.profiletest.app/t/b09a63cd3f214deea9e0b11596f053b8",
  /** Optional GED sample test (new tab). */
  sampleGedTest:
    "https://profiletest.app/t/9edcbac138b44b79a66b9e2f6cd293f7",
  /** Optional MCAS sample test before booking (/demo-mcas dual path). Opens in a new tab. */
  sampleMcasTest:
    "https://profiletest.app/mcas/link/a9bef947e697ee7001a9efe509802493",
  mentoring: "https://api.leadconnectorhq.com/widget/bookings/profiletest-ai-mentoring-call",
  sampleReport:
    "https://www.profiletest.app/ged/01c7c2750a6e484aa41f51b64faf4988/entrepreneur?tid=0e0722a1-565c-4610-acf9-4f3a37cf0578",
  /** Sample Insider Insights (seller-facing) URL. */
  samplePlaybook:
    "https://www.profiletest.app/ged/01c7c2750a6e484aa41f51b64faf4988/extended?tid=0e0722a1-565c-4610-acf9-4f3a37cf0578",
  products: "/products",
  pricing: "/products#plans",
  engines: "/products#engines",
  build: "https://api.leadconnectorhq.com/widget/bookings/profiletestai-power-call",
  privacy: "https://profiletest.ai/privacy-policy",
  terms: "https://profiletest.ai/terms-and-conditions",
  /** Personalised revenue plan (noindex; calculator → GHL form → here). */
  plan: "/plan",
  /** Premium partner (custom predictive hiring). Home Build featured + outreach. */
  atumaphire: "https://atumaphire.ai/",
  /** Partner disclosure cite only (Chandell / Life Puzzle). */
  lifePuzzle: "https://lifepuzzle.com.au/",
  /** Founder LinkedIn (About). */
  founderLinkedIn: "https://www.linkedin.com/in/danielacutt/",
  /** Founder media & speaking kit. Built; not published (noindex / off sitemap). */
  founderMedia: "/danielacutt",
  /** Tema App account / data deletion (app-store compliance). Hidden; noindex. */
  temaappDeleteMe: "/temaapp/delete-me",
} as const;

/**
 * Primary home conversion: book a live talk (not "demo" wording).
 * Destination is the HighLevel calendar (`links.bookDemo`). Trial stays Start Free Trial.
 */
export const bookTalk = "Book a talk" as const;

/** Italic subtext on primary Book a talk buttons. */
export const bookTalkSubtext = "30 minutes to unlock more revenue" as const;

export const bookTalkCopy = {
  primary: "Pick a time. We walk your numbers and a real buyer read.",
  short: "A live talk. Not a pitch deck.",
  mid: "Bring a real prospect. We show the read before the call.",
  final: "Book a talk. Hear how this changes every sales call.",
  /** Beside calculator: numbers first, talk is the human path after. */
  roi: "Run your numbers first. The talk is there when you want the walkthrough.",
} as const;

/**
 * Instruction lines under Start Free Trial (not the button subtext).
 * Button already says "3 profile reads included". Notes: how to begin / what next / no card.
 * Keep in sync with home-page-copy.md.
 */
export const startNowCopy = {
  primary: "Nothing to lose. Possibly everything to gain.",
  short: "Nothing to lose. Possibly everything to gain.",
  mid: "Nothing to lose. Possibly everything to gain.",
  final: "Nothing to lose. Possibly everything to gain.",
  /** Beside the revenue calculator (home ROI / demo-ged hero). */
  roi: "Start free here, or run your numbers first.",
  planKickstart: "Includes 3 profile reads.",
} as const;

/**
 * Primary onboarding CTA label (StartNowLink).
 * Goes straight to links.startNow with utm_source=site and utm_content=<location>.
 * No experience gate (locked decision; do not reinstate).
 */
export const getStartedFree = "Start Free Trial" as const;

/** Header / soft link: existing customers into the app portal. */
export const appLoginLabel = "Log in" as const;

/**
 * Header / nav chip alias for getStartedFree (MindCanvas /app standard).
 * Prefer getStartedFree in new code.
 */
export const joinToday = getStartedFree;

/** Italic subtext on primary Start Free Trial buttons. */
export const getStartedFreeSubtext = "3 profile reads included" as const;

/**
 * Alias for getStartedFree (older name in docs and imports).
 * Prefer getStartedFree in new code.
 */
export const startFreeWith3Tests = getStartedFree;

/**
 * Onboarding URL with site attribution.
 * utm_content names the CTA placement (nav, calculator, pricing, …).
 */
export function startNowHref(location: string): string {
  const params = new URLSearchParams({
    utm_source: "site",
    utm_medium: "cta",
    utm_campaign: "start_free_trial",
    utm_content: location,
  });

  return `${links.startNow}?${params.toString()}`;
}

/**
 * Append site UTMs to an absolute or same-site path.
 * Use for external booking widgets and other outbound CTAs.
 */
export function withSiteUtm(
  href: string,
  content: string,
  campaign = "site_cta",
): string {
  try {
    // Same-page anchors stay on the current path (e.g. /demo-ged#book).
    if (href.startsWith("#")) {
      return href;
    }
    const absolute = href.startsWith("http")
      ? href
      : `https://profiletest.ai${href.startsWith("/") ? "" : "/"}${href}`;
    const url = new URL(absolute);
    url.searchParams.set("utm_source", "site");
    url.searchParams.set("utm_medium", "cta");
    url.searchParams.set("utm_campaign", campaign);
    url.searchParams.set("utm_content", content);
    if (href.startsWith("/")) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
    return url.toString();
  } catch {
    return href;
  }
}

/**
 * Home nav: in-page anchors in document order.
 * Order: Calculate Revenue → Education → How it Works → Pricing → Experts.
 * Header CTA: Start Free Trial. Soft Book a talk stays in body where needed.
 * Products is not in home nav (still linked elsewhere).
 */
export const homeNav = [
  { label: "Calculate Revenue", href: "#revenue" },
  { label: "Education", href: "#profiling" },
  { label: "How it Works", href: "#how" },
  { label: "Pricing", href: "#pricing" },
  { label: "Experts", href: "#build" },
] as const;

/**
 * Products page nav. In-page: Engines, Plans. Cross-page: Home, Experts.
 */
export const productsNav = [
  { label: "Home", href: "/" },
  { label: "Engines", href: "#engines" },
  { label: "Plans", href: "#plans" },
  { label: "Experts", href: "/#build" },
] as const;

/**
 * Shared legal chrome nav (was demo-ged chrome).
 */
export const demoNav = [
  { label: "Home", href: "/" },
  { label: "Products", href: "/products" },
  { label: "Experts", href: "/#build" },
] as const;

/** MCAS demo nav. Walkthrough CTA stays page-specific. */
export const mcasNav = [
  { label: "Home", href: "/" },
  { label: "Products", href: "/products" },
  { label: "Experts", href: "/#build" },
  { label: "MCAS", href: "/demo-mcas" },
] as const;

/** @deprecated BIP page closed. Kept briefly for any stale imports. */
export const bipNav = [
  { label: "Home", href: "/" },
  { label: "Products", href: "/products" },
  { label: "Experts", href: "/#build" },
] as const;

/** MindCanvas /app welcome. Start Free Trial is the header CTA. */
export const appNav = [
  { label: "Home", href: "https://profiletest.ai/" },
  { label: "Products", href: "https://profiletest.ai/products" },
  { label: "Engines", href: "#engines" },
] as const;

/** MPS stub nav. */
export const mpsNav = [
  { label: "Home", href: "/" },
  { label: "Products", href: "/products" },
  { label: "MCAS", href: "/demo-mcas" },
  { label: "MPS", href: "/demo-mps" },
] as const;

/** /plan personalised revenue plan. Header button is Book a talk (#book). Join Today is a nav text link. */
export const planNav = [
  { label: "Home", href: "/" },
  { label: "Products", href: "/products" },
  { label: "Numbers", href: "#plan-numbers" },
] as const;

/** @deprecated Use homeNav. Kept briefly for any stale imports. */
export const nav = homeNav;
