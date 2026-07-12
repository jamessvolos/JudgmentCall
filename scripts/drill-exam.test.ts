/**
 * Offline unit test for THE CHECKPOINT's pure logic. Locks the properties the
 * mark leans on: form arithmetic, deterministic near-band picks, and the
 * monotone window-fold (a failed re-sit can never touch passedAt; a later
 * pass refreshes the printed date without moving it).
 * Run: npx tsx scripts/drill-exam.test.ts
 */
import {
  examSlot,
  examSkillFor,
  examTargetDifficulty,
  examPick,
  examStanding,
  EXAM_LENGTH,
  type ExamAttemptRow,
} from "../src/lib/drill-exam";
import { SKILL_IDS } from "../src/lib/teaching";

let failures = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = got === want;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` — got ${got}, want ${want}`}`);
  if (!ok) failures++;
};

// --- slot arithmetic across boundaries ---
eq("slot 0 = form 0 pos 0", JSON.stringify(examSlot(0)), JSON.stringify({ form: 0, position: 0 }));
eq("slot 9 = form 0 pos 9", JSON.stringify(examSlot(9)), JSON.stringify({ form: 0, position: 9 }));
eq("slot 10 = form 1 pos 0", JSON.stringify(examSlot(10)), JSON.stringify({ form: 1, position: 0 }));
eq("slot 19 = form 1 pos 9", JSON.stringify(examSlot(19)), JSON.stringify({ form: 1, position: 9 }));
eq("slot 20 = form 2 pos 0", JSON.stringify(examSlot(20)), JSON.stringify({ form: 2, position: 0 }));
eq("skill order is canonical", examSkillFor(0), SKILL_IDS[0]);
eq("last position is the last skill", examSkillFor(9), SKILL_IDS[9]);
eq("form length is 10", EXAM_LENGTH, 10);

// --- difficulty floor ---
eq("floor at d2 for a 1200 reader", examTargetDifficulty(1200), 2);
eq("floor at d2 in the mid band", examTargetDifficulty(1300), 2);
eq("d3 above 1340", examTargetDifficulty(1400), 3);

// --- pick determinism + banding ---
const cands = [
  { id: "a", difficulty: 1, rating: 1200 },
  { id: "b", difficulty: 2, rating: 1210 },
  { id: "c", difficulty: 2, rating: 1400 },
  { id: "d", difficulty: 3, rating: 1250 },
];
const p1 = examPick(cands, 1200, "sess", 0, "cause");
eq("pick is deterministic", examPick(cands, 1200, "sess", 0, "cause")?.id, p1?.id);
eq("pick never lands on the sub-floor tier", p1?.difficulty !== 1, true);
// different form → salt independence (may or may not differ; assert both valid picks)
const p2 = examPick(cands, 1200, "sess", 1, "cause");
eq("different form still picks a valid near-band item", p2 !== null && p2.difficulty >= 2, true);
// difficulty proximity beats rating proximity: at rating 1200 target 2, a d2
// item at distant rating still outranks a d3 item at close rating in the sort's
// top slots (both b and c precede d)
const only2v3 = [
  { id: "far2", difficulty: 2, rating: 1500 },
  { id: "near3", difficulty: 3, rating: 1200 },
];
const p3 = examPick(only2v3, 1200, "s2", 0, "certainty");
eq("difficulty proximity beats rating proximity", p3?.id, "far2");
eq("empty pool refuses honestly", examPick([], 1200, "s", 0, "cause"), null);

// --- window fold ---
let t = 0;
const row = (correct: boolean): ExamAttemptRow => ({
  correct,
  createdAt: new Date(2026, 0, 1, 0, 0, t++),
  mode: "exam",
});
const pass = [...Array(8).fill(true), false, false].map((c) => row(c)); // 8/10
const fail = [...Array(7).fill(true), false, false, false].map((c) => row(c)); // 7/10
const now = new Date(2026, 5, 1);

const s1 = examStanding(pass, now);
eq("8/10 passes", s1.passedAt !== null, true);
eq("pass date is the 10th row's", s1.passedAt?.getTime(), pass[9].createdAt.getTime());
eq("formsSat counts complete forms", s1.formsSat, 1);
eq("best records the score", s1.best, 8);

const s2 = examStanding(fail, now);
eq("7/10 does not pass", s2.passedAt, null);
eq("best still records 7", s2.best, 7);

// monotone: a failed re-sit after a pass never touches passedAt
const passThenFail = [...pass, ...fail.map((r) => ({ ...r, createdAt: new Date(2026, 0, 2, 0, 0, t++) }))];
const s3 = examStanding(passThenFail, now);
eq("failed re-sit never un-passes (monotone)", s3.passedAt?.getTime(), pass[9].createdAt.getTime());
eq("latestPass stays the first pass after a fail", s3.latestPassAt?.getTime(), pass[9].createdAt.getTime());

// a later pass refreshes the printed date without moving passedAt
const secondPass = [...Array(9).fill(true), false].map(() => row(true)).slice(0, 10);
const passTwice = [...pass, ...secondPass];
const s4 = examStanding(passTwice, now);
eq("passedAt stays the FIRST pass", s4.passedAt?.getTime(), pass[9].createdAt.getTime());
eq("latestPassAt refreshes to the second pass", s4.latestPassAt?.getTime(), secondPass[9].createdAt.getTime());
eq("latestPassScore is the second form's", s4.latestPassScore, 10);

// incomplete final form: correct position, no best entry from it
const partial = [...pass, row(true), row(false)];
const s5 = examStanding(partial, now);
eq("position mid-form", s5.position, 2);
eq("form index mid-form", s5.form, 1);
eq("incomplete form never enters best", s5.best, 8);

// satToday UTC edges
const today = new Date();
const todayRow: ExamAttemptRow = { correct: true, createdAt: today, mode: "exam" };
eq("satToday true for a row today", examStanding([todayRow]).satToday, true);
const yesterday = new Date(Date.now() - 26 * 3600 * 1000);
eq("satToday false for a 26h-old row", examStanding([{ correct: true, createdAt: yesterday, mode: "exam" }]).satToday, false);
// non-exam rows are invisible to the fold
eq("non-exam rows are ignored", examStanding([{ correct: true, createdAt: today, mode: "" }]).position, 0);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
