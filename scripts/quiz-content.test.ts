/**
 * Content-integrity test for the Training Track seed pool. Locks the shape the
 * serving/grading path depends on: exactly one correct choice per item, valid
 * topic ids, non-empty prose, unique titles. Run: npx tsx scripts/quiz-content.test.ts
 */
import { QUIZ_SEEDS } from "../prisma/quiz";
import { TRACKS } from "../src/lib/train-tracks";

let failures = 0;
const ok = (cond: boolean, name: string) => {
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}`);
  if (!cond) failures++;
};

const titles = new Set<string>();
let dupTitles = 0;
const perTopic: Record<string, number> = {};

for (const q of QUIZ_SEEDS) {
  const track = TRACKS[q.track];
  const label = q.title;
  ok(!!track, `${label}: track "${q.track}" is a real track`);
  if (!track) continue;
  ok(track.topics.some((t) => t.id === q.topic), `${label}: topic "${q.topic}" exists in ${q.track}`);
  ok([1, 2, 3].includes(q.difficulty), `${label}: difficulty in 1..3`);
  ok(["mcq", "estimate", "duel", "bakeoff", "flood", "market", "redline", "pool", "gap", "payback"].includes(q.kind), `${label}: kind is one of the known kinds`);
  ok(!!q.scenario.trim() && !!q.prompt.trim() && !!q.explanation.trim(), `${label}: scenario/prompt/explanation non-empty`);
  if (q.kind === "mcq") {
    ok(q.choices.filter((c) => c.correct).length === 1, `${label}: exactly one correct choice`);
    ok(q.choices.length >= 2 && q.choices.length <= 5, `${label}: 2-5 choices`);
    ok(q.choices.every((c) => c.text.trim() && c.rationale.trim()), `${label}: every choice has text + rationale`);
  } else if (q.kind === "estimate") {
    const p = q.payload as { min: number; max: number; truth: number; good: { lo: number; hi: number } };
    ok(!!p && p.min < p.good.lo && p.good.lo < p.truth && p.truth < p.good.hi && p.good.hi < p.max, `${label}: estimate ordering invariant holds`);
    ok(q.choices.length === 0, `${label}: estimate carries no choices`);
  } else if (q.kind === "duel") {
    const p = q.payload as { better: string; designA: { name: string }; designB: { name: string }; alsoFits?: string };
    ok(!!p && (p.better === "A" || p.better === "B"), `${label}: duel better is A|B`);
    ok(!!p.designA?.name && !!p.designB?.name, `${label}: duel has two named designs`);
    ok(!!p.alsoFits && p.alsoFits.trim().length > 0, `${label}: duel has an "also defensible" note`);
  } else if (q.kind === "bakeoff") {
    const p = q.payload as { keys: { id: string; shards: number[] }[]; best: string };
    ok(!!p && p.keys.length >= 2, `${label}: bakeoff has >=2 candidate keys`);
    ok(p.keys.every((k) => Array.isArray(k.shards) && k.shards.length === 8), `${label}: every key has 8 shards`);
    const maxOf = (k: { shards: number[] }) => Math.max(...k.shards);
    const best = p.keys.find((k) => k.id === p.best)!;
    ok(!!best && p.keys.every((k) => k.id === p.best || maxOf(k) >= maxOf(best)), `${label}: best is the most balanced key`);
  } else if (q.kind === "flood") {
    const p = q.payload as { sensitivity: number; specificity: number; min: number; max: number; truth: number };
    // truth is the prevalence at which PPV = 50%: p·sens = (1−p)·(1−spec).
    const expected = Math.round(((100 - p.specificity) / (p.sensitivity + (100 - p.specificity))) * 100 * 10) / 10;
    ok(!!p && Math.abs(expected - p.truth) <= 0.15, `${label}: flood truth is the PPV-50 prevalence`);
    ok(p.min < p.truth && p.truth < p.max, `${label}: flood truth sits inside the slider range`);
    ok(q.choices.length === 0, `${label}: flood carries no choices`);
  } else if (q.kind === "market") {
    const p = q.payload as { lever: string; policy: number; demand: { a: number; b: number }; supply: { c: number; d: number }; truth: number; naive: number; tol: number; min: number; max: number };
    const { a, b } = p.demand, { c, d } = p.supply;
    const expected =
      p.lever === "none" ? (a - c) / (b + d)
      : p.lever === "tax" ? (a - c + d * p.policy) / (b + d)
      : c + d * p.policy; // ceiling short side
    ok(Math.abs(Math.round(expected * 100) / 100 - p.truth) <= 0.05, `${label}: market truth matches the linear model`);
    ok(p.min < p.truth && p.truth < p.max, `${label}: market truth sits inside the number-line`);
    ok(typeof p.naive === "number" && p.tol > 0, `${label}: market carries a naive value + tolerance`);
    ok(q.choices.length === 0, `${label}: market carries no choices`);
  } else if (q.kind === "redline") {
    const p = q.payload as { mu: number; slaMs: number; percentile: number; truth: number; naive: number; tol: number; min: number; max: number };
    // re-derive the knee: rho* = 1 - ln(1/(1-p))/(mu*SLA_seconds)
    const z = Math.log(1 / (1 - p.percentile / 100));
    const expected = (1 - z / (p.mu * (p.slaMs / 1000))) * 100;
    ok(Math.abs(Math.round(expected * 10) / 10 - p.truth) <= 0.1, `${label}: redline truth is the M/M/1 knee`);
    ok(p.min < p.truth && p.truth < p.max, `${label}: redline truth sits inside the slider`);
    ok(Math.abs(p.naive - p.truth) > p.tol, `${label}: redline naive is a genuine trap (outside tolerance)`);
    ok(q.choices.length === 0, `${label}: redline carries no choices`);
  } else if (q.kind === "gap") {
    type GapLine = { name: string; branches: { p: number; v: number }[] };
    const p = q.payload as { lineA: GapLine; lineB: GapLine; naiveRule: "mode" | "best" | "worst"; truth: number; naive: number; tol: number; min: number; max: number };
    const ev = (l: GapLine) => l.branches.reduce((s, br) => s + br.p * br.v, 0);
    const sum = (l: GapLine) => l.branches.reduce((s, br) => s + br.p, 0);
    const naiveOf = (l: GapLine) =>
      p.naiveRule === "best" ? Math.max(...l.branches.map((b) => b.v))
      : p.naiveRule === "worst" ? Math.min(...l.branches.map((b) => b.v))
      : l.branches.reduce((a, b) => (b.p > a.p ? b : a)).v;
    ok(Math.abs(sum(p.lineA) - 1) < 1e-6 && Math.abs(sum(p.lineB) - 1) < 1e-6, `${label}: gap — branch probabilities sum to 1`);
    ok(Math.abs(Math.round((ev(p.lineA) - ev(p.lineB)) * 10) / 10 - p.truth) <= 0.05, `${label}: gap truth is the exact ΔEV`);
    ok(Math.abs(naiveOf(p.lineA) - naiveOf(p.lineB) - p.naive) <= 0.05, `${label}: gap naive is the declared ${p.naiveRule}-rule recompute`);
    ok(p.min < 0 && 0 < p.max, `${label}: gap slider crosses zero`);
    ok(Math.abs(p.truth - p.naive) > 2 * p.tol, `${label}: gap naive is a genuine trap (outside 2·tol)`);
    ok(q.choices.length === 0, `${label}: gap carries no choices`);
  } else if (q.kind === "payback") {
    const p = q.payload as {
      pLong: number; pShort: number; out: number; price: number; premium: number; trainCost: number;
      naiveRule: "headline" | "blind"; minExp: number; maxExp: number;
      truthN: number | null; naiveN: number; tolDex: number;
    };
    // re-derive the tuning economics: the marginal saving, the break-even, the reflex
    const costToday = (p.price * (p.pLong + p.out)) / 1000;
    const costTuned = (p.premium * p.price * (p.pShort + p.out)) / 1000;
    const s2 = costToday - costTuned;
    const expNaive = p.naiveRule === "headline"
      ? Math.round(p.trainCost / costToday)
      : Math.round(p.trainCost / ((p.price * (p.pLong - p.pShort)) / 1000));
    ok(p.premium >= 1 && p.pShort < p.pLong, `${label}: payback params well-formed`);
    ok(Math.abs(s2) >= 0.05 * costToday, `${label}: payback saving is no knife-edge (|s| >= 5% of today's bill)`);
    if (s2 > 0) {
      const exp = Math.round(p.trainCost / s2);
      ok(p.truthN != null && Math.abs(p.truthN - exp) <= Math.max(1, exp * 0.001), `${label}: payback truth is trainCost / marginal saving`);
      ok(p.truthN != null && Math.log10(p.truthN) <= 7.5 && Math.log10(p.truthN) >= p.minExp + 0.2, `${label}: payback truth sits inside the rail`);
      ok(p.truthN != null && Math.abs(Math.log10(p.naiveN) - Math.log10(p.truthN)) > 2 * p.tolDex, `${label}: payback naive is a genuine trap (outside 2·tolDex)`);
    } else {
      ok(p.truthN == null, `${label}: payback negative saving means NEVER (truthN null)`);
    }
    ok(Math.abs(p.naiveN - expNaive) <= Math.max(1, expNaive * 0.001), `${label}: payback naive is the declared ${p.naiveRule}-rule recompute`);
    ok(p.tolDex > 0 && p.minExp < p.maxExp, `${label}: payback rail + tolerance well-formed`);
    ok(q.choices.length === 0, `${label}: payback carries no choices`);
  } else if (q.kind === "pool") {
    const p = q.payload as { subgroups: { T: { rate: number; n: number }; C: { rate: number; n: number } }[]; truth: number; naive: number; tol: number; min: number; max: number };
    const pooled = (arm: "T" | "C") => p.subgroups.reduce((s, g) => s + g[arm].rate * g[arm].n, 0) / p.subgroups.reduce((s, g) => s + g[arm].n, 0);
    const pT = Math.round(pooled("T") * 10) / 10, pC = Math.round(pooled("C") * 10) / 10;
    ok(p.subgroups.every((g) => g.T.rate > g.C.rate), `${label}: pool — T leads C in every subgroup`);
    ok(pT < pC, `${label}: pool — genuine reversal (pooled T below pooled C)`);
    ok(Math.abs(pT - p.truth) <= 0.1, `${label}: pool truth is the size-weighted pooled rate`);
    ok(Math.abs(p.naive - p.truth) > p.tol, `${label}: pool naive (unweighted mean) is a genuine trap`);
    ok(q.choices.length === 0, `${label}: pool carries no choices`);
  }
  if (titles.has(q.title)) dupTitles++;
  titles.add(q.title);
  perTopic[`${q.track}/${q.topic}`] = (perTopic[`${q.track}/${q.topic}`] ?? 0) + 1;
}

ok(dupTitles === 0, `all titles unique (${dupTitles} dup${dupTitles === 1 ? "" : "s"})`);

// Every topic in every track should carry at least a couple of items so a
// topic-filtered run is never empty.
for (const track of Object.values(TRACKS)) {
  for (const topic of track.topics) {
    const n = perTopic[`${track.id}/${topic.id}`] ?? 0;
    ok(n >= 2, `${track.id}/${topic.id}: has ${n} items (>=2)`);
  }
}

console.log(`\n  (${QUIZ_SEEDS.length} quiz items checked · ${failures === 0 ? "ALL PASS" : `${failures} FAILURES`})`);
if (failures > 0) process.exit(1);
