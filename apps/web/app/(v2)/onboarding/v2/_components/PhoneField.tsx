"use client";

import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function PhoneField({ value, onChange, placeholder = "Phone number" }: Props) {
  return (
    <div className="onb-phone">
      <PhoneInput
        international
        defaultCountry="US"
        value={value || undefined}
        onChange={(v) => onChange(v ?? "")}
        placeholder={placeholder}
        className="onb-phone-input"
      />
      <style jsx global>{`
        .onb-phone .onb-phone-input {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgb(240, 246, 255);
          border: 1px solid rgb(208, 224, 240);
          border-radius: 10px;
          height: 46px;
          padding: 0 12px;
        }
        .onb-phone .PhoneInputInput {
          background: transparent;
          border: none;
          outline: none;
          color: rgb(24, 44, 62);
          font-size: 14px;
          flex: 1;
          min-width: 0;
        }
        .onb-phone .PhoneInputInput::placeholder {
          color: rgb(140, 160, 185);
        }
        .onb-phone .PhoneInputCountry {
          display: flex;
          align-items: center;
          gap: 6px;
          color: rgb(24, 44, 62);
        }
        .onb-phone .PhoneInputCountrySelect {
          color: rgb(24, 44, 62);
        }
        .onb-phone .PhoneInputCountryIcon {
          background: transparent;
          box-shadow: none;
        }
        .onb-phone .PhoneInputCountryIcon--border {
          background: transparent;
          box-shadow: none;
        }
        .onb-phone .PhoneInputCountrySelectArrow {
          color: rgb(90, 122, 158);
          opacity: 1;
          border-color: rgb(90, 122, 158);
        }
      `}</style>
    </div>
  );
}
