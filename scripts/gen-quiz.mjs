// Regenerate prisma/quiz.ts from the source JSON in prisma/quiz-source/.
// Run: node scripts/gen-quiz.mjs   (after editing the source JSON)
// The generated file inlines the item data (like prisma/drills.ts) and exports
// syncQuizItems for the seed + prod-init paths.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "prisma", "quiz-source");
const stats = JSON.parse(readFileSync(join(SRC, "statistics.json"), "utf8"));
const arch = JSON.parse(readFileSync(join(SRC, "architecture.json"), "utf8"));
const estimate = JSON.parse(readFileSync(join(SRC, "estimate.json"), "utf8"));
const duel = JSON.parse(readFileSync(join(SRC, "duel.json"), "utf8"));
const bakeoff = JSON.parse(readFileSync(join(SRC, "bakeoff.json"), "utf8"));
const flood = JSON.parse(readFileSync(join(SRC, "flood.json"), "utf8"));
const economics = JSON.parse(readFileSync(join(SRC, "economics.json"), "utf8"));
const market = JSON.parse(readFileSync(join(SRC, "market.json"), "utf8"));
const redline = JSON.parse(readFileSync(join(SRC, "redline.json"), "utf8"));
const pool = JSON.parse(readFileSync(join(SRC, "pool.json"), "utf8"));
const decision = JSON.parse(readFileSync(join(SRC, "decision.json"), "utf8"));
const gap = JSON.parse(readFileSync(join(SRC, "gap.json"), "utf8"));
const ml = JSON.parse(readFileSync(join(SRC, "ml.json"), "utf8"));
const payback = JSON.parse(readFileSync(join(SRC, "payback.json"), "utf8"));

const STATS_TOPICS = ["sampling", "variation", "association", "base_rates", "uncertainty", "aggregation"];
const ARCH_TOPICS = ["storage", "processing", "modeling", "scaling", "reliability", "cost"];
const ECON_TOPICS = ["opportunity_cost", "sunk_cost", "nominal_vs_real", "secondary_effects", "tax_incidence", "comparative_advantage"];
const ML_TOPICS = ["generalization", "evaluation", "optimization", "regularization", "llm_tuning", "scaling_laws"];
const DECISION_TOPICS = ["probability", "expected_value", "marginal_ev", "equilibrium", "bankroll", "exploitation"];

function check(items, track, topics) {
  const titles = new Set();
  for (const it of items) {
    if (!topics.includes(it.topic)) throw new Error(`${track}: bad topic ${it.topic} in ${it.title}`);
    if (![1, 2, 3].includes(it.difficulty)) throw new Error(`${track}: bad difficulty in ${it.title}`);
    if (it.choices.filter((c) => c.correct).length !== 1) throw new Error(`${track}: not exactly one correct in ${it.title}`);
    if (it.choices.length < 2) throw new Error(`${track}: too few choices in ${it.title}`);
    if (titles.has(it.title)) throw new Error(`${track}: dup title ${it.title}`);
    titles.add(it.title);
    for (const k of ["scenario", "prompt", "explanation"]) if (!it[k] || !String(it[k]).trim()) throw new Error(`${track}: empty ${k} in ${it.title}`);
  }
}
check(stats, "statistics", STATS_TOPICS);
check(arch, "architecture", ARCH_TOPICS);
check(economics, "economics", ECON_TOPICS);
check(ml, "ml", ML_TOPICS);
check(decision, "decision", DECISION_TOPICS);

