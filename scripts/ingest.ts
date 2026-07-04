/**
 * Public-source ingestion adapters (ROADMAP-2 §3). Every source lands as a
 * Finding(status=submitted) with provenance + a DRAFTED truth summary the
 * admin must confirm — then the normal pipeline: generation -> human review.
 *
 *   npx tsx scripts/ingest.ts fred CPIAUCSL      # needs FRED_API_KEY
 *   npx tsx scripts/ingest.ts edgar 0000320193   # SEC companyfacts (public, no key)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Draft = {
  title: string;
  domain: string;
  contextSnippet: string;
  sourceLabel: string;
  truthSummary: string;
  sourceUrl: string;
};

async function fred(seriesId: string): Promise<Draft> {
  const key = process.env.FRED_API_KEY;
  if (!key) throw new Error("FRED_API_KEY not set — get one free at fred.stlouisfed.org");
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${key}&file_type=json&sort_order=desc&limit=2`;
  const data = await (await fetch(url)).json();
  const [latest, prev] = data.observations;
  const change = (((+latest.value - +prev.value) / +prev.value) * 100).toFixed(1);
  return {
    title: `${seriesId}: latest reading`,
    domain: "econ",
    contextSnippet: `**${seriesId}, ${latest.date}:** ${latest.value} (prior ${prev.date}: ${prev.value})`,
    sourceLabel: `FRED series ${seriesId}, retrieved ${new Date().toISOString().slice(0, 10)}`,
    truthSummary: `${seriesId} was ${latest.value} on ${latest.date}, versus ${prev.value} on ${prev.date} (${change}% change). The movement is one observation of an ongoing series. Single-period data; says nothing about the trend beyond these two readings.`,
    sourceUrl: `https://fred.stlouisfed.org/series/${seriesId}`,
  };
}

async function edgar(cik: string): Promise<Draft> {
  const padded = cik.padStart(10, "0");
  const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${padded}.json`;
  // SEC asks for a real contact in the UA; override via SEC_CONTACT in prod.
  const contact = process.env.SEC_CONTACT ?? "contact@example.com";
  const res = await fetch(url, { headers: { "User-Agent": `JudgmentCall research ${contact}` } });
  if (!res.ok) throw new Error(`SEC EDGAR ${res.status}`);
  const data = await res.json();
  const revenues =
    data.facts?.["us-gaap"]?.Revenues ?? data.facts?.["us-gaap"]?.RevenueFromContractWithCustomerExcludingAssessedTax;
  if (!revenues) throw new Error("no revenue facts found");
  const annual = (revenues.units["USD"] as { end: string; val: number; form: string; fy: number }[])
    .filter((x) => x.form === "10-K")
    .sort((a, b) => b.end.localeCompare(a.end));
  const [latest, prev] = [annual[0], annual.find((x) => x.end < annual[0].end && x.fy === annual[0].fy - 1) ?? annual[1]];
  const pct = (((latest.val - prev.val) / prev.val) * 100).toFixed(1);
  const b = (v: number) => `$${(v / 1e9).toFixed(2)}B`;

  // Net income for the same fiscal periods, when filed — margin is pure
  // arithmetic on two filed values, so it's fair game for the truth summary.
  const niFacts = data.facts?.["us-gaap"]?.NetIncomeLoss;
  const niAnnual = niFacts
    ? (niFacts.units["USD"] as { end: string; val: number; form: string }[]).filter(
        (x) => x.form === "10-K"
      )
    : [];
  const ni = niAnnual.find((x) => x.end === latest.end);
  const niPrev = niAnnual.find((x) => x.end === prev.end);
  const margin = ni ? ((ni.val / latest.val) * 100).toFixed(1) : null;
  const marginPrev = niPrev ? ((niPrev.val / prev.val) * 100).toFixed(1) : null;
  const niSnippet = ni ? ` · net income ${b(ni.val)}${margin ? ` (${margin}% margin)` : ""}` : "";
  const niTruth = ni
    ? ` Net income for the same year was ${b(ni.val)} — a ${margin}% net margin${
        niPrev && marginPrev ? `, versus ${b(niPrev.val)} (${marginPrev}%) the prior year` : ""
      }.`
    : "";

  return {
    title: `${data.entityName}: annual revenue`,
    domain: "earnings",
    contextSnippet: `**${data.entityName} revenue (10-K):** ${b(latest.val)} (FY end ${latest.end}) · prior year ${b(prev.val)} (${pct}% change)${niSnippet}`,
    sourceLabel: `SEC EDGAR 10-K filings, retrieved ${new Date().toISOString().slice(0, 10)}`,
    truthSummary: `${data.entityName} reported annual revenue of ${b(latest.val)} for the fiscal year ending ${latest.end}, versus ${b(prev.val)} the prior year — a ${pct}% change.${niTruth} Filed figures only; says nothing about causes or future performance.`,
    sourceUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${padded}`,
  };
}

async function main() {
  const [adapter, arg] = process.argv.slice(2);
  if (!adapter || !arg) {
    console.error("usage: npx tsx scripts/ingest.ts <fred|edgar> <series-id|cik>");
    process.exit(1);
  }
  const draft = adapter === "fred" ? await fred(arg) : adapter === "edgar" ? await edgar(arg) : null;
  if (!draft) throw new Error(`unknown adapter ${adapter}`);

  // Idempotency: the same source re-ingested within 30 days is a no-op, so
  // re-running the pipeline (or a workflow input quirk) can't create dupes.
  const existing = await prisma.finding.findFirst({
    where: {
      sourceUrl: draft.sourceUrl,
      title: draft.title,
      retrievedAt: { gte: new Date(Date.now() - 30 * 86400_000) },
    },
  });
  if (existing) {
    console.log(`already ingested within 30d as ${existing.id}: ${existing.title} — skipping`);
    return;
  }

  const finding = await prisma.finding.create({
    data: {
      ...draft,
      status: "submitted", // admin confirms the drafted truth summary before generation
      retrievedAt: new Date(),
      staleAfter: new Date(Date.now() + 90 * 86400_000), // matchmaking stops serving after 90d
    },
  });
  console.log(`ingested as submitted finding ${finding.id}: ${finding.title}`);
  console.log("next: review/edit the truth summary, run scripts/generate.ts --submitted, approve in /admin/review");
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); }).finally(() => prisma.$disconnect());
