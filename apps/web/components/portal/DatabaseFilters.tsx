"use client";

// apps/web/components/portal/DatabaseFilters.tsx
// Filter bar for the Database page. Auto-submits (debounced search) by
// pushing the active filters into the URL search params.

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type TestOption = { id: string; label: string };

type Props = {
  tests: TestOption[];
  purposeOptions: string[];
  initialQ: string;
  initialTestId: string;
  initialPurpose: string;
  initialStatus: string;
  initialSort: string;
};

const selectClass =
  "h-[28px] appearance-none rounded-[8px] border border-white/[0.08] bg-white/[0.04] pl-[12px] pr-[10px] text-[11.5px] font-medium leading-[14.67px] text-white/[0.62] outline-none [&>option]:bg-slate-900";

const fontFamily = '"Plus Jakarta Sans", sans-serif';

function Chevron() {
  return (
    <svg
      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export default function DatabaseFilters({
  tests,
  purposeOptions,
  initialQ,
  initialTestId,
  initialPurpose,
  initialStatus,
  initialSort,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(initialQ);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Push a set of param overrides into the URL (resets to page 1).
  const apply = useCallback(
    (overrides: Record<string, string>) => {
      const usp = new URLSearchParams(searchParams.toString());
      Object.entries(overrides).forEach(([key, value]) => {
        if (value) usp.set(key, value);
        else usp.delete(key);
      });
      usp.delete("page");
      const qs = usp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  // Debounced search submit.
  useEffect(() => {
    if (q === initialQ) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => apply({ q }), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or email…"
          style={{ fontFamily, width: 457, maxWidth: "100%" }}
          className="h-[28px] rounded-[8px] border border-white/[0.08] bg-white/[0.04] pl-[32px] pr-3 text-[11.5px] font-normal leading-none text-white/[0.36] placeholder:text-white/[0.36] outline-none"
        />
      </div>

      <div className="relative">
        <select
          value={initialTestId}
          onChange={(e) => apply({ testId: e.target.value })}
          style={{ fontFamily, width: 148.67 }}
          className={selectClass}
        >
          <option value="">All models</option>
          {tests.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <Chevron />
      </div>

      <div className="relative">
        <select
          value={initialStatus}
          onChange={(e) => apply({ status: e.target.value })}
          style={{ fontFamily, width: 120 }}
          className={selectClass}
        >
          <option value="">All status</option>
          <option value="completed">Completed</option>
          <option value="incomplete">Incomplete</option>
        </select>
        <Chevron />
      </div>

      <div className="relative">
        <select
          value={initialSort}
          onChange={(e) => apply({ sort: e.target.value })}
          style={{ fontFamily, width: 110.67 }}
          className={selectClass}
        >
          <option value="created_desc">All dates</option>
          <option value="created_asc">Oldest first</option>
          <option value="company_asc">Company A → Z</option>
          <option value="company_desc">Company Z → A</option>
        </select>
        <Chevron />
      </div>

      <div className="relative">
        <select
          value={initialPurpose}
          onChange={(e) => apply({ purpose: e.target.value })}
          style={{ fontFamily, width: 81.33 }}
          className={selectClass}
        >
          <option value="">All tags</option>
          {purposeOptions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <Chevron />
      </div>
    </div>
  );
}
