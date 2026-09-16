"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from "react";

export type SiteNavItem = {
  label: string;
  href: string;
};

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

type SiteHeaderProps = {
  items: readonly SiteNavItem[];
  /** Logo destination. Home uses `#top`; other pages use `/`. */
  logoHref?: string;
  /** Href of the current page item (renders as `aria-current`). */
  currentHref?: string;
  /** Optional personalised greeting beside the logo (e.g. plan page first name). */
  greeting?: string;
  cta?: ReactNode;
};

/**
 * Shared site chrome. Labels and order come from `app/lib/site.ts` per page.
 * ≤960px: hamburger + slide-down panel so in-page links stay reachable.
 */
export default function SiteHeader({
  items,
  logoHref = "/",
  currentHref,
  greeting,
  cta,
}: SiteHeaderProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 960) setOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const logo = logoHref.startsWith("#") ? (
    <a className="logo" href={logoHref} aria-label="profiletest.ai home" onClick={close}>
      <BrandMark />
    </a>
  ) : (
    <Link className="logo" href={logoHref} aria-label="profiletest.ai home" onClick={close}>
      <BrandMark />
    </Link>
  );

  const renderItem = (item: SiteNavItem) => {
    if (currentHref && item.href === currentHref) {
      return (
        <span key={`${item.label}-${item.href}`} className="nav-current" aria-current="page">
          {item.label}
        </span>
      );
    }

    if (item.href.startsWith("#") || item.href.startsWith("http")) {
      return (
        <a key={`${item.label}-${item.href}`} href={item.href} onClick={close}>
          {item.label}
        </a>
      );
    }

    return (
      <Link key={`${item.label}-${item.href}`} href={item.href} onClick={close}>
        {item.label}
      </Link>
    );
  };

  return (
    <header className={open ? "nav is-open" : "nav"}>
      <div className="wrap nav__bar">
        <div className="nav__brand">
          {logo}
          {greeting ? <p className="nav__greeting">{greeting}</p> : null}
        </div>
        <div className="nav__actions">
          <button
            type="button"
            className="nav__toggle"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="nav__toggle-bars" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
          <nav className="nav__desktop" aria-label="Primary">
            {items.map(renderItem)}
            <Link href="/portal/login" onClick={close}>
              Log in
            </Link>
            {cta}
          </nav>
          {cta ? <div className="nav__cta-mobile">{cta}</div> : null}
        </div>
      </div>

      <div
        id={panelId}
        className="nav__panel"
        hidden={!open}
        aria-hidden={!open}
      >
        <div className="wrap">
          <nav className="nav__mobile" aria-label="Mobile">
            {items.map(renderItem)}
            <Link href="/portal/login" onClick={close}>
              Log in
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
