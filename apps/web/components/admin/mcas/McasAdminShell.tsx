//apps/web/components/admin/mcas/McasAdminShell.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type McasAdminShellProps = {
  children: React.ReactNode;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getSelectedOrgSlug(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);

  if (parts[0] !== "admin") return null;
  if (parts[1] !== "mcas") return null;

  const maybeOrg = parts[2];

  if (!maybeOrg) return null;
  if (maybeOrg === "validation") return null;

  return maybeOrg;
}

export default function McasAdminShell({ children }: McasAdminShellProps) {
  const pathname = usePathname();
  const selectedOrgSlug = getSelectedOrgSlug(pathname);

  const isHome = pathname === "/admin/mcas";
  const isValidation = pathname.startsWith("/admin/mcas/validation");

  const orgBasePath = selectedOrgSlug
    ? `/admin/mcas/${selectedOrgSlug}`
    : null;

  const topNav = [
    {
      label: "MCAS Home",
      href: "/admin/mcas",
      active: isHome,
    },
    {
      label: "Validation Centre",
      href: "/admin/mcas/validation",
      active: isValidation,
    },
  ];

  const orgNav =
    selectedOrgSlug && orgBasePath
      ? [
          {
            label: "Dashboard",
            href: orgBasePath,
            active: pathname === orgBasePath,
          },
          {
            label: "Database",
            href: `${orgBasePath}/database`,
            active: pathname.startsWith(`${orgBasePath}/database`),
          },
          {
            label: "Test Links",
            href: `${orgBasePath}/links`,
            active: pathname.startsWith(`${orgBasePath}/links`),
          },
        ]
      : [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="border-b border-white/10 bg-slate-950/95">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
                MindCanvas Admin
              </p>

              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                MCAS Platform
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Recruitment, candidate alignment, role profiling, and validation.
              </p>
            </div>

            {selectedOrgSlug ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Organisation Route
                </p>
                <p className="mt-1 font-mono text-sm text-white">
                  {selectedOrgSlug}
                </p>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {topNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cx(
                  "rounded-full border px-4 py-2 text-sm font-medium transition",
                  item.active
                    ? "border-cyan-300 bg-cyan-300 text-slate-950"
                    : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-cyan-300/60 hover:text-white",
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {orgNav.length > 0 ? (
            <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
              {orgNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cx(
                    "rounded-xl border px-4 py-2 text-sm font-medium transition",
                    item.active
                      ? "border-white bg-white text-slate-950"
                      : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/30 hover:text-white",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}