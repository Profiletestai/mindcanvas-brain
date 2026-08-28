import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

const MARKETING_URL = "https://profiletest.ai";
const ONBOARDING_URL = "/onboarding/v2";

const navItems = [
  {
    label: "Calculate Revenue",
    href: `${MARKETING_URL}/#calculator`,
  },
  {
    label: "Education",
    href: `${MARKETING_URL}/#education`,
  },
  {
    label: "How it Works",
    href: `${MARKETING_URL}/#how-it-works`,
  },
  {
    label: "Pricing",
    href: `${MARKETING_URL}/#pricing`,
  },
  {
    label: "Experts",
    href: `${MARKETING_URL}/#experts`,
  },
] as const;

function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2.5 text-white">
      <Image
        src="/profiletest.ai Insignia white.png"
        alt=""
        width={28}
        height={28}
        className="h-7 w-7 object-contain"
        priority
      />

      <span className="text-[22px] font-medium tracking-[0.01em]">
        profiletest.ai
        <sup className="ml-0.5 text-[8px]">®</sup>
      </span>
    </span>
  );
}

export function PublicHeader({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <header className="relative z-20 border-b border-white/[0.04] bg-[#07182b]">
      <div className="mx-auto flex h-[92px] w-full max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-[72px]">
        <Link href="/" aria-label="Profiletest.ai home">
          <Wordmark />
        </Link>

        <div className="flex items-center gap-3 sm:gap-4 lg:gap-7">
          {!compact ? (
            <nav
              className="hidden items-center gap-7 xl:flex"
              aria-label="Main navigation"
            >
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="text-[12.5px] text-white transition hover:text-[#64bae2]"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          ) : null}

          {!compact ? (
            <Link
              href="/portal/login"
              className="inline-flex items-center justify-center rounded-[8px] border border-white/20 px-4 py-3 text-[13px] font-semibold text-white transition hover:border-[#4FA8D8] hover:text-[#4FA8D8]"
            >
              Log in
            </Link>
          ) : null}

          <Link
            href={ONBOARDING_URL}
            className="hidden rounded-[9px] bg-white px-4 py-3 text-center text-[12px] font-bold text-[#005790] shadow-[0_8px_24px_rgba(79,168,216,0.22)] transition hover:-translate-y-0.5 sm:inline-flex sm:px-6 sm:text-[14px]"
          >
            Start with 3 free tests
          </Link>
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="relative z-20 bg-[#07182b] text-[#6B7686]">
      <div className="mx-auto w-full max-w-[1440px] px-5 py-7 sm:px-8 lg:px-[72px]">
        <div className="flex flex-col gap-5 border-b border-white/[0.08] pb-5 md:flex-row md:items-center md:justify-between">
          <Link href="/" aria-label="Profiletest.ai home">
            <Wordmark />
          </Link>

          <p className="text-[12.5px]">
            Behavioural Intelligence, built into working systems.
          </p>
        </div>

        <div className="flex flex-col gap-4 pt-5 text-[11.5px] sm:flex-row sm:items-center sm:justify-between">
          <p>
            © 2026 Tema Resources Limited t/a profiletest.ai. All rights
            reserved.
          </p>

          <div className="flex items-center gap-6">
            <a
              href={`${MARKETING_URL}/privacy-policy`}
              className="transition hover:text-white"
            >
              Privacy Policy
            </a>

            <a
              href={`${MARKETING_URL}/terms-and-conditions`}
              className="transition hover:text-white"
            >
              Terms
            </a>

            <Link href="/admin" className="transition hover:text-white">
              Admin
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function PublicPageShell({
  children,
  compactHeader = false,
}: {
  children: ReactNode;
  compactHeader?: boolean;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#040a12] text-white [font-family:var(--font-plus-jakarta)]">
      <PublicHeader compact={compactHeader} />

      <main className="flex flex-1 flex-col">{children}</main>

      <PublicFooter />
    </div>
  );
}