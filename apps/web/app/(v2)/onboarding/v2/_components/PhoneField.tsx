"use client";

import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export function PhoneField({ value, onChange }: Props) {
  return (
    <div className="onb-phone">
      <PhoneInput
        international
        defaultCountry="US"
        value={value || undefined}
        onChange={(v) => onChange(v ?? "")}
        className="rounded-xl bg-white/5 border border-white/15 px-3 py-2.5"
      />
      <style jsx global>{`
        .onb-phone .PhoneInputInput {
          background: transparent;
          border: none;
          outline: none;
          color: white;
          flex: 1;
        }
        .onb-phone .PhoneInputInput::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }
        .onb-phone .PhoneInputCountrySelect {
          color: black;
        }
        .onb-phone .PhoneInputCountryIcon {
          background: white;
          padding: 1px;
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
}
