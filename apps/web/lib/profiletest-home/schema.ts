/**
 * Shared JSON-LD for crawl / GEO. Keep FAQ on the homepage only.
 */

export const organizationLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "profiletest.ai",
  legalName: "Tema Resources Limited",
  url: "https://profiletest.ai",
  logo: "https://profiletest.ai/logo-white.png",
  founder: {
    "@type": "Person",
    name: "Daniel Acutt",
    jobTitle: "Founder",
    sameAs: ["https://www.linkedin.com/in/danielacutt/"],
  },
  description:
    "A behavioural intelligence lab. Behavioural profiling for sales, coaching and people decisions, plus custom-built proprietary diagnostic systems.",
  // UK company serving a global audience. Not a LocalBusiness listing.
  areaServed: "Worldwide",
  sameAs: [
    "https://www.linkedin.com/company/profiletest-ai",
    "https://www.linkedin.com/in/danielacutt/",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    email: "support@profiletest.ai",
    contactType: "customer support",
    availableLanguage: ["English"],
  },
} as const;

export const softwareLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "profiletest.ai",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: "https://profiletest.ai/",
  description:
    "Behavioural profiling for sales. Prospects complete a short diagnostic and receive a personal report. Sellers receive Insider Insights on how the prospect thinks, decides and buys, before the call.",
  offers: {
    "@type": "Offer",
    price: "147",
    priceCurrency: "USD",
    description: "Plans from $147/month with a monthly Profile Read Target. 3 free Kickstart profile reads to start. No card needed.",
  },
} as const;

export const websiteLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "profiletest.ai",
  url: "https://profiletest.ai/",
  inLanguage: "en-GB",
  publisher: { "@type": "Organization", name: "profiletest.ai" },
  description:
    "Behavioural profiling for sales. Know how prospects think, decide and buy, before the call.",
} as const;

export const homeFaqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is behavioural profiling for sales?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Behavioural profiling for sales means understanding how a specific prospect thinks, decides and buys before the sales conversation, then using that read to prepare, pitch and follow up. profiletest.ai does this with a short diagnostic the prospect completes themselves, so the intelligence comes from real answers, not scraped data.",
      },
    },
    {
      "@type": "Question",
      name: "What is Insider Insights?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Insider Insights is knowing how a prospect thinks, decides and buys before the call, backed by behavioural intelligence. Insider Insights is the name of that private seller read: how to open, what to lead with, where the deal stalls. One diagnostic also gives them a Strategic Growth Report worth keeping.",
      },
    },
    {
      "@type": "Question",
      name: "What is predictive selling?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Predictive selling means using behavioural intelligence gathered before a call to predict how a prospect will communicate, decide and buy, so you can tailor the conversation to that person. Plain language: Insider Insights above. One diagnostic produces two things: a valuable report for the prospect and Insider Insights for you.",
      },
    },
    {
      "@type": "Question",
      name: "How is this different from DISC?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "DISC is a real diagnostic, and a good one. But it was built for coaching and teams, and it describes communication style. That's 2D. Selling needs 3D: how the person communicates, how they decide, and what they need right now. If you already use DISC, Wealth Dynamics, Talent Dynamics, Contribution Compass or 16 Personalities, you have the foundation. This adds the selling dimension.",
      },
    },
    {
      "@type": "Question",
      name: "How is this different from Crystal or Humantic AI?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Those tools guess a personality type by scraping public data like LinkedIn. The prospect gets nothing from the process, and as more of the internet is written by AI, the guesses get less reliable. profiletest.ai profiles with the prospect, not behind their back. They complete a short diagnostic, get a report worth keeping, and you get the behavioural intelligence.",
      },
    },
    {
      "@type": "Question",
      name: "Do I need training to use it?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "If you understand any mainstream profiling model, you can plug and play. Every subscriber gets a one-to-one onboarding call, plus two live rooms every week: The Selling Lab and The Conversion Clinic, alternating US and AU friendly time zones, serving the UK and RSA in between. And inside the community platform there's a growing library of training videos on sales, conversions and how to get the most from every report, so you can learn at your own pace between sessions.",
      },
    },
    {
      "@type": "Question",
      name: "Do I need a card to start?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. You get 3 free profile reads when you create your account, no card needed. Use them on people you trust, see the reports and Insider Insights for yourself, then pick a plan from $147/month when you're ready.",
      },
    },
    {
      "@type": "Question",
      name: "Isn't this just another step in my sales process?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. It adds no meetings and replaces nothing. The link slots into the flow you already run: send it where you'd normally send a booking confirmation or a qualification question. Your prospect answers while you get on with your day. The read is waiting before your call.",
      },
    },
    {
      "@type": "Question",
      name: "Will my prospects actually complete it?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, when it's positioned as value rather than admin. It takes a few minutes and ends with a personal report they keep. You get proven invitation wording in onboarding, and completion tactics are part of The Selling Lab.",
      },
    },
    {
      "@type": "Question",
      name: "Can I get my own branded version?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. The lab custom-builds behavioural profiling systems around your method and brand. You own it, you can license it, and it becomes your intellectual property. See Build With Us.",
      },
    },
  ],
} as const;

export const demoWebPageLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Sales Demo | profiletest.ai",
  url: "https://profiletest.ai/demo-ged",
  description:
    "Know how prospects think, decide and buy. See it on your numbers, or book a live Insider Insights walkthrough.",
  isPartOf: { "@type": "WebSite", name: "profiletest.ai", url: "https://profiletest.app/" },
  about: { "@type": "SoftwareApplication", name: "profiletest.ai" },
  primaryImageOfPage: {
    "@type": "ImageObject",
    url: "https://profiletest.app/profiletest-home/og-home.png",
  },
} as const;

