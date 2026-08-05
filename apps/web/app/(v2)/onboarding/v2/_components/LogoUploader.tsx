"use client";

import { useRef, useState } from "react";
import { api, isErr } from "../_lib/api";

interface Props {
  value: string | null;
  onChange: (url: string | null) => void;
}

export function LogoUploader({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleFile = async (file: File | null) => {
    setErr(null);
    if (!file) return;
    setBusy(true);
    const res = await api.uploadLogo(file);
    setBusy(false);
    if (isErr(res)) {
      setErr(res.error);
      return;
    }
    onChange(res.url);
  };

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="relative h-20 w-20 rounded-xl border-2 border-dashed border-white/20 bg-white/5 hover:bg-white/10 flex items-center justify-center overflow-hidden transition"
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="logo" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs text-white/50">Upload</span>
        )}
      </button>
      <div className="flex-1">
        <div className="text-sm text-white/80">Logo</div>
        <div className="text-xs text-white/50">PNG, JPEG, or WebP. Max 2 MB.</div>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="mt-1 text-xs text-rose-300 hover:text-rose-200"
          >
            Remove
          </button>
        )}
        {busy && <div className="mt-1 text-xs text-white/60">Uploading…</div>}
        {err && <div className="mt-1 text-xs text-rose-400">{err}</div>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
