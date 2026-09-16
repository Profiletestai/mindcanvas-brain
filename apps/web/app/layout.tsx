// apps/web/app/layout.tsx

import "./globals.css";
import "../styles/branding.css";
import "./pdf-print.css";

import type { ReactNode } from "react";

import {
  DM_Sans,
  Inter,
  Manrope,
  Plus_Jakarta_Sans,
} from "next/font/google";

import { ConsentProvider } from "@/components/privacy/ConsentProvider";
import { CookieBanner } from "@/components/privacy/CookieBanner";
import { CookiePreferences } from "@/components/privacy/CookiePreferences";
import { CookieSettingsButton } from "@/components/privacy/CookieSettingsButton";
import { ThirdPartyScripts } from "@/components/privacy/ThirdPartyScripts";

/** Inter remains the default font across the existing platform. */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

/** Manrope remains available as an optional accent font. */
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

/** Used by the new public homepage and login experience. */
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

/** Used by primary buttons in the new public experience. */
const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const googleAnalyticsId =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || null;

/**
 * Existing production HighLevel / LeadConnector widget.
 *
 * Keeping the current widget ID here avoids changing the existing chat
 * configuration as part of the privacy remediation.
 */
const highLevelWidgetId =
  "6a7c977a93aa928cd2874e74";

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${manrope.variable} ${plusJakarta.variable} ${dmSans.variable}`}
    >
      <body
        className={inter.className}
        suppressHydrationWarning
      >
        <ConsentProvider
          googleAnalyticsId={googleAnalyticsId}
        >
          {children}

          <ThirdPartyScripts
            googleAnalyticsId={googleAnalyticsId}
            highLevelWidgetId={highLevelWidgetId}
          />

          <CookieBanner />

          <CookiePreferences />

          <CookieSettingsButton />
        </ConsentProvider>
      </body>
    </html>
  );
}