// --- validators for the new interaction kinds --------------------------------
function checkEstimate(items) {
  const titles = new Set();
  for (const it of items) {
    if (!STATS_TOPICS.includes(it.topic)) throw new Error(`estimate: bad topic ${it.topic} in ${it.title}`);
    if (![1, 2, 3].includes(it.difficulty)) throw new Error(`estimate: bad difficulty in ${it.title}`);
    const { min, max, truth, good } = it;
    if (!(min < good.lo && good.lo < truth && truth < good.hi && good.hi < max))
      throw new Error(`estimate: ordering invariant broken in ${it.title}`);
    if (titles.has(it.title)) throw new Error(`estimate: dup title ${it.title}`);
    titles.add(it.title);
    for (const k of ["scenario", "prompt", "explanation"]) if (!it[k] || !String(it[k]).trim()) throw new Error(`estimate: empty ${k} in ${it.title}`);
  }
}
function checkDuel(items) {
  const titles = new Set();
  for (const it of items) {
    if (!ARCH_TOPICS.includes(it.topic)) throw new Error(`duel: bad topic ${it.topic} in ${it.title}`);
    if (![1, 2, 3].includes(it.difficulty)) throw new Error(`duel: bad difficulty in ${it.title}`);
    if (it.better !== "A" && it.better !== "B") throw new Error(`duel: better must be A|B in ${it.title}`);
    for (const d of [it.designA, it.designB]) {
      if (!d.name || !d.sketch || !Array.isArray(d.bullets) || d.bullets.length < 1)
        throw new Error(`duel: malformed design in ${it.title}`);
    }
    if (titles.has(it.title)) throw new Error(`duel: dup title ${it.title}`);
    titles.add(it.title);
    for (const k of ["constraint", "scenario", "deskRationale", "failureMode"]) if (!it[k] || !String(it[k]).trim()) throw new Error(`duel: empty ${k} in ${it.title}`);
  }
}
function checkBakeoff(items) {
  const titles = new Set();
  for (const it of items) {
    if (it.topic !== "scaling") throw new Error(`bakeoff: topic must be scaling in ${it.title}`);
    if (![1, 2, 3].includes(it.difficulty)) throw new Error(`bakeoff: bad difficulty in ${it.title}`);
    if (!Array.isArray(it.keys) || it.keys.length < 2) throw new Error(`bakeoff: too few keys in ${it.title}`);
    for (const k of it.keys) {
      if (!k.id || !k.label || !Array.isArray(k.shards) || k.shards.length !== 8) throw new Error(`bakeoff: malformed key in ${it.title}`);
      if (k.shards.some((s) => typeof s !== "number" || s < 0)) throw new Error(`bakeoff: bad shard load in ${it.title}`);
    }
    if (!it.keys.some((k) => k.id === it.best)) throw new Error(`bakeoff: best not among keys in ${it.title}`);
    // best must genuinely have the lowest max-shard load (most balanced)
    const maxOf = (k) => Math.max(...k.shards);
    const bestMax = maxOf(it.keys.find((k) => k.id === it.best));
    if (it.keys.some((k) => k.id !== it.best && maxOf(k) < bestMax)) throw new Error(`bakeoff: best is not the most balanced in ${it.title}`);
    if (titles.has(it.title)) throw new Error(`bakeoff: dup title ${it.title}`);
    titles.add(it.title);
    for (const key of ["scenario", "prompt", "explanation"]) if (!it[key] || !String(it[key]).trim()) throw new Error(`bakeoff: empty ${key} in ${it.title}`);
  }
}
function checkFlood(items) {
  const titles = new Set();
  for (const it of items) {
    if (it.topic !== "base_rates") throw new Error(`flood: topic must be base_rates in ${it.title}`);
    if (![1, 2, 3].includes(it.difficulty)) throw new Error(`flood: bad difficulty in ${it.title}`);
    const expected = Math.round(((100 - it.specificity) / (it.sensitivity + (100 - it.specificity))) * 100 * 10) / 10;
    if (Math.abs(expected - it.truth) > 0.15) throw new Error(`flood: truth ${it.truth} != PPV-50 ${expected} in ${it.title}`);
    if (!(it.min < it.truth && it.truth < it.max)) throw new Error(`flood: truth outside range in ${it.title}`);
    if (titles.has(it.title)) throw new Error(`flood: dup title ${it.title}`);
    titles.add(it.title);
    for (const k of ["scenario", "prompt", "explanation"]) if (!it[k] || !String(it[k]).trim()) throw new Error(`flood: empty ${k} in ${it.title}`);
  }
}
// The MARKET interaction (economics signature): a linear supply/demand model
// with an optional policy lever. The learner predicts one headline number; the
// closed-form truth is re-derived here so no item can ship a wrong answer.
//   Qd = a - b*P ,  Qs = c + d*P
//   none:    equilibrium price       P* = (a-c)/(b+d)         [target "price"]
//   tax:     post-tax consumer price Pc = (a-c+d*t)/(b+d)     [target "price"]  (t = policy, seller-side)
//   ceiling: quantity transacted     Q  = c + d*ceiling       [target "quantity"] (short side)
function marketTruth(it) {
  const { a, b } = it.demand;
  const { c, d } = it.supply;
  if (it.lever === "none") return (a - c) / (b + d);
  if (it.lever === "tax") return (a - c + d * it.policy) / (b + d);
  if (it.lever === "ceiling") return c + d * it.policy; // short side under a binding ceiling
  throw new Error(`market: unknown lever ${it.lever} in ${it.title}`);
}
function checkMarket(items) {
  const titles = new Set();
  for (const it of items) {
    if (!ECON_TOPICS.includes(it.topic)) throw new Error(`market: bad topic ${it.topic} in ${it.title}`);
    if (![1, 2, 3].includes(it.difficulty)) throw new Error(`market: bad difficulty in ${it.title}`);
    if (!["none", "tax", "ceiling"].includes(it.lever)) throw new Error(`market: bad lever in ${it.title}`);
    const wantTarget = it.lever === "ceiling" ? "quantity" : "price";
    if (it.target !== wantTarget) throw new Error(`market: target must be ${wantTarget} for ${it.lever} in ${it.title}`);
    for (const k of ["a", "b"]) if (typeof it.demand?.[k] !== "number") throw new Error(`market: demand.${k} in ${it.title}`);
    for (const k of ["c", "d"]) if (typeof it.supply?.[k] !== "number") throw new Error(`market: supply.${k} in ${it.title}`);
    if (!(it.demand.b > 0 && it.supply.d > 0)) throw new Error(`market: slopes must be positive in ${it.title}`);
    const expected = Math.round(marketTruth(it) * 100) / 100;
    if (Math.abs(expected - it.truth) > 0.05) throw new Error(`market: truth ${it.truth} != closed-form ${expected} in ${it.title}`);
    if (typeof it.naive !== "number") throw new Error(`market: naive value required in ${it.title}`);
    if (!(it.min < it.truth && it.truth < it.max)) throw new Error(`market: truth outside range in ${it.title}`);
    if (!(it.min <= it.naive && it.naive <= it.max)) throw new Error(`market: naive outside range in ${it.title}`);
    if (!(it.tol > 0)) throw new Error(`market: tol must be positive in ${it.title}`);
    if (titles.has(it.title)) throw new Error(`market: dup title ${it.title}`);
    titles.add(it.title);
    for (const k of ["scenario", "prompt", "explanation"]) if (!it[k] || !String(it[k]).trim()) throw new Error(`market: empty ${k} in ${it.title}`);
  }
}
// The REDLINE interaction (architecture signature, winner of the arch 10x
// competition): predict the MAX utilization a single M/M/1 queue can run at
// while holding its p-th percentile latency under an SLA. Closed form:
//   p99 latency = ln(1/(1-p)) / (mu*(1-rho))  →  rho* = 1 - ln(1/(1-p))/(mu*SLA)
// The knee sits far below intuition; naive is the seductive "run it ~hot" value.
function redlineTruthPct(it) {
  const p = it.percentile / 100;
  const z = Math.log(1 / (1 - p));
  const slaSec = it.slaMs / 1000;
  return (1 - z / (it.mu * slaSec)) * 100; // rho* as a percentage
}
function checkRedline(items) {
  const titles = new Set();
  for (const it of items) {
    if (!ARCH_TOPICS.includes(it.topic)) throw new Error(`redline: bad topic ${it.topic} in ${it.title}`);
    if (![1, 2, 3].includes(it.difficulty)) throw new Error(`redline: bad difficulty in ${it.title}`);
    if (![95, 99, 99.9].includes(it.percentile)) throw new Error(`redline: percentile must be 95|99|99.9 in ${it.title}`);
    if (!(it.mu > 0 && it.slaMs > 0)) throw new Error(`redline: mu and slaMs must be positive in ${it.title}`);
    const expected = Math.round(redlineTruthPct(it) * 10) / 10;
    if (Math.abs(expected - it.truth) > 0.1) throw new Error(`redline: truth ${it.truth} != knee ${expected} in ${it.title}`);
    if (!(it.min < it.truth && it.truth < it.max)) throw new Error(`redline: truth outside range in ${it.title}`);
    if (!(it.min <= it.naive && it.naive <= it.max)) throw new Error(`redline: naive outside range in ${it.title}`);
    if (!(Math.abs(it.naive - it.truth) > it.tol)) throw new Error(`redline: naive must be a real trap (outside tolerance) in ${it.title}`);
    if (!(it.tol > 0)) throw new Error(`redline: tol must be positive in ${it.title}`);
    if (titles.has(it.title)) throw new Error(`redline: dup title ${it.title}`);
    titles.add(it.title);
    for (const k of ["scenario", "prompt", "explanation"]) if (!it[k] || !String(it[k]).trim()) throw new Error(`redline: empty ${k} in ${it.title}`);
  }
}
// The POOL interaction (statistics signature, winner of the stats 10x
// competition): predict the size-weighted POOLED rate of the asked arm across
// two subgroups — Simpson's paradox, where the arm ahead in EVERY subgroup
// lands behind overall. Truth = Σ nᵢ·rateᵢ / Σ nᵢ; naive = the unweighted mean.
function pooledRate(subs, arm) {
  const num = subs.reduce((s, g) => s + g[arm].rate * g[arm].n, 0);
  const den = subs.reduce((s, g) => s + g[arm].n, 0);
  return num / den;
}
function checkPool(items) {
  const titles = new Set();
  for (const it of items) {
    if (!STATS_TOPICS.includes(it.topic)) throw new Error(`pool: bad topic ${it.topic} in ${it.title}`);
    if (![1, 2, 3].includes(it.difficulty)) throw new Error(`pool: bad difficulty in ${it.title}`);
    if (!Array.isArray(it.subgroups) || it.subgroups.length !== 2) throw new Error(`pool: need exactly 2 subgroups in ${it.title}`);
    for (const g of it.subgroups) {
      for (const arm of ["T", "C"]) {
        if (typeof g[arm]?.rate !== "number" || typeof g[arm]?.n !== "number" || g[arm].n <= 0) throw new Error(`pool: bad ${arm} in ${it.title}`);
      }
      // asked arm (T) must be ahead in EVERY subgroup — the setup of the paradox
      if (!(g.T.rate > g.C.rate)) throw new Error(`pool: T must lead C in every subgroup in ${it.title}`);
    }
    const pT = pooledRate(it.subgroups, "T");
    const pC = pooledRate(it.subgroups, "C");
    if (!(pT < pC)) throw new Error(`pool: no genuine reversal (pooled T ${pT} not < pooled C ${pC}) in ${it.title}`);
    const naive = (it.subgroups[0].T.rate + it.subgroups[1].T.rate) / 2; // unweighted mean of T
    if (Math.abs(Math.round(pT * 10) / 10 - it.truth) > 0.1) throw new Error(`pool: truth ${it.truth} != pooled ${Math.round(pT * 10) / 10} in ${it.title}`);
    if (Math.abs(Math.round(naive * 10) / 10 - it.naive) > 0.1) throw new Error(`pool: naive ${it.naive} != unweighted mean ${Math.round(naive * 10) / 10} in ${it.title}`);
    if (!(it.min < it.truth && it.truth < it.max)) throw new Error(`pool: truth outside range in ${it.title}`);
    if (!(it.min <= it.naive && it.naive <= it.max)) throw new Error(`pool: naive outside range in ${it.title}`);
    if (!(Math.abs(it.naive - it.truth) > it.tol)) throw new Error(`pool: naive must be a real trap in ${it.title}`);
    if (!(it.tol > 0)) throw new Error(`pool: tol must be positive in ${it.title}`);
    if (titles.has(it.title)) throw new Error(`pool: dup title ${it.title}`);
    titles.add(it.title);
    for (const k of ["scenario", "prompt", "explanation"]) if (!it[k] || !String(it[k]).trim()) throw new Error(`pool: empty ${k} in ${it.title}`);
  }
}
checkEstimate(estimate);
checkDuel(duel);
checkBakeoff(bakeoff);
// The GAP interaction (decision signature, winner of the Solver Room 4-firm
// competition — Firm B "MARGIN", see docs/GTO-10X.md): two lines, each a
// declared branch table; the learner commits a SIGNED margin ΔEV = EV(A)−EV(B)
// on a zero-crossing slider — picking the winner and pricing it are one act.
// The naive is a DECLARED, recomputed reflex rule, never hand-tuned:
//   mode  — compare the most-likely outcome of each line (probability neglect)
//   best  — compare best cases (optimism)   ·   worst — compare worst cases
function gapEV(line) {
  return line.branches.reduce((s, br) => s + br.p * br.v, 0);
}
function gapNaive(it) {
  const pick = (line) => {
    if (it.naiveRule === "best") return Math.max(...line.branches.map((b) => b.v));
    if (it.naiveRule === "worst") return Math.min(...line.branches.map((b) => b.v));
    // mode: the value of the single most-likely branch (must be unique)
    const top = Math.max(...line.branches.map((b) => b.p));
    const tops = line.branches.filter((b) => b.p === top);
    if (tops.length !== 1) throw new Error(`gap: ambiguous mode branch in ${it.title} (${line.name})`);
    return tops[0].v;
  };
  return pick(it.lineA) - pick(it.lineB);
}
function checkGap(items) {
  const titles = new Set();
  let flips = 0;
  let sameSign = 0;
  for (const it of items) {
    if (!DECISION_TOPICS.includes(it.topic)) throw new Error(`gap: bad topic ${it.topic} in ${it.title}`);
    if (![1, 2, 3].includes(it.difficulty)) throw new Error(`gap: bad difficulty in ${it.title}`);
    if (!["mode", "best", "worst"].includes(it.naiveRule)) throw new Error(`gap: bad naiveRule in ${it.title}`);
    for (const line of [it.lineA, it.lineB]) {
      if (!line?.name || !Array.isArray(line.branches)) throw new Error(`gap: malformed line in ${it.title}`);
      if (line.branches.length < 1 || line.branches.length > 4) throw new Error(`gap: 1-4 branches per line in ${it.title}`);
      let psum = 0;
      for (const br of line.branches) {
        if (!(typeof br.p === "number" && br.p > 0 && typeof br.v === "number")) throw new Error(`gap: bad branch in ${it.title}`);
        psum += br.p;
      }
      if (Math.abs(psum - 1) > 1e-6) throw new Error(`gap: probabilities of ${line.name} sum to ${psum} in ${it.title}`);
    }
    const expected = Math.round((gapEV(it.lineA) - gapEV(it.lineB)) * 10) / 10;
    if (Math.abs(expected - it.truth) > 0.05) throw new Error(`gap: truth ${it.truth} != ΔEV ${expected} in ${it.title}`);
    const naive = Math.round(gapNaive(it) * 10) / 10;
    if (Math.abs(naive - it.naive) > 0.05) throw new Error(`gap: naive ${it.naive} != ${it.naiveRule}-rule ${naive} in ${it.title}`);
    if (!(it.min < 0 && 0 < it.max)) throw new Error(`gap: slider must cross zero in ${it.title}`);
    if (!(it.min < it.truth && it.truth < it.max)) throw new Error(`gap: truth outside range in ${it.title}`);
    if (!(it.min <= it.naive && it.naive <= it.max)) throw new Error(`gap: naive outside range in ${it.title}`);
    if (!(it.tol > 0)) throw new Error(`gap: tol must be positive in ${it.title}`);
    if (Math.abs(it.truth - it.naive) <= 2 * it.tol) throw new Error(`gap: naive within 2·tol of truth in ${it.title}`);
    if (it.truth * it.naive < 0) flips++;
    if (it.truth * it.naive > 0) sameSign++;
    if (titles.has(it.title)) throw new Error(`gap: dup title ${it.title}`);
    titles.add(it.title);
    for (const k of ["scenario", "prompt", "explanation", "unit"]) if (!it[k] || !String(it[k]).trim()) throw new Error(`gap: empty ${k} in ${it.title}`);
  }
  // The teaching-mix invariant (the teacher judge's graft): if every item were a
  // sign flip, learners would train a contrarian reflex instead of the skill.
  if (flips < 2) throw new Error(`gap: need >=2 sign-flip items (felt winner loses), have ${flips}`);
  if (sameSign < 2) throw new Error(`gap: need >=2 same-sign items (felt winner right, price wrong), have ${sameSign}`);
}

