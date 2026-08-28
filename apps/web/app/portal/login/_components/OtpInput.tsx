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
    <div className="flex justify-between gap-2 sm:gap-2.5">
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
          aria-label={`Digit ${i + 1}`}
          autoComplete={i === 0 ? "one-time-code" : "off"}
          className="h-[52px] min-w-0 flex-1 rounded-[8px] border border-white/80 bg-white text-center text-[20px] font-extrabold text-black outline-none transition focus:border-[#4FA8D8] focus:ring-2 focus:ring-[#4FA8D8]/35 sm:h-[58px] sm:max-w-[52px]"
        />
      ))}
    </div>
  );
}

