// apps/web/components/portal/PortalSidebar.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

type Props = {
  orgSlug: string;
};

type Child = {
  label: string;
  href?: string;
  disabled?: boolean;
};

type NavItem = {
  key: string;
  label: string;
  href?: string;
  icon: ReactNode;
  disabled?: boolean;
  match?: string;
  children?: Child[];
};

const iconProps = {
  width: 14,
  height: 14,
  viewBox: "0 0 14 14",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.44375,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const DashboardIcon = (
  <svg {...iconProps}>
    <path d="M5.075 1.3125H2.3625C1.7826 1.3125 1.3125 1.7826 1.3125 2.3625V5.075C1.3125 5.6549 1.7826 6.125 2.3625 6.125H5.075C5.6549 6.125 6.125 5.6549 6.125 5.075V2.3625C6.125 1.7826 5.6549 1.3125 5.075 1.3125Z" />
    <path d="M11.6375 1.3125H8.925C8.3451 1.3125 7.875 1.7826 7.875 2.3625V5.075C7.875 5.6549 8.3451 6.125 8.925 6.125H11.6375C12.2174 6.125 12.6875 5.6549 12.6875 5.075V2.3625C12.6875 1.7826 12.2174 1.3125 11.6375 1.3125Z" />
    <path d="M5.075 7.875H2.3625C1.7826 7.875 1.3125 8.3451 1.3125 8.925V11.6375C1.3125 12.2174 1.7826 12.6875 2.3625 12.6875H5.075C5.6549 12.6875 6.125 12.2174 6.125 11.6375V8.925C6.125 8.3451 5.6549 7.875 5.075 7.875Z" />
    <path d="M11.6375 7.875H8.925C8.3451 7.875 7.875 8.3451 7.875 8.925V11.6375C7.875 12.2174 8.3451 12.6875 8.925 12.6875H11.6375C12.2174 12.6875 12.6875 12.2174 12.6875 11.6375V8.925C12.6875 8.3451 12.2174 7.875 11.6375 7.875Z" />
  </svg>
);

const DatabaseIcon = (
  <svg {...iconProps}>
    <path d="M7 5.6875C9.65787 5.6875 11.8125 4.904 11.8125 3.9375C11.8125 2.971 9.65787 2.1875 7 2.1875C4.34213 2.1875 2.1875 2.971 2.1875 3.9375C2.1875 4.904 4.34213 5.6875 7 5.6875Z" />
    <path d="M2.1875 3.9375V6.5625C2.1875 7.525 4.375 8.3125 7 8.3125C9.625 8.3125 11.8125 7.525 11.8125 6.5625V3.9375" />
    <path d="M2.1875 6.5625V9.1875C2.1875 10.15 4.375 10.9375 7 10.9375C9.625 10.9375 11.8125 10.15 11.8125 9.1875V6.5625" />
  </svg>
);

const TestsIcon = (
  <svg {...iconProps}>
    <path d="M2.625 7H11.375M7 2.625V11.375" />
    <path d="M10.9375 1.3125H3.0625C2.096 1.3125 1.3125 2.096 1.3125 3.0625V10.9375C1.3125 11.904 2.096 12.6875 3.0625 12.6875H10.9375C11.904 12.6875 12.6875 11.904 12.6875 10.9375V3.0625C12.6875 2.096 11.904 1.3125 10.9375 1.3125Z" />
  </svg>
);

const ProfileIcon = (
  <svg {...iconProps}>
    <path d="M7 7.4375C8.44975 7.4375 9.625 6.26225 9.625 4.8125C9.625 3.36275 8.44975 2.1875 7 2.1875C5.55025 2.1875 4.375 3.36275 4.375 4.8125C4.375 6.26225 5.55025 7.4375 7 7.4375Z" />
    <path d="M1.75 12.6875C1.75 10.0625 4.1125 7.875 7 7.875C9.8875 7.875 12.25 10.0625 12.25 12.6875" />
  </svg>
);

const ResourcesIcon = (
  <svg {...iconProps}>
    <path d="M2.625 1.75H8.75L11.375 4.375V12.25C11.375 12.4821 11.2828 12.7046 11.1187 12.8687C10.9546 13.0328 10.7321 13.125 10.5 13.125H2.625C2.39294 13.125 2.17038 13.0328 2.00628 12.8687C1.84219 12.7046 1.75 12.4821 1.75 12.25V2.625C1.75 2.39294 1.84219 2.17038 2.00628 2.00628C2.17038 1.84219 2.39294 1.75 2.625 1.75Z" />
    <path d="M8.75 1.75V4.375H11.375M4.375 6.5625H9.625M4.375 9.1875H7.875" />
  </svg>
);

export default function PortalSidebar({ orgSlug }: Props) {
  const pathname = usePathname() ?? "";
  const base = `/portal/${orgSlug}`;

  const items: NavItem[] = [
    {
      key: "dashboard",
      label: "Dashboard",
      href: `${base}/dashboard`,
      match: `${base}/dashboard`,
      icon: DashboardIcon,
    },
    {
      key: "database",
      label: "Database",
      href: `${base}/database`,
      match: `${base}/database`,
      icon: DatabaseIcon,
    },
    {
      key: "tests",
      label: "Tests",
      href: `${base}/tests`,
      match: `${base}/tests`,
      icon: TestsIcon,
      children: [
        { label: "Created test links", href: `${base}/links` },
      ],
    },
    {
      key: "profile",
      label: "Profile",
      href: `${base}/profile`,
      match: `${base}/profile`,
      icon: ProfileIcon,
      children: [
        { label: "Personal details", href: `${base}/profile#personal` },
        { label: "Organisation", href: `${base}/profile#organisation` },
        { label: "Branding details", href: `${base}/profile#branding` },
        { label: "Email settings", href: `${base}/profile#email` },
        { label: "Billing", href: `/portal/billing` },
        { label: "Setup checklist", disabled: true },
        { label: "Add users", href: `/portal/people` },
      ],
    },
    {
      key: "resources",
      label: "Resources",
      icon: ResourcesIcon,
      disabled: true,
    },
  ];

  const isActive = (item: NavItem) => {
    if (item.match && pathname.startsWith(item.match)) return true;
    if (item.key === "tests" && pathname.startsWith(`${base}/links`)) return true;
    return false;
  };

  const childActive = (c: Child) =>
    !!c.href && pathname === c.href.split("#")[0] && c.href.startsWith(base);

  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    const active = items.find((i) => i.children && isActive(i));
    if (active) setOpen(active.key);
  }, [pathname]);

  return (
    <aside
      style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
      className="flex h-full min-h-screen w-56 shrink-0 flex-col border-r border-neutral-200 bg-white text-[#9CA3AF]"
    >
      {/* Logo */}
      <div className="flex items-center gap-2 pb-5 pt-6 pl-[15px] pr-5">
        <Image
          src="/images/profile-test-ai-logo.png"
          alt="profiletest.ai"
          width={150}
          height={70}
          className="h-[70px] w-[150px] object-contain"
          priority
        />
      </div>

      <nav className="flex flex-1 flex-col gap-2 overflow-y-auto pb-6">
        {items.map((item) => {
          const active = isActive(item);
          const hasChildren = !!item.children?.length;
          const expanded = open === item.key;

          const rowClass = [
            "group relative flex h-[30px] items-center gap-[18px] border-l-[3px] px-3 text-[12.5px] font-medium leading-none",
            item.disabled
              ? "cursor-not-allowed border-transparent text-neutral-300"
              : active
                ? "border-[rgba(84,175,224,1)] bg-[rgba(84,175,224,0.1)] text-[rgba(84,175,224,1)]"
                : "border-transparent text-[#9CA3AF]",
          ].join(" ");

          const inner = (
            <>
              <span className="shrink-0">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
            </>
          );

          return (
            <div key={item.key}>
              {item.disabled ? (
                <div className={rowClass} aria-disabled title="Coming soon">
                  {inner}
                </div>
              ) : (
                <Link
                  href={item.href ?? "#"}
                  className={rowClass}
                  onClick={() => {
                    setOpen(hasChildren && !expanded ? item.key : null);
                  }}
                >
                  {inner}
                </Link>
              )}

              {hasChildren && expanded && (
                <div className="mb-1 ml-[2.4rem] mt-0.5 flex flex-col">
                  {item.children!.map((c) => {
                    const cActive = childActive(c);
                    const cClass = [
                      "py-1.5 pl-4 pr-3 text-[12.5px] font-medium leading-none",
                      c.disabled
                        ? "cursor-not-allowed text-neutral-300"
                        : cActive
                          ? "text-[rgba(84,175,224,1)]"
                          : "text-[#9CA3AF]",
                    ].join(" ");

                    if (c.disabled || !c.href) {
                      return (
                        <span key={c.label} className={cClass} title="Coming soon">
                          {c.label}
                        </span>
                      );
                    }
                    return (
                      <Link key={c.label} href={c.href} className={cClass}>
                        {c.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
