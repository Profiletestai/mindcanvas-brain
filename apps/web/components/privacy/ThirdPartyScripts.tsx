// apps/web/components/privacy/ThirdPartyScripts.tsx
"use client";

import { useEffect } from "react";
import Script from "next/script";
import { GoogleAnalytics } from "@next/third-parties/google";

import { useConsent } from "./ConsentProvider";

type ThirdPartyScriptsProps = {
  googleAnalyticsId?: string | null;
  highLevelWidgetId?: string | null;
};

export function ThirdPartyScripts({
  googleAnalyticsId,
  highLevelWidgetId,
}: ThirdPartyScriptsProps) {
  const { ready, consent } = useConsent();

  const analyticsAllowed =
    ready && consent?.analytics === true;

  const engagementAllowed =
    ready && consent?.engagement === true;

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !googleAnalyticsId
    ) {
      return;
    }

    (
      window as typeof window & Record<string, unknown>
    )[`ga-disable-${googleAnalyticsId}`] = !analyticsAllowed;
  }, [analyticsAllowed, googleAnalyticsId]);

  if (!ready) {
    return null;
  }

  return (
    <>
      {analyticsAllowed && googleAnalyticsId ? (
        <GoogleAnalytics gaId={googleAnalyticsId} />
      ) : null}

      {engagementAllowed && highLevelWidgetId ? (
        <Script
          id="ghl-chat-widget-loader"
          src="https://widgets.leadconnectorhq.com/loader.js"
          data-resources-url="https://widgets.leadconnectorhq.com/chat-widget/loader.js"
          data-widget-id={highLevelWidgetId}
          strategy="afterInteractive"
        />
      ) : null}
    </>
  );
}