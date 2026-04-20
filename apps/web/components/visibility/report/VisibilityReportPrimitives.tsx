// apps/web/components/visibility/report/VisibilityReportPrimitives.tsx
import type { CSSProperties, ReactNode } from "react";
import { BRAND } from "./VisibilityReportUtils";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen text-white" style={{ background: BRAND.bg }}>
      <div className="pointer-events-none fixed inset-0">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(1000px 520px at 12% 12%, rgba(79,125,255,0.22), transparent 58%)," +
              "radial-gradient(860px 460px at 86% 18%, rgba(69,224,209,0.12), transparent 56%)," +
              "radial-gradient(720px 520px at 50% 92%, rgba(139,92,246,0.10), transparent 60%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}

export function ReportPage({
  children,
  id,
}: {
  children: ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      data-pdf-page="true"
      className="block w-full"
      style={{ pageBreakAfter: "always" }}
    >
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

export function OuterCard({
  children,
  className = "",
  id,
  style,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      id={id}
      className={`rounded-[28px] border ${className}`}
      style={{
        borderColor: BRAND.border,
        background: "linear-gradient(180deg, rgba(17,55,97,0.88), rgba(9,28,52,0.92))",
        boxShadow: "0 14px 42px rgba(0,0,0,0.32)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function InnerPanel({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`rounded-[20px] border ${className}`}
      style={{
        borderColor: BRAND.borderSoft,
        background: "linear-gradient(180deg, rgba(39,66,102,0.72), rgba(20,39,66,0.80))",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <div
      className="inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold tracking-[0.18em] uppercase"
      style={{
        border: `1px solid ${BRAND.border}`,
        background: "rgba(255,255,255,0.05)",
        color: "rgba(255,255,255,0.86)",
      }}
    >
      {children}
    </div>
  );
}

export function TopButton({
  children,
  onClick,
  href,
  variant = "dark",
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: "dark" | "gradient";
}) {
  const className =
    "inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-[13px] font-semibold";

  const style =
    variant === "gradient"
      ? ({
          background: "linear-gradient(90deg, #45E0D1 0%, #4F7DFF 50%, #8B5CF6 100%)",
          color: "#071C36",
        } as const)
      : ({
          background: "rgba(8,22,43,0.72)",
          color: BRAND.white,
          border: `1px solid ${BRAND.border}`,
        } as const);

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        style={style}
      >
        {children}
      </a>
    );
  }

  return (
    <button className={className} style={style} onClick={onClick}>
      {children}
    </button>
  );
}

export function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <>
      <div className="text-[16px] font-semibold">{title}</div>
      {subtitle ? (
        <div className="mt-1 text-[13px]" style={{ color: BRAND.textDim }}>
          {subtitle}
        </div>
      ) : null}
    </>
  );
}