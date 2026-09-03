"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "p" | "h2" | "li";
  delay?: number;
};

/**
 * Unlock motion once the element enters the viewport.
 * Progressive: content stays visible without JS. Motion only enhances below-the-fold items.
 */
export default function Reveal({
  children,
  className = "",
  as: Tag = "div",
  delay = 0,
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  // Visible by default so SSR / failed hydration never blanks the page.
  const [on, setOn] = useState(true);
  const [motion, setMotion] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setOn(true);
      setMotion(false);
      return;
    }

    const rect = el.getBoundingClientRect();
    const inView = rect.top < window.innerHeight * 0.98 && rect.bottom > 20;
    if (inView) {
      setOn(true);
      setMotion(false);
      return;
    }

    // Below the fold: hide briefly, then reveal on scroll.
    setMotion(true);
    setOn(false);
  }, []);

  useEffect(() => {
    if (!motion || on) return;
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setOn(true);
          io.disconnect();
        }
      },
      // Early threshold so fade completes within ~300ms of entering view.
      { threshold: 0.1, rootMargin: "0px 0px -2% 0px" },
    );

    io.observe(el);

    // Safety: never leave content invisible.
    const failsafe = window.setTimeout(() => setOn(true), 1200);

    return () => {
      io.disconnect();
      window.clearTimeout(failsafe);
    };
  }, [motion, on]);

  return (
    <Tag
      ref={ref as never}
      className={`reveal${motion ? " reveal--motion" : ""}${on ? " is-in" : ""} ${className}`.trim()}
      style={delay ? ({ "--reveal-delay": `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}
