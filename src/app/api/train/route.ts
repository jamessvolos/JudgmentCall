import { withTiming } from "@/lib/timing";
import { parseChoices, isCorrectChoice, correctChoiceIndex } from "@/lib/drill-grade";
import { NextResponse } from "next/server";
import {
  getSession,
  getQuizItem,
  getNextQuizItem,
  getQuizStanding,
  getDuelTally,
  hasAttemptedQuiz,
  recordQuizAttempt,
} from "@/lib/repo";
import { isTrackId } from "@/lib/train-tracks";

// The Training Tracks API — the two rooms (statistics, architecture) in their
// 10x form. A SEPARATE WORLD from the study: items never serve in the voting
// pool and attempts never enter analytics. Three interaction kinds:
//   mcq      — pick one choice (answer never crosses the wire before commit)
//   estimate — drag a point + a 90% interval; graded on capture + calibrated width
//   duel     — two designs for one constraint; pick the fit, then YOU / ROOM / DESK
// Every call carries a conviction (50..99); every GET carries The Record
// (level + badges + topic map + calibration), a pure fold over the rows.

function shuffled<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Conviction is clamped to [floor, 99], where the floor is the item's chance
// level — 1/k for a k-option MCQ (25% for four options), 50% for a binary duel.
// A 50% floor on a 4-option item would mislabel every honest guess as
// overconfident and pollute the calibration signal.
function clampConfidence(x: unknown, floor: number): number | null {
  if (typeof x !== "number" || !Number.isFinite(x)) return null;
  return Math.max(floor, Math.min(99, Math.round(x)));
}

type EstimatePayload = { unit: string; min: number; max: number; truth: number; good: { lo: number; hi: number } };
type DuelDesign = { name: string; sketch: string; bullets: string[] };
type DuelPayload = {
  constraint: string;
  designA: DuelDesign;
  designB: DuelDesign;
  better: "A" | "B";
  deskRationale: string;
  failureMode: string;
  alsoFits?: string;
};
type BakeKey = { id: string; label: string; shards: number[]; note: string };
type BakeoffPayload = { keys: BakeKey[]; best: string; explanation: string };
type FloodPayload = { sensitivity: number; specificity: number; min: number; max: number; truth: number };
type MarketPayload = {
  unit: string; min: number; max: number;
  lever: "none" | "tax" | "ceiling"; target: "price" | "quantity"; policy: number;
  demand: { a: number; b: number }; supply: { c: number; d: number };
  truth: number; naive: number; tol: number;
};
type RedlinePayload = {
  mu: number; slaMs: number; percentile: number;
  min: number; max: number; truth: number; naive: number; tol: number;
};
type PoolArm = { rate: number; n: number };
type PoolPayload = {
  arms: [string, string]; unit: string; min: number; max: number;
  subgroups: { label: string; T: PoolArm; C: PoolArm }[];
  truth: number; naive: number; tol: number;
};
type GapBranch = { p: number; v: number };
type GapLine = { name: string; branches: GapBranch[] };
type GapPayload = {
  lineA: GapLine; lineB: GapLine; naiveRule: "mode" | "best" | "worst";
  unit: string; min: number; max: number; truth: number; naive: number; tol: number;
};

