"use client";

interface Props {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}

export function ColorSwatch({ label, value, onChange }: Props) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm text-white/80">{label}</span>
      <div className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/15 px-2 py-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 rounded-md bg-transparent cursor-pointer border-0"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-transparent text-white text-sm outline-none font-mono"
        />
      </div>
    </label>
  );
}
