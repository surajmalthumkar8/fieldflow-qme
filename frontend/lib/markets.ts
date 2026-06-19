// The markets a company serves are stored on Business.markets as a CSV of ISO
// country codes (e.g. "US,IN,FR") OR the single pseudo-code "GLOBAL" (worldwide).
// Multi-select; "Global" is exclusive (collapses to just GLOBAL).

import { COUNTRY_CODES, countryName } from "./countries";

export const GLOBAL = "GLOBAL";

const VALID = new Set<string>([...COUNTRY_CODES, GLOBAL]);

export function parseMarkets(csv: string | null | undefined): string[] {
  return (csv || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => VALID.has(s));
}

export function isGlobal(csv: string | null | undefined): boolean {
  return parseMarkets(csv).includes(GLOBAL);
}

// Compact label for tables: "Global", a few names, or "N countries".
export function marketsLabel(csv: string | null | undefined): string {
  const codes = parseMarkets(csv);
  if (codes.includes(GLOBAL)) return "Global";
  if (codes.length === 0) return "—";
  if (codes.length <= 3) return codes.map(countryName).join(", ");
  return `${codes.length} countries`;
}

// A company serves a region if it lists that country code or is Global.
export function servesRegion(csv: string | null | undefined, region: string): boolean {
  const codes = parseMarkets(csv);
  return codes.includes(GLOBAL) || codes.includes(region.toUpperCase());
}

// Sanitize a selected list to a stored CSV. "Global" collapses to just GLOBAL.
export function toMarketsCsv(codes: string[]): string {
  const valid = codes.map((c) => c.toUpperCase()).filter((c) => VALID.has(c));
  if (valid.includes(GLOBAL)) return GLOBAL;
  return Array.from(new Set(valid)).join(",");
}

// Pick a default scheduling timezone from the markets (only NY / IST supported
// today): US -> New York, India -> Kolkata, else New York.
export function tzForMarkets(codes: string[]): string {
  const up = codes.map((c) => c.toUpperCase());
  if (up.includes("US")) return "America/New_York";
  if (up.includes("IN")) return "Asia/Kolkata";
  return "America/New_York";
}
