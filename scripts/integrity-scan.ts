// Read-only sybil / concentration scan (STUDY-INTEGRITY.md, risk #1).
//
// Flags any session contributing an outsized share of a single contrast's
// COUNTED votes — the exact rows that can reach a published number. Pure
// monitoring: reads the ledger, writes nothing, touches no live path, and can
// never affect what a voter sees. Run it against any DATABASE_URL (local
// SQLite, or the production Postgres from an ops shell):
//
//   npx tsx scripts/integrity-scan.ts
//
// Tunables (env):
//   SCAN_MIN_N  minimum contrast n before a share is meaningful (default 10 —
//               below that a single honest 10-call session is trivially lumpy)
//   SCAN_SHARE  flag threshold for one session's share of a contrast (default 0.3)
//
// Exit codes: 0 = no flags, 2 = flags found (alarm-friendly for a nightly ops
// hook; distinct from 1 so a crash is never mistaken for a finding).
//
// The counted-vote definition is REUSED, not re-derived: getAnalyticsComparisons
// applies the ledger filter (decided, attentive, non-repeat, public-study), and
// the in-loop rules below mirror analytics.ts exactly (single contrast key,
// fidelity dropped). If analytics changes its contract, this scan follows it
// automatically for the DB half and must be updated in lockstep for the loop half.

import { PrismaClient } from "@prisma/client";
import { getAnalyticsComparisons } from "../src/lib/repo";

const MIN_N = Number(process.env.SCAN_MIN_N ?? 10);
const SHARE = Number(process.env.SCAN_SHARE ?? 0.3);

type Cell = { n: number; bySession: Map<string, number> };

async function main() {
  const comparisons = await getAnalyticsComparisons();

  const contrasts = new Map<string, Cell>();
  const perSessionTotal = new Map<string, number>();
  let counted = 0;

  for (const c of comparisons) {
    // Mirrors analytics.ts: only single-attribute, non-fidelity contrasts count.
    const attrs = c.contrastAttrs.split(",").filter(Boolean);
    if (attrs.length !== 1) continue;
    const attr = attrs[0];
    if (attr === "fidelity") continue;
    counted++;

    const winner = c.winnerId === c.variantAId ? c.variantA : c.variantB;
    const loser = c.winnerId === c.variantAId ? c.variantB : c.variantA;
    const a = winner[attr as keyof typeof winner] as string;
    const b = loser[attr as keyof typeof loser] as string;
    const [valueA, valueB] = [a, b].sort();
    const key = `${attr}:${valueA}|${valueB}`;

    const cell = contrasts.get(key) ?? { n: 0, bySession: new Map() };
    cell.n++;
    cell.bySession.set(c.sessionId, (cell.bySession.get(c.sessionId) ?? 0) + 1);
    contrasts.set(key, cell);
    perSessionTotal.set(c.sessionId, (perSessionTotal.get(c.sessionId) ?? 0) + 1);
  }

  const rows = [...contrasts.entries()]
    .map(([key, cell]) => {
      const [topSession, topCount] = [...cell.bySession.entries()].sort((x, y) => y[1] - x[1])[0];
      return {
        key,
        n: cell.n,
        sessions: cell.bySession.size,
        topSession,
        topCount,
        topShare: topCount / cell.n,
      };
    })
    .sort((x, y) => y.topShare - x.topShare);

  const flags = rows.filter((r) => r.n >= MIN_N && r.topShare >= SHARE);

  console.log(
    `integrity-scan · counted votes ${counted} · contrasts ${rows.length} · sessions ${perSessionTotal.size}`
  );
  console.log(`thresholds · contrast n ≥ ${MIN_N} · top-session share ≥ ${(SHARE * 100).toFixed(0)}%\n`);

  const line = (r: (typeof rows)[number], mark: string) =>
    console.log(
      `${mark} ${r.key.padEnd(46)} n=${String(r.n).padStart(4)}  sessions=${String(r.sessions).padStart(3)}  top-session ${(r.topShare * 100).toFixed(0).padStart(3)}% (${r.topCount}) ${r.topSession.slice(0, 18)}`
    );

  if (flags.length > 0) {
    console.log(`FLAGGED (${flags.length}) — one session dominates a published contrast:`);
    for (const r of flags) line(r, "⚠");
    console.log();
  }

  console.log("concentration (top 10 by top-session share):");
  for (const r of rows.slice(0, 10)) line(r, flags.includes(r) ? "⚠" : " ");

  console.log(
    flags.length > 0
      ? `\nresult: ${flags.length} flag(s). Read-only signal — investigate before any exclusion; the ledger stays authoritative.`
      : "\nresult: clean. No session dominates any contrast above threshold."
  );
  process.exitCode = flags.length > 0 ? 2 : 0;
}

main().finally(() => new PrismaClient().$disconnect());
