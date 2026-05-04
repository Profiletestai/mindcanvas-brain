"use client";

import { useMemo } from "react";
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import { selectClass } from "./Field";

countries.registerLocale(enLocale);

interface Props {
  value: string;
  onChange: (code: string) => void;
}

export function CountrySelect({ value, onChange }: Props) {
  const options = useMemo(() => {
    const all = countries.getNames("en", { select: "official" }) as Record<string, string>;
    return Object.entries(all)
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={selectClass}
    >
      <option value="">Select a country…</option>
      {options.map((o) => (
        <option key={o.code} value={o.code} className="text-black">
          {o.name}
        </option>
      ))}
    </select>
  );
}
