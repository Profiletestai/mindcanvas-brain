import "./globals.css";
import "../styles/branding.css";
import type { ReactNode } from "react";
import Script from "next/script";
import {
  DM_Sans,
  Inter,
  Manrope,
  Plus_Jakarta_Sans,
} from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./pdf-print.css";

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
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${manrope.variable} ${plusJakarta.variable} ${dmSans.variable}`}
    >
      {/* Inter remains the default font everywhere else in the platform. */}
      <body className={inter.className} suppressHydrationWarning>
        {children}

        {googleAnalyticsId ? (
          <GoogleAnalytics gaId={googleAnalyticsId} />
        ) : null}

        <Script
          id="ghl-chat-widget-loader"
          src="https://widgets.leadconnectorhq.com/loader.js"
          data-resources-url="https://widgets.leadconnectorhq.com/chat-widget/loader.js"
          data-widget-id="6a7c977a93aa928cd2874e74"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}

