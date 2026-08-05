"use client";

import type { CSSProperties, FormEventHandler, ReactNode } from "react";

/**
 * The white inner card + field/button styling shared by the portal auth
 * screens. Copied from app/(v2)/onboarding/v2/account/page.tsx rather than
 * refactored out of it, to keep the working signup funnel untouched.
 */

export const eyebrowStyle: CSSProperties = {
  fontWeight: 700,
  fontSize: "10px",
  lineHeight: "16px",
  letterSpacing: "1px",
  textTransform: "uppercase",
  color: "rgb(90,122,158)",
};

export const inputStyle: CSSProperties = {
  background: "rgb(240,246,255)",
  border: "1px solid rgb(208,224,240)",
  color: "rgb(24,44,62)",
};

export const inputClass =
  "w-full rounded-[10px] h-[46px] px-4 text-[14px] outline-none transition focus:bg-white";

export const cardStyle: CSSProperties = {
  background: "#fff",
  borderColor: "rgb(228,238,248)",
  padding: "32px 24px 24px 24px",
  boxShadow: "0px 2px 12px 0px rgba(13,45,94,0.06)",
};

export const cardClass = "mt-6 mx-auto w-full max-w-[480px] rounded-[14px] border";

export const submitStyle: CSSProperties = {
  background: "linear-gradient(180deg, rgb(6,94,144) 0%, rgb(42,137,190) 100%)",
  fontSize: "15px",
  letterSpacing: "0.2px",
  boxShadow: "0px 4px 16px 0px rgba(37,99,200,0.35)",
};

export const hintStyle: CSSProperties = {
  fontSize: "11px",
  lineHeight: "17.6px",
  color: "rgb(90,122,158)",
};

export function AuthFormCard({
  onSubmit,
  children,
}: {
  onSubmit?: FormEventHandler<HTMLFormElement>;
  children: ReactNode;
}) {
  if (!onSubmit) {
    return (
      <div className={cardClass} style={cardStyle}>
        {children}
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className={cardClass} style={cardStyle}>
      {children}
    </form>
  );
}

export function AuthField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block mb-1.5" style={eyebrowStyle}>
        {label}
      </span>
      {children}
    </label>
  );
}

export function AuthSubmitButton({
  disabled,
  children,
}: {
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className={`mt-6 w-full h-[52px] rounded-[12px] text-white font-bold tracking-wide ${
        disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"
      }`}
      style={submitStyle}
    >
      {children}
    </button>
  );
}