export const productsWebPageLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Products & Pricing | profiletest.ai",
  url: "https://profiletest.ai/products",
  description:
    "One behavioural intelligence lab. Three engines. Plans from $147/month including Scale. Start with 3 free Kickstart profile reads. No card needed.",
  isPartOf: { "@type": "WebSite", name: "profiletest.ai", url: "https://profiletest.ai/" },
  about: { "@type": "SoftwareApplication", name: "profiletest.ai" },
  primaryImageOfPage: {
    "@type": "ImageObject",
    url: "https://profiletest.ai/og-home.png",
  },
} as const;

export const demoMcasWebPageLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "MCAS Demo | profiletest.ai",
  url: "https://profiletest.ai/demo-mcas",
  description:
    "For career coaches and HR: book an MCAS walkthrough to see the Candidate Summary live, or take a sample profile first, then book.",
  isPartOf: { "@type": "WebSite", name: "profiletest.ai", url: "https://profiletest.ai/" },
  about: { "@type": "SoftwareApplication", name: "profiletest.ai" },
  primaryImageOfPage: {
    "@type": "ImageObject",
    url: "https://profiletest.ai/og-home.png",
  },
} as const;

export const demoBipWebPageLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "BIP 100 Demo | profiletest.ai",
  url: "https://profiletest.ai/demo-bip",
  description:
    "For the BIP 100 network: know how prospects think, decide and buy. See it on your numbers, or book a live Insider Insights walkthrough.",
  isPartOf: { "@type": "WebSite", name: "profiletest.ai", url: "https://profiletest.ai/" },
  about: { "@type": "SoftwareApplication", name: "profiletest.ai" },
  primaryImageOfPage: {
    "@type": "ImageObject",
    url: "https://profiletest.ai/og-home.png",
  },
} as const;

export const appWebPageLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Welcome to MindCanvas | profiletest.ai",
  url: "https://profiletest.app/",
  description:
    "Welcome to MindCanvas. Behavioural intelligence for Selling, Coaching and People. Start with 3 free profile reads. No card required.",
  isPartOf: { "@type": "WebSite", name: "profiletest.ai", url: "https://profiletest.app/" },
  about: { "@type": "SoftwareApplication", name: "MindCanvas" },
  primaryImageOfPage: {
    "@type": "ImageObject",
    url: "https://profiletest.app/profiletest-home/og-home.png",
  },
} as const;

export const demoMpsWebPageLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "MindCanvas MPS Demo | profiletest.ai",
  url: "https://profiletest.ai/demo-mps",
  description:
    "MindCanvas MPS demo for profiletest.ai. Coming soon. Book the sales demo or try the MCAS experience while we finish this page.",
  isPartOf: { "@type": "WebSite", name: "profiletest.ai", url: "https://profiletest.ai/" },
  about: { "@type": "SoftwareApplication", name: "profiletest.ai" },
  primaryImageOfPage: {
    "@type": "ImageObject",
    url: "https://profiletest.ai/og-home.png",
  },
} as const;

export const privacyWebPageLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Privacy Policy | profiletest.ai",
  url: "https://profiletest.ai/privacy-policy",
  description:
    "How Tema Resources Limited trading as ProfileTest.ai collects, uses, stores and protects personal data under UK GDPR and related laws.",
  isPartOf: { "@type": "WebSite", name: "profiletest.ai", url: "https://profiletest.ai/" },
  about: { "@type": "Organization", name: "profiletest.ai" },
  dateModified: "2026-02-26",
} as const;

export const termsWebPageLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Terms and Conditions | profiletest.ai",
  url: "https://profiletest.ai/terms-and-conditions",
  description:
    "Terms and Conditions for use of the ProfileTest.ai platform operated by Tema Resources Limited.",
  isPartOf: { "@type": "WebSite", name: "profiletest.ai", url: "https://profiletest.ai/" },
  about: { "@type": "Organization", name: "profiletest.ai" },
  dateModified: "2026-02-26",
} as const;

export const danielAcuttPersonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Daniel Acutt",
  url: "https://profiletest.ai/danielacutt",
  image: "https://profiletest.ai/daniel-acutt.jpg",
  jobTitle: "Founder",
  worksFor: {
    "@type": "Organization",
    name: "profiletest.ai",
    url: "https://profiletest.ai/",
  },
  description:
    "Founder of profiletest.ai. Behavioural intelligence, Becoming Human, and making selling more human in an AI world.",
  sameAs: [
    "https://www.linkedin.com/in/danielacutt/",
    "https://www.instagram.com/dannyacutt/",
    "https://www.youtube.com/@MyTemaApp",
    "https://www.linkedin.com/newsletters/7431693162709954560/",
    "https://open.spotify.com/show/4nxz3RKJ6Nch38UTL1AaJb",
    "https://danielacutt.com/",
  ],
  knowsAbout: [
    "Behavioural profiling",
    "Buyer psychology",
    "Predictive selling",
    "Becoming Human",
    "Artificial intelligence and humanity",
  ],
} as const;

export const danielAcuttWebPageLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Daniel Acutt | Media & Speaking",
  url: "https://profiletest.ai/danielacutt",
  description:
    "Media kit for Daniel Acutt: Becoming Human, speaking topics, podcasts, achievements, bios and booking enquiries.",
  isPartOf: { "@type": "WebSite", name: "profiletest.ai", url: "https://profiletest.ai/" },
  about: { "@id": "https://profiletest.ai/danielacutt#person" },
  primaryImageOfPage: {
    "@type": "ImageObject",
    url: "https://profiletest.ai/daniel-acutt.jpg",
  },
  dateModified: "2026-08-15",
} as const;
