import type { CSSProperties, ReactNode } from "react";

type Props = {
  title: ReactNode;
  subtitle?: ReactNode;
  width?: number | string;
  minHeight?: number | string;
  titleNoWrap?: boolean;
  className?: string;
  children: ReactNode;
};

const DEFAULT_WIDTH = 655;
const DEFAULT_MIN_HEIGHT = 637;

export function StepCard({
  title,
  subtitle,
  width = DEFAULT_WIDTH,
  minHeight = DEFAULT_MIN_HEIGHT,
  titleNoWrap = true,
  className,
  children,
}: Props) {
  const w = typeof width === "number" ? `${width}px` : width;
  const mh = typeof minHeight === "number" ? `${minHeight}px` : minHeight;

  const style: CSSProperties = {
    background: "rgb(24,44,62)",
    border: "1px solid rgba(255,255,255,0.46)",
    borderRadius: "30px",
    ["--mc-step-w" as string]: w,
    ["--mc-step-mh" as string]: mh,
  };

  return (
    <div
      className={
        "relative px-12 pt-10 pb-16 w-full lg:w-[var(--mc-step-w)] lg:min-h-[var(--mc-step-mh)]" +
        (className ? ` ${className}` : "")
      }
      style={style}
    >
      <h2
        className={
          "text-center text-white font-bold" +
          (titleNoWrap ? " whitespace-nowrap" : "")
        }
        style={{
          fontSize: "38px",
          lineHeight: "43.7px",
          letterSpacing: "-0.5px",
        }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className="text-center mt-2"
          style={{
            color: "rgba(255,255,255,0.7)",
            fontSize: "14px",
            lineHeight: "24.5px",
          }}
        >
          {subtitle}
        </p>
      )}
      {children}
    </div>
  );
}
