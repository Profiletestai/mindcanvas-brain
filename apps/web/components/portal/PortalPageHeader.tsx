// apps/web/components/portal/PortalPageHeader.tsx
// Shared page header for portal pages: title + subtitle with optional
// right-aligned actions. Title/subtitle styles match the global PortalHeader.

import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
};

export default function PortalPageHeader({ title, subtitle, actions }: Props) {
  return (
    <header className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[20px] font-extrabold leading-[32px] tracking-[-0.4px] text-white">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-[12.5px] font-light leading-[20px] tracking-0 text-[rgba(255,255,255,0.36)]">
            {subtitle}
          </p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex shrink-0 items-center gap-3">{actions}</div>
      ) : null}
    </header>
  );
}
