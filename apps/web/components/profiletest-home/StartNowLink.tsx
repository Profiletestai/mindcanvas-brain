"use client";

import type { MouseEvent, ReactNode } from "react";
import { EV, track, trackCta, type CtaLocation } from "@/lib/profiletest-home/analytics";
import {
  getStartedFree,
  getStartedFreeSubtext,
  startNowHref,
} from "@/lib/profiletest-home/site";

type StartNowLinkProps = {
  className?: string;
  children?: ReactNode;
  /**
   * Where this control sits on the page.
   * Becomes utm_content and the analytics cta_location.
   */
  location: CtaLocation;
  /** Fires on click before navigation (e.g. plan page conversion tracking). */
  onNavigate?: () => void;
  /**
   * Show label + small subtext inside the control (for primary buttons).
   * `true` uses getStartedFreeSubtext. Pass a string to override.
   * Omit for nav / soft links.
   */
  subtext?: boolean | string;
};

/**
 * Start Free Trial CTA. Goes straight to onboarding. No experience gate.
 * Appends utm_source=site and utm_content=<location> so the hop to
 * profiletest.app stays attributable.
 */
export default function StartNowLink({
  className,
  children = getStartedFree,
  location,
  onNavigate,
  subtext,
}: StartNowLinkProps) {
  const href = startNowHref(location);
  const subtextCopy =
    subtext === true
      ? getStartedFreeSubtext
      : typeof subtext === "string"
        ? subtext
        : null;

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onNavigate?.();
    const label =
      typeof children === "string" ? children : getStartedFree;
    trackCta("start_trial", label, location, href);
    track(EV.TRIAL_START_CLICK, { cta_location: location });
    // Allow default navigation (including cmd/ctrl-click new tab).
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
  };

  const triggerClassName = subtextCopy
    ? [className, "btn--with-sub"].filter(Boolean).join(" ")
    : className;

  return (
    <a className={triggerClassName} href={href} onClick={onClick}>
      {subtextCopy ? (
        <span className="btn__stack">
          <span className="btn__label">{children}</span>
          <span className="btn__sub">{subtextCopy}</span>
        </span>
      ) : (
        children
      )}
    </a>
  );
}