// GET /api/train?sessionId=...&track=...&topic=... — next item + The Record.
async function getHandler(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  const track = searchParams.get("track");
  const topic = searchParams.get("topic") ?? undefined;
  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  if (!track || !isTrackId(track)) return NextResponse.json({ error: "unknown track" }, { status: 400 });
  const session = await getSession(sessionId);
  if (!session) return NextResponse.json({ error: "unknown session" }, { status: 404 });

  const [next, standing] = await Promise.all([
    getNextQuizItem(sessionId, track, { topic }),
    getQuizStanding(sessionId, track),
  ]);

  const record = { standing };
  if (!next.item) {
    return NextResponse.json({ item: null, remaining: 0, liveRating: next.liveRating, count: next.count, ...record });
  }
  const it = next.item;
  const base = {
    id: it.id,
    track: it.track,
    topic: it.topic,
    kind: it.kind,
    difficulty: it.difficulty,
    scenario: it.scenario,
    prompt: it.prompt,
  };

  let item: Record<string, unknown> = base;
  if (it.kind === "estimate") {
    const p = JSON.parse(it.payload ?? "{}") as EstimatePayload;
    // send ONLY the number-line frame — never the truth or the desk's band
    item = { ...base, estimate: { unit: p.unit, min: p.min, max: p.max } };
  } else if (it.kind === "duel") {
    const p = JSON.parse(it.payload ?? "{}") as DuelPayload;
    // send both designs + the constraint — never `better`/rationale/failureMode/alsoFits
    item = { ...base, duel: { constraint: p.constraint, designA: p.designA, designB: p.designB } };
  } else if (it.kind === "bakeoff") {
    const p = JSON.parse(it.payload ?? "{}") as BakeoffPayload;
    // send only the candidate key LABELS (shuffled) — never the shard loads,
    // the notes, or which key balances. The learner predicts, then the reveal
    // shows the histograms.
    item = { ...base, bakeoff: { keys: shuffled(p.keys.map((k) => ({ id: k.id, label: k.label }))) } };
  } else if (it.kind === "flood") {
    const p = JSON.parse(it.payload ?? "{}") as FloodPayload;
    // send the test's accuracy + slider frame — never the target prevalence
    item = { ...base, flood: { sensitivity: p.sensitivity, specificity: p.specificity, min: p.min, max: p.max } };
  } else if (it.kind === "market") {
    const p = JSON.parse(it.payload ?? "{}") as MarketPayload;
    // send only the number-line frame + what to predict — never the demand/supply
    // curves, the naive value, or the truth. The learner commits from intuition;
    // the market chart is a REVEAL, so the answer can't be back-computed.
    item = { ...base, market: { unit: p.unit, min: p.min, max: p.max, lever: p.lever, target: p.target } };
  } else if (it.kind === "redline") {
    const p = JSON.parse(it.payload ?? "{}") as RedlinePayload;
    // send the queue's service rate + SLA (the scenario) + slider frame — never
    // the knee (truth) or the naive value. The p99 curve is a REVEAL.
    item = { ...base, redline: { mu: p.mu, slaMs: p.slaMs, percentile: p.percentile, min: p.min, max: p.max } };
  } else if (it.kind === "pool") {
    const p = JSON.parse(it.payload ?? "{}") as PoolPayload;
    // send the full subgroup table (rates + sizes) — the learner needs it to
    // reason — but never the pooled truth or the unweighted-average trap value.
    item = { ...base, pool: { arms: p.arms, unit: p.unit, min: p.min, max: p.max, subgroups: p.subgroups } };
  } else if (it.kind === "gap") {
    const p = JSON.parse(it.payload ?? "{}") as GapPayload;
    // send both lines' full branch tables (the skill is weighing them, not
    // guessing hidden data — the pool precedent) — never the ΔEV truth, the
    // felt-gap naive, or which reflex rule the trap encodes.
    item = { ...base, gap: { lineA: p.lineA, lineB: p.lineB, unit: p.unit, min: p.min, max: p.max } };
  } else {
    const choices = parseChoices(it.choices).map((c, i) => ({ i, text: c.text }));
    item = { ...base, choices: shuffled(choices) };
  }

  return NextResponse.json({
    item,
    remaining: next.remaining,
    liveRating: next.liveRating,
    count: next.count,
    ...record,
  });
}