// The PAYBACK interaction (ml signature, winner of the Tuning Room 4-firm
// competition — Firm D "ADAPTER", docs/ML-10X.md): how many calls until a
// finetune has paid for itself. Exact algebra, per-1k-token pricing:
//   costToday = price·(pLong+out)/1000
//   costTuned = premium·price·(pShort+out)/1000
//   s = costToday − costTuned    (the marginal saving per call)
//   truthN = trainCost / s  if s > 0, else null (NEVER — it never pays)
// Naive is a DECLARED, recomputed reflex rule:
//   headline: trainCost / costToday          (amortize the full bill — always too soon)
//   blind:    trainCost / (price·(pLong−pShort)/1000)  (ignore the premium — promises
//             a finite payback even on items whose truth is NEVER)
// Graded in dex (|log10 you − log10 truth| ≤ tolDex) — payback errors are
// multiplicative. Rigor grafts: |s| ≥ 5% of costToday (NEVER is a sign
// judgment, never a knife-edge) and finite truths live inside the rail.
function paybackParts(it) {
  const costToday = (it.price * (it.pLong + it.out)) / 1000;
  const costTuned = (it.premium * it.price * (it.pShort + it.out)) / 1000;
  return { costToday, costTuned, s: costToday - costTuned };
}
function checkPayback(items) {
  const titles = new Set();
  let never = 0;
  let finite = 0;
  const rules = {};
  for (const it of items) {
    if (!ML_TOPICS.includes(it.topic)) throw new Error(`payback: bad topic ${it.topic} in ${it.title}`);
    if (![1, 2, 3].includes(it.difficulty)) throw new Error(`payback: bad difficulty in ${it.title}`);
    if (!["headline", "blind"].includes(it.naiveRule)) throw new Error(`payback: bad naiveRule in ${it.title}`);
    for (const k of ["pLong", "pShort", "out", "price", "premium", "trainCost"])
      if (!(typeof it[k] === "number" && it[k] > 0)) throw new Error(`payback: bad ${k} in ${it.title}`);
    if (!(it.premium >= 1)) throw new Error(`payback: premium must be >= 1 in ${it.title}`);
    if (!(it.pShort < it.pLong)) throw new Error(`payback: pShort must beat pLong in ${it.title}`);
    const { costToday, s } = paybackParts(it);
    if (Math.abs(s) < 0.05 * costToday) throw new Error(`payback: knife-edge saving ${s} in ${it.title}`);
    if (s > 0) {
      const expected = Math.round(it.trainCost / s);
      if (it.truthN == null || Math.abs(it.truthN - expected) > Math.max(1, expected * 0.001))
        throw new Error(`payback: truthN ${it.truthN} != ${expected} in ${it.title}`);
      const lg = Math.log10(it.truthN);
      if (!(lg >= it.minExp + 0.2 && lg <= 7.5)) throw new Error(`payback: truth off the rail (${lg}) in ${it.title}`);
      finite++;
    } else {
      if (it.truthN != null) throw new Error(`payback: truthN must be null when s<0 in ${it.title}`);
      never++;
    }
    const expNaive =
      it.naiveRule === "headline"
        ? Math.round(it.trainCost / costToday)
        : Math.round(it.trainCost / ((it.price * (it.pLong - it.pShort)) / 1000));
    if (Math.abs(it.naiveN - expNaive) > Math.max(1, expNaive * 0.001))
      throw new Error(`payback: naiveN ${it.naiveN} != ${it.naiveRule}-rule ${expNaive} in ${it.title}`);
    const nlg = Math.log10(it.naiveN);
    if (!(nlg >= it.minExp && nlg <= it.maxExp)) throw new Error(`payback: naive off the rail in ${it.title}`);
    if (it.truthN != null && Math.abs(Math.log10(it.naiveN) - Math.log10(it.truthN)) <= 2 * it.tolDex)
      throw new Error(`payback: trap within 2·tolDex of truth in ${it.title}`);
    if (!(it.tolDex > 0)) throw new Error(`payback: tolDex must be positive in ${it.title}`);
    if (!(it.minExp < it.maxExp)) throw new Error(`payback: bad rail in ${it.title}`);
    rules[it.naiveRule] = (rules[it.naiveRule] ?? 0) + 1;
    if (titles.has(it.title)) throw new Error(`payback: dup title ${it.title}`);
    titles.add(it.title);
    for (const k of ["scenario", "prompt", "explanation", "unit"]) if (!it[k] || !String(it[k]).trim()) throw new Error(`payback: empty ${k} in ${it.title}`);
  }
  // Mix invariants (the judges' grafts): NEVER items keep the latch honest,
  // finite items keep it from becoming a tell, both reflex rules stay live.
  if (never < 2) throw new Error(`payback: need >=2 NEVER items, have ${never}`);
  if (finite < 3) throw new Error(`payback: need >=3 finite items, have ${finite}`);
  if ((rules.headline ?? 0) < 2 || (rules.blind ?? 0) < 2) throw new Error(`payback: need >=2 items per naive rule`);
}
checkFlood(flood);
checkMarket(market);
checkRedline(redline);
checkPayback(payback);
checkPool(pool);
checkGap(gap);

