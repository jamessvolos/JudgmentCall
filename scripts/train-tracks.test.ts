/**
 * Offline unit test for the Training Tracks folds (levels + badges). Everything
 * a learner sees about their standing is a pure fold over QuizAttempt rows, so
 * these are the invariants that keep a level or a badge from being awarded (or
 * withheld) wrongly. Run: npx tsx scripts/train-tracks.test.ts
 */
import {
  TRACKS,
  liveRating,
  levelStanding,
  badgeConferrals,
  topicProgress,
  calibration,
  intervalCoverage,
  type QuizRow,
} from "../src/lib/train-tracks";

let failures = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = got === want;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
  if (!ok) failures++;
};

const T0 = new Date("2026-01-01T00:00:00Z").getTime();
let seq = 0;
function row(topic: string, difficulty: number, correct: boolean, ratingAfter: number | null, confidence: number | null = null): QuizRow {
  return { quizItemId: `q${seq}`, topic, difficulty, correct, confidence, captured: null, level: null, ratingAfter, createdAt: new Date(T0 + seq++ * 1000) };
}
// a staked row (confidence set) at a fixed rating, for calibration tests
function staked(correct: boolean, confidence: number): QuizRow {
  return { quizItemId: `q${seq}`, topic: "sampling", difficulty: 1, correct, confidence, captured: null, level: null, ratingAfter: 1210, createdAt: new Date(T0 + seq++ * 1000) };
}
// an estimate row (captured set, no confidence) for interval-coverage tests
function estimate(captured: boolean): QuizRow {
  return { quizItemId: `q${seq}`, topic: "sampling", difficulty: 1, correct: captured, confidence: null, captured, level: null, ratingAfter: 1210, createdAt: new Date(T0 + seq++ * 1000) };
}

const stats = TRACKS.statistics;
const badge = (rows: QuizRow[], code: string) => badgeConferrals(stats, rows).find((b) => b.code === code)!.earnedAt !== null;

// --- liveRating -------------------------------------------------------------
eq("liveRating: empty ledger defaults to 1200", liveRating([]), 1200);
eq(
  "liveRating: picks the last non-null ratingAfter",
  liveRating([row("sampling", 1, true, 1216), row("variation", 1, false, null), row("association", 1, true, 1240)]),
  1240
);

// --- levels -----------------------------------------------------------------
seq = 0;
eq("level: a fresh session holds Level I", levelStanding(stats, [row("sampling", 1, true, 1216)]).level.n, 1);

// Level II gate: reading 1260 · 8 calls · 3 topics faced (0 hard required).
seq = 0;
const toII: QuizRow[] = [];
const t3 = ["sampling", "variation", "association"];
for (let i = 0; i < 8; i++) toII.push(row(t3[i % 3], 1, true, 1200 + (i + 1) * 10)); // 8th ratingAfter = 1280
{
  const s = levelStanding(stats, toII);
  eq("level: II earned once rating≥1260 + 8 calls + 3 topics", s.level.n, 2);
  eq("level: II earnedAt is stamped", s.earnedAt !== null, true);
}

// Earned-and-kept: a later rating slump does not demote the earned level.
seq = 0;
const slump = [...toII, row("sampling", 1, false, 1150), row("variation", 1, false, 1100)];
eq("level: stays II after a rating slump (earned and kept)", levelStanding(stats, slump).level.n, 2);

// Under-gate: only 2 topics faced → still Level I even with the rating.
seq = 0;
const twoTopics: QuizRow[] = [];
for (let i = 0; i < 8; i++) twoTopics.push(row(i % 2 ? "sampling" : "variation", 1, true, 1200 + (i + 1) * 10));
eq("level: II withheld when only 2 topics faced", levelStanding(stats, twoTopics).level.n, 1);

// --- badges -----------------------------------------------------------------
// CLEAN SWEEP: eight consecutive correct.
seq = 0;
eq("badge sweep: 7 straight is not enough", badge(Array.from({ length: 7 }, () => row("sampling", 1, true, 1210)), "sweep"), false);
seq = 0;
eq("badge sweep: 8 straight earns it", badge(Array.from({ length: 8 }, () => row("sampling", 1, true, 1210)), "sweep"), true);
seq = 0;
const brokenThenEight = [row("sampling", 1, false, 1190), ...Array.from({ length: 8 }, () => row("variation", 1, true, 1210))];
eq("badge sweep: a miss then 8 straight still earns it", badge(brokenThenEight, "sweep"), true);

