/**
 * Pure parse helpers for the public-source ingestion adapters. No network, no
 * Prisma — every function takes an already-fetched payload and returns a Draft,
 * so the transformation logic is unit-testable offline (the live fetch in
 * scripts/ingest.ts can't run from a sandboxed environment). See
 * scripts/ingest-parse.test.ts for fixtures recorded from the real APIs.
 *
 * The truthSummary each function drafts is the ground truth every faithful
 * telling must respect, so it states exactly what two readings support and,
 * explicitly, what they do NOT (trend, path between them, causes).
 */

export type Draft = {
  title: string;
  domain: string;
  contextSnippet: string;
  sourceLabel: string;
  truthSummary: string;
  sourceUrl: string;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

// ── World Bank Open Data ──────────────────────────────────────────────────
// GET https://api.worldbank.org/v2/country/{ISO3}/indicator/{code}?format=json
// -> [ {page metadata}, [ {indicator:{value}, country:{value}, date, value}, … ] ]
// Values run newest-... but can be null for recent years; we take the two most
// recent non-null annual observations.

type WBObs = {
  indicator?: { value?: string };
  country?: { value?: string };
  date: string;
  value: number | null;
};

export function parseWorldBank(payload: unknown, country: string, indicator: string): Draft {
  if (!Array.isArray(payload) || payload.length < 2 || !Array.isArray(payload[1])) {
    throw new Error("World Bank: unexpected payload shape");
  }
  const obs = (payload[1] as WBObs[])
    .filter((o) => o && o.value != null && typeof o.value === "number")
    .sort((a, b) => b.date.localeCompare(a.date));
  if (obs.length < 2) throw new Error("World Bank: need two non-null observations");
  const [latest, prev] = obs;
  const metric = latest.indicator?.value ?? indicator;
  const place = latest.country?.value ?? country;
  // A "%"-named indicator (GDP growth, inflation, unemployment) is already a
  // rate — its honest movement is a difference in percentage points, never a
  // percent-of-a-percent. A level indicator (GDP in $, population) moves by a
  // relative percent. Word the truth summary to match, so no faithful telling
  // can be tripped by an ambiguous "change".
  const isRate = /%|percent|rate|growth/i.test(metric);
  const fmt = (v: number) =>
    isRate ? `${v.toFixed(1)}%` : v >= 1e9 ? `${(v / 1e9).toFixed(2)}B` : v.toLocaleString("en-US");
  const change = isRate
    ? `${(latest.value! - prev.value!).toFixed(1)} percentage points`
    : `${(((latest.value! - prev.value!) / Math.abs(prev.value!)) * 100).toFixed(1)}%`;
  return {
    title: `${place}: ${metric}`,
    domain: "econ",
    contextSnippet: `**${place} — ${metric}:** ${fmt(latest.value!)} (${latest.date}) · prior ${fmt(
      prev.value!
    )} (${prev.date})`,
    sourceLabel: `World Bank Open Data (${indicator}), retrieved ${iso(new Date())}`,
    truthSummary: `${place} recorded ${metric} of ${fmt(latest.value!)} in ${latest.date}, versus ${fmt(
      prev.value!
    )} in ${prev.date} — a change of ${change}. These are two annual observations; they say nothing about the path between the years, the trend before or after, or any cause.`,
    sourceUrl: `https://data.worldbank.org/indicator/${indicator}?locations=${country}`,
  };
}

// ── Frankfurter (ECB euro reference rates) ────────────────────────────────
// GET https://api.frankfurter.app/latest?from={BASE}&to={QUOTE}
// GET https://api.frankfurter.app/{YYYY-MM-DD}?from={BASE}&to={QUOTE}
// -> { amount, base, date, rates: { [QUOTE]: number } }

type FxDay = { base: string; date: string; rates: Record<string, number> };

export function parseFrankfurter(latest: FxDay, historical: FxDay, base: string, quote: string): Draft {
  const now = latest.rates?.[quote];
  const then = historical.rates?.[quote];
  if (typeof now !== "number" || typeof then !== "number") {
    throw new Error(`Frankfurter: missing ${quote} rate`);
  }
  const pct = (((now - then) / then) * 100).toFixed(1);
  // base buys MORE quote -> base has strengthened against quote.
  const dir = now >= then ? "strengthened" : "weakened";
  return {
    title: `${base}/${quote}: reference rate, year over year`,
    domain: "econ",
    contextSnippet: `**${base}/${quote} (ECB reference rate):** ${now.toFixed(4)} on ${latest.date} · ${then.toFixed(
      4
    )} on ${historical.date}`,
    sourceLabel: `ECB reference rates via Frankfurter, retrieved ${iso(new Date())}`,
    truthSummary: `One ${base} bought ${now.toFixed(4)} ${quote} on ${latest.date}, versus ${then.toFixed(
      4
    )} ${quote} on ${historical.date} — the ${base} ${dir} ${Math.abs(+pct)}% against the ${quote} between those two days. These are two single-day fixings about a year apart; they say nothing about the path between them, the volatility along the way, or the causes.`,
    sourceUrl: `https://www.frankfurter.app/`,
  };
}

/** The ISO date ~one year before `date` (YYYY-MM-DD in, YYYY-MM-DD out). */
export function oneYearBefore(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return iso(d);
}