const mcqSeed = (it, track) => ({
  track,
  title: it.title,
  topic: it.topic,
  kind: "mcq",
  difficulty: it.difficulty,
  scenario: it.scenario,
  prompt: it.prompt,
  choices: it.choices.map((c) => ({ text: c.text, correct: !!c.correct, rationale: c.rationale })),
  payload: null,
  explanation: it.explanation,
});
const estimateSeed = (it) => ({
  track: "statistics",
  title: it.title,
  topic: it.topic,
  kind: "estimate",
  difficulty: it.difficulty,
  scenario: it.scenario,
  prompt: it.prompt,
  choices: [],
  payload: { unit: it.unit, min: it.min, max: it.max, truth: it.truth, good: it.good },
  explanation: it.explanation,
});
const duelSeed = (it) => ({
  track: "architecture",
  title: it.title,
  topic: it.topic,
  kind: "duel",
  difficulty: it.difficulty,
  scenario: it.scenario,
  prompt: "Which design fits these constraints?",
  choices: [],
  payload: {
    constraint: it.constraint,
    designA: it.designA,
    designB: it.designB,
    better: it.better,
    deskRationale: it.deskRationale,
    failureMode: it.failureMode,
    ...(it.alsoFits ? { alsoFits: it.alsoFits } : {}),
  },
  explanation: it.deskRationale,
});
const bakeoffSeed = (it) => ({
  track: "architecture",
  title: it.title,
  topic: it.topic,
  kind: "bakeoff",
  difficulty: it.difficulty,
  scenario: it.scenario,
  prompt: it.prompt,
  choices: [],
  payload: { keys: it.keys, best: it.best, explanation: it.explanation },
  explanation: it.explanation,
});
const floodSeed = (it) => ({
  track: "statistics",
  title: it.title,
  topic: it.topic,
  kind: "flood",
  difficulty: it.difficulty,
  scenario: it.scenario,
  prompt: it.prompt,
  choices: [],
  payload: { sensitivity: it.sensitivity, specificity: it.specificity, min: it.min, max: it.max, truth: it.truth },
  explanation: it.explanation,
});
const marketSeed = (it) => ({
  track: "economics",
  title: it.title,
  topic: it.topic,
  kind: "market",
  difficulty: it.difficulty,
  scenario: it.scenario,
  prompt: it.prompt,
  choices: [],
  payload: {
    unit: it.unit,
    min: it.min,
    max: it.max,
    lever: it.lever,
    target: it.target,
    policy: it.policy ?? 0,
    demand: it.demand,
    supply: it.supply,
    truth: it.truth,
    naive: it.naive,
    tol: it.tol,
  },
  explanation: it.explanation,
});
const redlineSeed = (it) => ({
  track: "architecture",
  title: it.title,
  topic: it.topic,
  kind: "redline",
  difficulty: it.difficulty,
  scenario: it.scenario,
  prompt: it.prompt,
  choices: [],
  payload: { mu: it.mu, slaMs: it.slaMs, percentile: it.percentile, min: it.min, max: it.max, truth: it.truth, naive: it.naive, tol: it.tol },
  explanation: it.explanation,
});
const poolSeed = (it) => ({
  track: "statistics",
  title: it.title,
  topic: it.topic,
  kind: "pool",
  difficulty: it.difficulty,
  scenario: it.scenario,
  prompt: it.prompt,
  choices: [],
  payload: { arms: it.arms, subgroups: it.subgroups, unit: it.unit, min: it.min, max: it.max, truth: it.truth, naive: it.naive, tol: it.tol },
  explanation: it.explanation,
});
const gapSeed = (it) => ({
  track: "decision",
  title: it.title,
  topic: it.topic,
  kind: "gap",
  difficulty: it.difficulty,
  scenario: it.scenario,
  prompt: it.prompt,
  choices: [],
  payload: { lineA: it.lineA, lineB: it.lineB, naiveRule: it.naiveRule, unit: it.unit, min: it.min, max: it.max, truth: it.truth, naive: it.naive, tol: it.tol },
  explanation: it.explanation,
});
const paybackSeed = (it) => ({
  track: "ml",
  title: it.title,
  topic: it.topic,
  kind: "payback",
  difficulty: it.difficulty,
  scenario: it.scenario,
  prompt: it.prompt,
  choices: [],
  payload: {
    pLong: it.pLong, pShort: it.pShort, out: it.out, price: it.price, premium: it.premium,
    trainCost: it.trainCost, naiveRule: it.naiveRule, unit: it.unit,
    minExp: it.minExp, maxExp: it.maxExp, truthN: it.truthN, naiveN: it.naiveN, tolDex: it.tolDex,
  },
  explanation: it.explanation,
});
const seeds = [
  ...stats.map((it) => mcqSeed(it, "statistics")),
  ...arch.map((it) => mcqSeed(it, "architecture")),
  ...economics.map((it) => mcqSeed(it, "economics")),
  ...decision.map((it) => mcqSeed(it, "decision")),
  ...gap.map(gapSeed),
  ...ml.map((it) => mcqSeed(it, "ml")),
  ...payback.map(paybackSeed),
  ...estimate.map(estimateSeed),
  ...duel.map(duelSeed),
  ...bakeoff.map(bakeoffSeed),
  ...flood.map(floodSeed),
  ...market.map(marketSeed),
  ...redline.map(redlineSeed),
  ...pool.map(poolSeed),
];

