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
function row(topic: string, difficulty: number, correct: boolean, ratingAfter: number | null): QuizRow {
  return { quizItemId: `q${seq}`, topic, difficulty, correct, ratingAfter, createdAt: new Date(T0 + seq++ * 1000) };
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

console.log(`\n  (${failures === 0 ? "ALL PASS" : `${failures} FAILURES`})`);
if (failures > 0) process.exit(1);
