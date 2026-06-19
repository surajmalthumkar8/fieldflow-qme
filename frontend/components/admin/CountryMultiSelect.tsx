"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Globe, Search, X } from "lucide-react";
import { allCountries, countryName } from "@/lib/countries";
import { GLOBAL } from "@/lib/markets";

export function CountryMultiSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (codes: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const countries = useMemo(() => allCountries(), []);
  const isGlobal = value.includes(GLOBAL);

  // Close on outside click.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return countries;
    return countries.filter(
      (c) => c.name.toLowerCase().includes(needle) || c.code.toLowerCase().includes(needle)
    );
  }, [q, countries]);

  function toggleGlobal() {
    onChange(isGlobal ? [] : [GLOBAL]);
  }
  function toggleCountry(code: string) {
    if (isGlobal) return; // countries are disabled while Global is on
    onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code]);
  }
  function remove(code: string) {
    onChange(value.filter((c) => c !== code));
  }

  return (
    <div className="relative" ref={ref}>
      {/* Control: selected chips + open button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-[42px] w-full flex-wrap items-center gap-1.5 rounded-lg border border-ink-200 px-2.5 py-1.5 text-left text-sm focus:border-signal-400 focus:outline-none dark:border-ink-700 dark:bg-ink-800"
      >
        {value.length === 0 ? (
          <span className="text-ink-400">Select countries…</span>
        ) : isGlobal ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-signal-50 px-2 py-0.5 text-xs font-medium text-signal-700 dark:bg-signal-500/15 dark:text-signal-300">
            <Globe className="h-3 w-3" /> Global (worldwide)
          </span>
        ) : (
          value.map((code) => (
            <span
              key={code}
              className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-700 dark:bg-ink-700 dark:text-ink-200"
            >
              {countryName(code)}
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  remove(code);
                }}
                className="rounded-full p-0.5 hover:bg-ink-200 dark:hover:bg-ink-600"
              >
                <X className="h-3 w-3" />
              </span>
            </span>
          ))
        )}
        <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-ink-400" />
      </button>

      {/* Dropdown */}
      {open ? (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-ink-200 bg-white shadow-lg dark:border-ink-700 dark:bg-ink-900">
          <div className="flex items-center gap-2 border-b border-ink-100 px-3 py-2 dark:border-ink-800">
            <Search className="h-4 w-4 text-ink-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search countries…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-ink-400 dark:text-ink-100"
            />
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            {/* Global pinned on top */}
            <button
              type="button"
              onClick={toggleGlobal}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-paper-50 dark:hover:bg-ink-800"
            >
              <span className={`flex h-4 w-4 items-center justify-center rounded border ${isGlobal ? "border-signal-500 bg-signal-500 text-white" : "border-ink-300 dark:border-ink-600"}`}>
                {isGlobal ? <Check className="h-3 w-3" /> : null}
              </span>
              <Globe className="h-4 w-4 text-signal-500" />
              Global (worldwide)
            </button>
            <div className="my-1 border-t border-ink-100 dark:border-ink-800" />

            {isGlobal ? (
              <p className="px-3 py-2 text-xs text-ink-400">
                Global is selected — it covers every country. Deselect Global to choose specific countries.
              </p>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-ink-400">No match.</p>
            ) : (
              filtered.map((c) => {
                const sel = value.includes(c.code);
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => toggleCountry(c.code)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-paper-50 dark:hover:bg-ink-800"
                  >
                    <span className={`flex h-4 w-4 items-center justify-center rounded border ${sel ? "border-signal-500 bg-signal-500 text-white" : "border-ink-300 dark:border-ink-600"}`}>
                      {sel ? <Check className="h-3 w-3" /> : null}
                    </span>
                    <span className="text-ink-700 dark:text-ink-200">{c.name}</span>
                    <span className="ml-auto text-[11px] text-ink-400">{c.code}</span>
                  </button>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between border-t border-ink-100 px-3 py-2 text-xs dark:border-ink-800">
            <span className="text-ink-400">
              {isGlobal ? "Global" : `${value.length} selected`}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="font-semibold text-signal-600 hover:text-signal-700 dark:text-signal-400"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
