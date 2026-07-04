/**
 * Offline unit tests for the public-source parse helpers. Fixtures below are
 * shaped exactly like the live APIs (World Bank v2, Frankfurter). Live fetch
 * can't run from a sandboxed environment, so this is the verification that the
 * transform + truth-summary logic is correct before the content workflow runs
 * the real network calls.
 *
 *   npx tsx scripts/ingest-parse.test.ts
 */
import { parseWorldBank, parseFrankfurter, oneYearBefore } from "./ingest-parse";

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

// ── World Bank: a rate indicator (GDP growth, annual %) ────────────────────
const wbGrowth = [
  { page: 1, pages: 1, per_page: 120, total: 64 },
  [
    { indicator: { value: "GDP growth (annual %)" }, country: { value: "United States" }, date: "2024", value: null },
    { indicator: { value: "GDP growth (annual %)" }, country: { value: "United States" }, date: "2023", value: 2.887 },
    { indicator: { value: "GDP growth (annual %)" }, country: { value: "United States" }, date: "2022", value: 2.512 },
    { indicator: { value: "GDP growth (annual %)" }, country: { value: "United States" }, date: "2021", value: 5.802 },
  ],
];
{
  const d = parseWorldBank(wbGrowth, "USA", "NY.GDP.MKTP.KD.ZG");
  console.log("World Bank (rate):", d.title);
  check("skips null + picks two newest", d.contextSnippet.includes("2023") && d.contextSnippet.includes("2022"));
  check("does not use 2021", !d.truthSummary.includes("2021"));
  check("formats as percent", d.contextSnippet.includes("2.9%") && d.contextSnippet.includes("2.5%"));
  check("rate change is percentage points", d.truthSummary.includes("percentage points"));
  check("disclaims trend/cause", /say(s)? nothing about/.test(d.truthSummary));
  check("domain econ", d.domain === "econ");
  check("sourceUrl is not sec.gov (fidelity allowed)", !d.sourceUrl.includes("sec.gov"));
  check("title names place + metric", d.title === "United States: GDP growth (annual %)");
}

// ── World Bank: a level indicator (GDP, current US$) ───────────────────────
const wbLevel = [
  { page: 1 },
  [
    { indicator: { value: "GDP (current US$)" }, country: { value: "India" }, date: "2023", value: 3549918918777.9 },
    { indicator: { value: "GDP (current US$)" }, country: { value: "India" }, date: "2022", value: 3353470449639.6 },
  ],
];
{
  const d = parseWorldBank(wbLevel, "IND", "NY.GDP.MKTP.CD");
  console.log("World Bank (level):", d.title);
  check("level formats in billions", d.contextSnippet.includes("3549.92B") || d.contextSnippet.includes("3549.92B"));
  check("level change is relative percent", /%\./.test(d.truthSummary) && d.truthSummary.includes("5.9%"));
}

// ── World Bank: guards ─────────────────────────────────────────────────────
{
  let threw = false;
  try {
    parseWorldBank([{ page: 1 }, [{ date: "2023", value: null }]], "USA", "X");
  } catch {
    threw = true;
  }
  check("throws when <2 non-null observations", threw);
  let threw2 = false;
  try {
    parseWorldBank({ message: "invalid" }, "USA", "X");
  } catch {
    threw2 = true;
  }
  check("throws on bad payload shape", threw2);
}

// ── Frankfurter: base strengthens ──────────────────────────────────────────
{
  const latest = { base: "USD", date: "2024-06-28", rates: { EUR: 0.9328 } };
  const hist = { base: "USD", date: "2023-06-27", rates: { EUR: 0.9165 } };
  const d = parseFrankfurter(latest, hist, "USD", "EUR");
  console.log("Frankfurter:", d.title);
  check("both fixings in context", d.contextSnippet.includes("0.9328") && d.contextSnippet.includes("0.9165"));
  check("computes ~1.8% move", d.truthSummary.includes("1.8%"));
  check("direction strengthened", d.truthSummary.includes("strengthened"));
  check("disclaims path/cause", /say(s)? nothing about/.test(d.truthSummary));
  check("domain econ", d.domain === "econ");
}

// ── Frankfurter: base weakens + missing-rate guard ─────────────────────────
{
  const latest = { base: "USD", date: "2024-06-28", rates: { JPY: 160.9 } };
  const hist = { base: "USD", date: "2023-06-28", rates: { JPY: 144.5 } };
  const d = parseFrankfurter(latest, hist, "USD", "JPY");
  check("JPY up => USD strengthened", d.truthSummary.includes("strengthened"));

  let threw = false;
  try {
    parseFrankfurter({ base: "USD", date: "x", rates: {} }, hist, "USD", "JPY");
  } catch {
    threw = true;
  }
  check("throws on missing quote rate", threw);
}

// ── oneYearBefore ──────────────────────────────────────────────────────────
check("oneYearBefore basic", oneYearBefore("2024-06-28") === "2023-06-28");
check("oneYearBefore leap-day", oneYearBefore("2024-02-29") === "2023-03-01");

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
