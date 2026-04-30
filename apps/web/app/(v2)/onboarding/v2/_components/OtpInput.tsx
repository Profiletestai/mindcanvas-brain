"use client";

import { useEffect, useRef } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  autoFocus?: boolean;
}

export function OtpInput({ value, onChange, length = 6, autoFocus }: Props) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const setCharAt = (i: number, ch: string) => {
    const arr = value.padEnd(length, " ").split("");
    arr[i] = ch;
    onChange(arr.join("").trim());
  };

  const handleChange = (i: number, raw: string) => {
    const ch = raw.replace(/\D/g, "").slice(-1);
    if (!ch) return;
    setCharAt(i, ch);
    if (i < length - 1) refs.current[i + 1]?.focus();
  };

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const cur = value[i] ?? "";
      if (cur) {
        setCharAt(i, "");
      } else if (i > 0) {
        setCharAt(i - 1, "");
        refs.current[i - 1]?.focus();
      }
    }
    if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < length - 1) refs.current[i + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const txt = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!txt) return;
    e.preventDefault();
    onChange(txt);
    refs.current[Math.min(txt.length, length - 1)]?.focus();
  };

  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={handlePaste}
          className="h-14 w-12 text-center text-xl font-semibold rounded-xl bg-white/5 border border-white/15 text-white outline-none focus:border-[var(--brand-blue-light)] focus:ring-2 focus:ring-[var(--brand-blue-light)]/30"
        />
      ))}
    </div>
  );
}