const out = `// AUTO-GENERATED by scripts/gen-quiz.mjs — do not hand-edit item content here.
// Edit the source JSON in prisma/quiz-source/ and rerun \`node scripts/gen-quiz.mjs\`.
// The seed pool for the two Training Room tracks (statistics, data-engineering
// architecture). Each item is a multiple-choice question with exactly one
// correct choice, stored as JSON on QuizItem; the serving path sends only
// shuffled { i, text }. Isolated world — imports nothing from the overclaim drill.
import type { PrismaClient } from "@prisma/client";

export type QuizChoice = { text: string; correct: boolean; rationale: string };
export type QuizKind = "mcq" | "estimate" | "duel" | "bakeoff" | "flood" | "market" | "redline" | "pool" | "gap" | "payback";
export type QuizSeed = {
  track: "statistics" | "architecture" | "economics" | "decision" | "ml";
  title: string; // stable natural key for idempotent sync
  topic: string;
  kind: QuizKind;
  difficulty: 1 | 2 | 3;
  scenario: string;
  prompt: string;
  choices: QuizChoice[]; // mcq: exactly one correct; estimate/duel: []
  payload: unknown | null; // kind-specific: estimate band / duel designs+desk
  explanation: string;
};

export const QUIZ_SEEDS: QuizSeed[] = ${JSON.stringify(seeds, null, 2)};

// Idempotent content sync: upsert every seed by its stable title. Runs on every
// build (scripts/prod-init.ts) so both track pools ship without a reseed. The
// update path omits rating/attempts, preserving each item's learned difficulty
// across content edits. Prisma-only import — never ships to a client.
export async function syncQuizItems(prisma: PrismaClient): Promise<number> {
  for (const q of QUIZ_SEEDS) {
    const data = {
      track: q.track,
      topic: q.topic,
      kind: q.kind,
      scenario: q.scenario,
      prompt: q.prompt,
      choices: JSON.stringify(q.choices),
      payload: q.payload == null ? null : JSON.stringify(q.payload),
      explanation: q.explanation,
      difficulty: q.difficulty,
    };
    await prisma.quizItem.upsert({
      where: { title: q.title },
      create: { title: q.title, ...data },
      update: data,
    });
  }
  return QUIZ_SEEDS.length;
}
`;

writeFileSync(join(ROOT, "prisma", "quiz.ts"), out);
console.log(`wrote prisma/quiz.ts with ${seeds.length} items (${stats.length} statistics, ${arch.length} architecture, ${economics.length} economics mcq, ${market.length} market, ${redline.length} redline, ${pool.length} pool, ${decision.length} decision mcq, ${gap.length} gap)`);
