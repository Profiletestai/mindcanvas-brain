import "./profiletest-home.css";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import QuoteWall from "@/components/profiletest-home/QuoteWall";
import Reveal from "@/components/profiletest-home/Reveal";
import SiteHeader from "@/components/profiletest-home/SiteHeader";
import StartNowLink from "@/components/profiletest-home/StartNowLink";
import { appWebPageLd } from "@/lib/profiletest-home/schema";
import {
  appNav,
  links,
} from "@/lib/profiletest-home/site";

const canonical = "https://profiletest.app/";
const description =
  "Welcome to MindCanvas. Behavioural intelligence for Selling, Coaching and People. Start with 3 free profile reads. No card required.";

export const metadata: Metadata = {
  title: "MindCanvas | Welcome | profiletest.ai",
  description,
  alternates: {
    canonical,
  },
  openGraph: {
    title: "Welcome to MindCanvas | profiletest.ai",
    description,
    type: "website",
    locale: "en_GB",
    siteName: "profiletest.ai",
    url: canonical,
    images: [
      {
        url: "/profiletest-home/og-home.png",
        width: 1200,
        height: 630,
        alt: "Welcome to MindCanvas",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Welcome to MindCanvas | profiletest.ai",
    description,
    images: ["/profiletest-home/og-home.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

const engines = [
  {
    mark: "01",
    name: "Selling",
    role: "Revenue",
    job: "Know the buyer before the call. They get a report worth keeping. You get Insider Insights.",
    points: [
      "Strategic Growth Report for them",
      "Insider Insights for you",
      "Skins for entrepreneurs or corporate leaders",
    ],
  },
  {
    mark: "02",
    name: "Coaching",
    role: "Transformation",
    job: "Same intelligence, aimed at delivery and change. Sessions start from insight, not a blank page.",
    points: [
      "Client-facing developmental report",
      "Sessions that start warm, not blank",
    ],
  },
  {
    mark: "03",
    name: "People",
    role: "Human design & fit",
    job: "Fit, capacity and operating-style reads for hiring, teams and placement.",
    points: [
      "Career growth report for the person",
      "Private candidate summary for the decision",
    ],
  },
] as const;

function BrandMark() {
  return (
    <Image
      src="/profiletest-home/logo-white.png"
      alt="profiletest.ai"
      width={140}
      height={28}
      className="logo-img"
      priority
    />
  );
}

export default function AppWelcomePage() {
  return (
    <div className="profiletest-home app-welcome-page demo-page">
      <SiteHeader
        items={appNav}
        currentHref="/app"
        cta={
          <StartNowLink location="app" className="navcta navcta--sky">
            Start Free Trial
          </StartNowLink>
        }
      />

      <main id="top">
        {/* Welcome + lab = page header */}
        <section
          className="app-welcome-header engines"
          id="engines"
          aria-labelledby="app-engines-title"
        >
          <div className="engines__atmosphere" aria-hidden="true">
            <span className="engines__glow engines__glow--a" />
            <span className="engines__glow engines__glow--b" />
          </div>
          <div className="wrap">
            <div className="app-welcome-banner">
              <h1>
                Welcome to MindCanvas
                <span className="brand-tm">™</span>
                <span className="accent-dot">.</span>
              </h1>
              <p className="app-welcome-banner__powered">Powered by profiletest.ai</p>
            </div>

            <header className="engines__head">
              <p className="engines__eyebrow">The lab</p>
              <h2 className="engines__title" id="app-engines-title">
                One intelligence. Three&nbsp;engines.
              </h2>
              <p className="engines__lead">
                MindCanvas powers Selling (revenue), Coaching (transformation) and People (human
                design &amp; fit). Start where the conversation matters most.
              </p>
            </header>

            <div className="engines__trio" aria-label="Three engines">
              {engines.map((engine, i) => (
                <Reveal
                  key={engine.name}
                  as="article"
                  className={`engines__engine${i === 0 ? " engines__engine--entry" : ""}`}
                  delay={i * 80}
                >
                  <span className="engines__glyph" aria-hidden="true">
                    <i />
                  </span>
                  <p className="engines__mark">{engine.mark}</p>
                  <h3 className="engines__name">{engine.name}</h3>
                  <p className="engines__role">{engine.role}</p>
                  <p className="engines__job">{engine.job}</p>
                  <ul className="engines__points">
                    {engine.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </Reveal>
              ))}
            </div>

            <p className="app-welcome-clarify">
              One behavioural read. Three places to use it: revenue conversations, coaching delivery,
              and people decisions.
            </p>

            <div className="belief-cta belief-cta--on-dark">
              <div className="cta-row cta-row--center">
                <StartNowLink
                  location="app"
                  className="btn btn-white btn-lg"
                  subtext="3 profile reads included"
                >
                  Start Free Trial
                </StartNowLink>
              </div>
              <p className="cta-note">Nothing to lose. Possibly everything to gain.</p>
            </div>
          </div>
        </section>

        <QuoteWall />

        {/* Soft exit */}
        <section className="final" id="start" aria-labelledby="app-start-title">
          <div className="final__atmosphere" aria-hidden="true">
            <span className="final__glow final__glow--a" />
            <span className="final__glow final__glow--b" />
          </div>
          <div className="wrap">
            <p className="final__eyebrow">Ready when you are</p>
            <h2 className="final__title" id="app-start-title">
              Get started with MindCanvas
              <span className="brand-tm">™</span>
              <span className="accent-dot">.</span>
            </h2>
            <p className="final__lead">
              Three free profile reads. No card. Walk into the next conversation with the read
              already in your pocket.
            </p>
            <div className="final__cta">
              <StartNowLink
                location="app"
                className="btn btn-white btn-lg"
                subtext="3 profile reads included"
              >
                Start Free Trial
              </StartNowLink>
            </div>
            <p className="final__support">Nothing to lose. Possibly everything to gain.</p>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap">
          <Link className="logo" href="/" aria-label="profiletest.ai home">
            <BrandMark />
          </Link>
          <span className="tag">Behavioural intelligence, built into working systems.</span>
          <span className="legal">
            <a href="mailto:support@profiletest.ai">support@profiletest.ai</a>
            {" · "}
            &copy; 2026 Tema Resources Limited t/a profiletest.ai. All rights reserved. ·{" "}
            <Link href={links.privacy}>Privacy Policy</Link> · <Link href={links.terms}>Terms</Link>{" "}
            ·{" "}
            <button type="button" className="cookie-settings" data-cookie-settings>
              Cookie settings
            </button>
          </span>
        </div>
      </footer>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(appWebPageLd) }}
      />
    </div>
  );
}