// POST /api/train — grade an attempt.
// Body: { sessionId, track, quizId, confidence, kind-specific answer }
//   mcq:      { pickedIndex }
//   estimate: { point, lo, hi }
//   duel:     { pickedIndex }  (0 = Design A, 1 = Design B)
async function postHandler(request: Request) {
  const body = await request.json().catch(() => null);
  const { sessionId, track, quizId, latencyMs } = body ?? {};
  if (typeof sessionId !== "string" || typeof quizId !== "string" || !isTrackId(track)) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  const [session, item] = await Promise.all([getSession(sessionId), getQuizItem(quizId)]);
  if (!session || !item) return NextResponse.json({ error: "unknown session or item" }, { status: 404 });
  if (item.track !== track) return NextResponse.json({ error: "track mismatch" }, { status: 400 });
  if (await hasAttemptedQuiz(sessionId, quizId)) {
    return NextResponse.json({ error: "already attempted" }, { status: 409 });
  }
  // per-item conviction floor = chance level (1/k). Estimate takes no conviction.
  const bakePayload = item.kind === "bakeoff" ? (JSON.parse(item.payload ?? "{}") as BakeoffPayload) : null;
  const nChoices =
    item.kind === "mcq" ? Math.max(2, parseChoices(item.choices).length)
    : item.kind === "bakeoff" ? Math.max(2, bakePayload!.keys.length)
    : 2;
  const confFloor = Math.round(100 / nChoices);
  const confidence = clampConfidence(body?.confidence, confFloor);
  const latency = Number.isFinite(latencyMs) ? Math.max(0, Math.round(latencyMs)) : 0;

  let correct: boolean;
  let choiceIndex = -1;
  let capturedFlag: boolean | null = null; // estimate coverage; null for other kinds
  let reveal: Record<string, unknown>;

  if (item.kind === "estimate") {
    const p = JSON.parse(item.payload ?? "{}") as EstimatePayload;
    const point = Number(body?.point);
    const lo = Number(body?.lo);
    const hi = Number(body?.hi);
    if (![point, lo, hi].every(Number.isFinite) || lo >= hi) {
      return NextResponse.json({ error: "invalid interval" }, { status: 400 });
    }
    const captured = p.truth >= lo && p.truth <= hi;
    const goodWidth = p.good.hi - p.good.lo;
    const userWidth = hi - lo;
    // correct = you captured the truth AND your band wasn't lazily wide
    const notLazy = userWidth <= goodWidth * 1.8;
    correct = captured && notLazy;
    capturedFlag = captured; // pure coverage for the interval-calibration track
    reveal = {
      truth: p.truth,
      good: p.good,
      unit: p.unit,
      captured,
      notLazy,
      your: { point, lo, hi },
      explanation: item.explanation,
    };
  } else if (item.kind === "duel") {
    const p = JSON.parse(item.payload ?? "{}") as DuelPayload;
    const pickedIndex = Number(body?.pickedIndex);
    if (pickedIndex !== 0 && pickedIndex !== 1) {
      return NextResponse.json({ error: "invalid pick" }, { status: 400 });
    }
    choiceIndex = pickedIndex;
    correct = (p.better === "A" && pickedIndex === 0) || (p.better === "B" && pickedIndex === 1);
    reveal = { better: p.better, deskRationale: p.deskRationale, failureMode: p.failureMode, alsoFits: p.alsoFits ?? null, pickedIndex };
  } else if (item.kind === "bakeoff") {
    const p = bakePayload!;
    const keyId = typeof body?.keyId === "string" ? body.keyId : "";
    const idx = p.keys.findIndex((k) => k.id === keyId);
    if (idx < 0) return NextResponse.json({ error: "invalid key" }, { status: 400 });
    choiceIndex = idx;
    correct = keyId === p.best;
    reveal = {
      keys: p.keys, // full: id, label, shards, note — safe now the pick is committed
      best: p.best,
      pickedKeyId: keyId,
      explanation: item.explanation,
    };
  } else if (item.kind === "flood") {
    const p = JSON.parse(item.payload ?? "{}") as FloodPayload;
    const prevalence = Number(body?.prevalence);
    if (!Number.isFinite(prevalence)) return NextResponse.json({ error: "invalid prevalence" }, { status: 400 });
    // correct if you land within a fair tolerance of the PPV-50 prevalence
    const tol = Math.max(2.5, 0.2 * p.truth);
    correct = Math.abs(prevalence - p.truth) <= tol;
    reveal = { truth: p.truth, yourPrev: prevalence, sensitivity: p.sensitivity, specificity: p.specificity, explanation: item.explanation };
  } else if (item.kind === "market") {
    const p = JSON.parse(item.payload ?? "{}") as MarketPayload;
    const value = Number(body?.value);
    if (!Number.isFinite(value)) return NextResponse.json({ error: "invalid value" }, { status: 400 });
    correct = Math.abs(value - p.truth) <= p.tol;
    // naive_trap: landed on the seductive first-order value while missing the truth
    const naiveTrap = !correct && Math.abs(value - p.naive) <= p.tol;
    // free-market equilibrium for the reveal chart (server-derived, safe now the pick is in)
    const eqPrice = (p.demand.a - p.supply.c) / (p.demand.b + p.supply.d);
    const eqQty = p.demand.a - p.demand.b * eqPrice;
    reveal = {
      truth: p.truth, naive: p.naive, yourValue: value, naiveTrap,
      unit: p.unit, target: p.target, lever: p.lever, policy: p.policy, tol: p.tol,
      demand: p.demand, supply: p.supply, eqPrice, eqQty,
      explanation: item.explanation,
    };
  } else if (item.kind === "redline") {
    const p = JSON.parse(item.payload ?? "{}") as RedlinePayload;
    const value = Number(body?.value);
    if (!Number.isFinite(value)) return NextResponse.json({ error: "invalid value" }, { status: 400 });
    correct = Math.abs(value - p.truth) <= p.tol;
    // naive_trap: landed near the seductive "run it hot" utilization while missing the knee
    const naiveTrap = !correct && Math.abs(value - p.naive) <= p.tol;
    reveal = {
      truth: p.truth, naive: p.naive, yourValue: value, naiveTrap, tol: p.tol,
      mu: p.mu, slaMs: p.slaMs, percentile: p.percentile,
      explanation: item.explanation,
    };
  } else if (item.kind === "pool") {
    const p = JSON.parse(item.payload ?? "{}") as PoolPayload;
    const value = Number(body?.value);
    if (!Number.isFinite(value)) return NextResponse.json({ error: "invalid value" }, { status: 400 });
    correct = Math.abs(value - p.truth) <= p.tol;
    // naive_trap: landed on the unweighted average of the subgroup rates
    const naiveTrap = !correct && Math.abs(value - p.naive) <= p.tol;
    const wsum = (arm: "T" | "C") => p.subgroups.reduce((s, g) => s + g[arm].rate * g[arm].n, 0);
    const nsum = (arm: "T" | "C") => p.subgroups.reduce((s, g) => s + g[arm].n, 0);
    const pooledC = Math.round((wsum("C") / nsum("C")) * 10) / 10;
    reveal = {
      truth: p.truth, naive: p.naive, yourValue: value, naiveTrap, tol: p.tol,
      arms: p.arms, unit: p.unit, subgroups: p.subgroups, pooledC,
      explanation: item.explanation,
    };
  } else if (item.kind === "gap") {
    const p = JSON.parse(item.payload ?? "{}") as GapPayload;
    const value = Number(body?.value);
    if (!Number.isFinite(value)) return NextResponse.json({ error: "invalid value" }, { status: 400 });
    correct = Math.abs(value - p.truth) <= p.tol;
    // naive_trap: landed on the FELT gap (the declared reflex rule) instead of ΔEV
    const naiveTrap = !correct && Math.abs(value - p.naive) <= p.tol;
    const ev = (line: GapLine) => line.branches.reduce((s, br) => s + br.p * br.v, 0);
    const evA = Math.round(ev(p.lineA) * 10) / 10;
    const evB = Math.round(ev(p.lineB) * 10) / 10;
    // the agony index: how small the true margin is against the headline swing
    const vs = [...p.lineA.branches, ...p.lineB.branches].map((br) => br.v);
    const swing = Math.max(...vs) - Math.min(...vs);
    const agonyPct = swing > 0 ? Math.round((Math.abs(p.truth) / swing) * 1000) / 10 : 0;
    reveal = {
      truth: p.truth, naive: p.naive, yourValue: value, naiveTrap, tol: p.tol,
      unit: p.unit, naiveRule: p.naiveRule, lineA: p.lineA, lineB: p.lineB,
      evA, evB, swing, agonyPct,
      explanation: item.explanation,
    };
  } else {
    const choices = parseChoices(item.choices);
    const pickedIndex = Number(body?.pickedIndex);
    if (!Number.isInteger(pickedIndex) || pickedIndex < 0 || pickedIndex >= choices.length) {
      return NextResponse.json({ error: "invalid pick" }, { status: 400 });
    }
    choiceIndex = pickedIndex;
    correct = isCorrectChoice(choices, pickedIndex);
    reveal = {
      choices: choices.map((c, i) => ({ i, text: c.text, correct: c.correct, rationale: c.rationale })),
      correctIndex: correctChoiceIndex(choices),
      pickedIndex,
      explanation: item.explanation,
    };
  }

  const result = await recordQuizAttempt({
    sessionId,
    quizItemId: quizId,
    track: item.track,
    topic: item.topic,
    difficulty: item.difficulty,
    correct,
    choiceIndex,
    confidence,
    captured: capturedFlag,
    latencyMs: latency,
  });

  // The Room verdict is computed AFTER recording, so it includes this vote.
  if (item.kind === "duel") reveal = { ...reveal, room: await getDuelTally(quizId) };

  return NextResponse.json({
    correct,
    kind: item.kind,
    topic: item.topic,
    confidence,
    ...reveal,
    liveRating: Math.round(result.liveRating),
    ratingDelta: Math.round(result.ratingDelta),
    count: result.count,
  });
}

export const GET = withTiming("train", getHandler);
export const POST = withTiming("train", postHandler);