// THE FULL MAP: all six topics faced.
seq = 0;
const fiveTopics = stats.topics.slice(0, 5).map((t) => row(t.id, 1, true, 1210));
eq("badge full_map: five topics is not enough", badge(fiveTopics, "full_map"), false);
seq = 0;
const sixTopics = stats.topics.map((t) => row(t.id, 1, true, 1210));
eq("badge full_map: all six topics earns it", badge(sixTopics, "full_map"), true);

// THE FINE PRINT: six subtle-tier (d3) correct across ≥3 topics.
seq = 0;
const sixHardTwoTopics = [
  ...Array.from({ length: 3 }, () => row("sampling", 3, true, 1400)),
  ...Array.from({ length: 3 }, () => row("variation", 3, true, 1400)),
];
eq("badge fine_print: 6 hard across only 2 topics is not enough", badge(sixHardTwoTopics, "fine_print"), false);
seq = 0;
const sixHardThreeTopics = [
  ...Array.from({ length: 2 }, () => row("sampling", 3, true, 1400)),
  ...Array.from({ length: 2 }, () => row("variation", 3, true, 1400)),
  ...Array.from({ length: 2 }, () => row("association", 3, true, 1400)),
];
eq("badge fine_print: 6 hard across 3 topics earns it", badge(sixHardThreeTopics, "fine_print"), true);

// SPECIALIST: five correct in one topic, at least one above the easy tier.
seq = 0;
const fiveEasyOneTopic = Array.from({ length: 5 }, () => row("base_rates", 1, true, 1250));
eq("badge specialist: five correct all easy is not enough", badge(fiveEasyOneTopic, "specialist"), false);
seq = 0;
const fiveOneTopicWithMid = [row("base_rates", 2, true, 1250), ...Array.from({ length: 4 }, () => row("base_rates", 1, true, 1250))];
eq("badge specialist: five correct with a mid-tier earns it", badge(fiveOneTopicWithMid, "specialist"), true);

// THE CORRECTION: a topic behind (wrong>right, ≥3 attempts), then three straight.
seq = 0;
const behindThenThree = [
  row("aggregation", 1, false, 1180),
  row("aggregation", 1, false, 1160),
  row("aggregation", 1, false, 1140),
  row("aggregation", 2, true, 1160),
  row("aggregation", 2, true, 1180),
  row("aggregation", 2, true, 1200),
];
eq("badge correction: behind then three straight earns it", badge(behindThenThree, "correction"), true);
seq = 0;
const neverBehind = Array.from({ length: 6 }, () => row("aggregation", 1, true, 1210));
eq("badge correction: never behind does not earn it", badge(neverBehind, "correction"), false);

// THE DEEP END: a subtle-tier (d3) call attempted in four or more topics (landing not required).
seq = 0;
const deepThree = stats.topics.slice(0, 3).map((t) => row(t.id, 3, false, 1200));
eq("badge deep_end: hard tried in 3 topics is not enough", badge(deepThree, "deep_end"), false);
seq = 0;
const deepFour = stats.topics.slice(0, 4).map((t) => row(t.id, 3, false, 1200));
eq("badge deep_end: hard tried in 4 topics earns it (even all missed)", badge(deepFour, "deep_end"), true);

// --- topicProgress ----------------------------------------------------------
seq = 0;
const tp = topicProgress(stats, [
  row("sampling", 1, true, 1210),
  row("sampling", 3, false, 1190),
  row("variation", 3, true, 1210),
]);
const samp = tp.find((t) => t.id === "sampling")!;
eq("topicProgress: sampling faced=2", samp.faced, 2);
eq("topicProgress: sampling correct=1", samp.correct, 1);
eq("topicProgress: sampling hardFaced=1", samp.hardFaced, 1);
eq("topicProgress: sampling hardCorrect=0", samp.hardCorrect, 0);

