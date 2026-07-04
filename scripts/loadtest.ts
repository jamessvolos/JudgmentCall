/**
 * Minimal dependency-free load harness for the hot vote loop (PERF-WAVES §5).
 * Spins up N virtual voters that each run GET /api/pair -> POST /api/vote as
 * fast as they can for DURATION seconds, and reports latency percentiles per
 * route. No new deps — plain fetch + a fixed-size worker pool.
 *
 *   BASE_URL=https://judgment-call.vercel.app CONCURRENCY=25 DURATION=20 \
 *     npx tsx scripts/loadtest.ts
 *
 * Budget (hobby tier, iad1, Neon us-east-1): p95 < 300ms at ~50 rps.
 * Run against a STAGING/preview deploy — it writes real votes.
 */
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 20);
const DURATION_S = Number(process.env.DURATION ?? 15);

type Sample = { route: string; ms: number; ok: boolean };
const samples: Sample[] = [];

async function timed(route: string, fn: () => Promise<Response>): Promise<Response | null> {
  const t0 = performance.now();
  try {
    const res = await fn();
    samples.push({ route, ms: performance.now() - t0, ok: res.ok });
    return res;
  } catch {
    samples.push({ route, ms: performance.now() - t0, ok: false });
    return null;
  }
}

async function voter(id: number, deadline: number): Promise<void> {
  const sessionId = `loadtest-${id}-${process.pid}-${Math.floor(performance.now())}`;
  const segments = ["executive", "analyst", "data_leader", "other"];
  await timed("session", () =>
    fetch(`${BASE_URL}/api/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, segment: segments[id % 4] }),
    })
  );

  while (performance.now() < deadline) {
    const pairRes = await timed("pair", () =>
      fetch(`${BASE_URL}/api/pair?sessionId=${encodeURIComponent(sessionId)}`)
    );
    if (!pairRes || !pairRes.ok) continue;
    const pair = await pairRes.json();
    if (!pair?.variantA) continue;
    // A realistic reader pauses; keep it short so we actually generate load.
    await new Promise((r) => setTimeout(r, 120));
    const winnerId = Math.random() < 0.5 ? pair.variantA.id : pair.variantB.id;
    await timed("vote", () =>
      fetch(`${BASE_URL}/api/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          variantAId: pair.variantA.id,
          variantBId: pair.variantB.id,
          winnerId,
          latencyMs: 900 + Math.floor(Math.random() * 800),
          clientVoteId: `${sessionId}-${Math.floor(performance.now())}-${Math.random()}`,
        }),
      })
    );
  }
}

function pct(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

async function main() {
  console.log(`Load test: ${CONCURRENCY} voters × ${DURATION_S}s against ${BASE_URL}`);
  const deadline = performance.now() + DURATION_S * 1000;
  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => voter(i, deadline)));

  const routes = [...new Set(samples.map((s) => s.route))];
  console.log(`\n${samples.length} requests in ~${DURATION_S}s (${(samples.length / DURATION_S).toFixed(1)} rps)\n`);
  console.log("route     count   ok%   p50     p95     p99     max");
  for (const route of routes) {
    const rs = samples.filter((s) => s.route === route);
    const ms = rs.map((s) => s.ms);
    const okPct = ((rs.filter((s) => s.ok).length / rs.length) * 100).toFixed(0);
    const f = (n: number) => `${n.toFixed(0)}ms`.padStart(7);
    console.log(
      `${route.padEnd(9)} ${String(rs.length).padStart(5)}  ${okPct.padStart(3)}%  ${f(pct(ms, 50))} ${f(pct(ms, 95))} ${f(pct(ms, 99))} ${f(Math.max(...ms))}`
    );
  }
  const votes = samples.filter((s) => s.route === "vote" && s.ok).length;
  console.log(`\ncounted votes cast: ~${votes}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
