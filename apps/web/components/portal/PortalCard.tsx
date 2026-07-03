// apps/web/components/portal/PortalCard.tsx
// The dark rounded card that hosts a titled section + optional form field.
// Pure components (no hooks) so they work in both server and client pages.

import type { ReactNode } from "react";
import { cardClass, labelClass } from "./ui";

// Titled section card: heading + optional description/actions + body.
export function PortalCard({
  title,
  description,
  actions,
  children,
  bodyClassName = "mt-5",
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
}) {
  return (
    <section className={`${cardClass} p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-extrabold leading-tight text-white">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-[12px] font-light text-white/[0.36]">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

// Field wrapper: label above control.
export function Field({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      {children}
    </div>
  );
}