// --- calibration ------------------------------------------------------------
seq = 0;
eq("calibration: empty ledger is unrated", calibration([]).tendency, "unrated");
seq = 0;
// perfectly calibrated: at 90% conviction, right 9/10
const cal90 = calibration([...Array.from({ length: 9 }, () => staked(true, 90)), staked(false, 90)]);
eq("calibration: 9/10 right at 90% conviction reads as sharp", cal90.tendency, "sharp");
eq("calibration: sharp accuracy is 0.9", Math.round(cal90.accuracy * 100), 90);
seq = 0;
// overconfident: always 95% sure, only right half the time
const over = calibration(Array.from({ length: 20 }, (_, i) => staked(i % 2 === 0, 95)));
eq("calibration: 95% conviction / 50% accuracy is overconfident", over.tendency, "overconfident");
eq("calibration: overconfident gap is positive", over.gap > 0.07, true);
seq = 0;
// underconfident: only 60% sure, right 95% of the time
const under = calibration(Array.from({ length: 20 }, (_, i) => staked(i % 20 !== 0, 60)));
eq("calibration: 60% conviction / 95% accuracy is underconfident", under.tendency, "underconfident");
seq = 0;
// score is null below 30 staked calls (5 bins are noise at low n), present at/above
eq("calibration: score null under 30 staked calls", calibration(Array.from({ length: 10 }, () => staked(true, 80))).score, null);
eq("calibration: score present at 30 staked calls", typeof calibration(Array.from({ length: 30 }, (_, i) => staked(i % 5 !== 0, 80))).score, "number");
seq = 0;
// PROPER SCORING: the base-rate hedge (stake your accuracy on everything) must
// NOT win. 30 calls at 70% conviction, 70% correct → Brier skill 0 → score 0.
const hedge = calibration([
  ...Array.from({ length: 21 }, () => staked(true, 70)),
  ...Array.from({ length: 9 }, () => staked(false, 70)),
]);
eq("proper scoring: base-rate hedge scores ~0 (cannot game it)", hedge.score! <= 5, true);
seq = 0;
// A sharp forecaster (95% when right, 50% on true coin-flips) beats the hedge.
const sharp = calibration([
  ...Array.from({ length: 20 }, () => staked(true, 95)),
  ...Array.from({ length: 5 }, () => staked(true, 50)),
  ...Array.from({ length: 5 }, () => staked(false, 50)),
]);
eq("proper scoring: sharp forecaster beats the hedge", sharp.score! > hedge.score!, true);
seq = 0;
// unstaked rows are ignored by calibration
eq("calibration: rows without confidence are ignored", calibration([row("sampling", 1, true, 1210), row("variation", 1, false, 1190)]).n, 0);

// --- calibration badges -----------------------------------------------------
seq = 0;
// knows_knows: 10 locked-in (90%+) calls, 90% landed
const knowsRows = Array.from({ length: 10 }, (_, i) => staked(i !== 0, 95));
eq("badge knows_knows: 10 locked calls at 90% accuracy earns it", badge(knowsRows, "knows_knows"), true);
seq = 0;
eq("badge knows_knows: not earned with only easy hedges", badge(Array.from({ length: 10 }, () => staked(true, 70)), "knows_knows"), false);

// --- interval coverage ------------------------------------------------------
seq = 0;
eq("coverage: empty ledger is 0/0", intervalCoverage([]).n, 0);
seq = 0;
// 9 of 10 estimate bands caught the truth → rate 0.9 (well-calibrated 90% bands)
const cov = intervalCoverage([...Array.from({ length: 9 }, () => estimate(true)), estimate(false)]);
eq("coverage: 9/10 captured → n=10", cov.n, 10);
eq("coverage: rate is 0.9", cov.rate, 0.9);
seq = 0;
// staked (mcq/duel) rows are ignored by coverage; estimate rows ignored by calibration
const mixed = [staked(true, 90), estimate(true), estimate(false)];
eq("coverage: ignores staked rows (n=2 estimates)", intervalCoverage(mixed).n, 2);
eq("calibration: ignores estimate rows (n=1 staked)", calibration(mixed).n, 1);

console.log(`\n  (${failures === 0 ? "ALL PASS" : `${failures} FAILURES`})`);
if (failures > 0) process.exit(1);
