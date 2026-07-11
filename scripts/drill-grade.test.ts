/**
 * Offline unit test for drill grading. Locks the invariant that broke silently
 * from launch: the drill asks "which telling EXCEEDS the data?", so a correct
 * call is the OVERCLAIMED (non-faithful) side. If someone re-inverts the
 * grading, this fails. Run: npx tsx scripts/drill-grade.test.ts
 */
import {
  faithfulSideFor,
  overclaimedSideFor,
  isCorrectDrillCall,
  fieldServesFaithful,
  isCorrectFieldCall,
  isCorrectLedger,
  type StoredChoice,
} from "../src/lib/drill-grade";

let failures = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = got === want;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` — got ${got}, want ${want}`}`);
  if (!ok) failures++;
};

// Grading direction: catching the overclaim is correct; picking faithful is not.
eq("picking the overclaimed side (a vs faithful b) is CORRECT", isCorrectDrillCall("a", "b"), true);
eq("picking the overclaimed side (b vs faithful a) is CORRECT", isCorrectDrillCall("b", "a"), true);
eq("picking the faithful side (a == a) is WRONG", isCorrectDrillCall("a", "a"), false);
eq("picking the faithful side (b == b) is WRONG", isCorrectDrillCall("b", "b"), false);

// End-to-end mapping: the side served as overclaimed is the side graded correct.
// Exercise both hash outcomes so both branches are covered (ids chosen so the
// first sha256 byte is even for one and odd for the other).
const cases = [
  ["sess-1", "item-1"],
  ["sess-1", "item-2"],
  ["sess-2", "item-9"],
  ["alpha", "beta"],
];
let sawA = false;
let sawB = false;
for (const [s, i] of cases) {
  const faithful = faithfulSideFor(s, i);
  const over = overclaimedSideFor(s, i);
  eq(`faithful/overclaimed are opposite sides (${s}:${i})`, faithful === over, false);
  eq(`the overclaimed side is graded correct (${s}:${i})`, isCorrectDrillCall(over, faithful), true);
  eq(`the faithful side is graded wrong (${s}:${i})`, isCorrectDrillCall(faithful, faithful), false);
  eq(`side is deterministic (${s}:${i})`, faithfulSideFor(s, i), faithful);
  if (faithful === "a") sawA = true;
  if (faithful === "b") sawB = true;
}
eq("both faithful-first outcomes exercised", sawA && sawB, true);

// FIELD READ — full truth table + salt independence.
eq("bounds on faithful is CORRECT", isCorrectFieldCall("bounds", true), true);
eq("exceeds on faithful is WRONG (false accusation costs)", isCorrectFieldCall("exceeds", true), false);
eq("exceeds on overclaimed is CORRECT", isCorrectFieldCall("exceeds", false), true);
eq("bounds on overclaimed is WRONG", isCorrectFieldCall("bounds", false), false);
let sawFieldTrue = false;
let sawFieldFalse = false;
let sawSaltDiverge = false;
const fieldPairs: [string, string][] = [
  ...(cases as [string, string][]),
  ...Array.from({ length: 24 }, (_, k) => [`sess-${k}`, `item-${k}`] as [string, string]),
];
for (const [s, i] of fieldPairs) {
  const served = fieldServesFaithful(s, i);
  eq(`field side is deterministic (${s}:${i})`, fieldServesFaithful(s, i), served);
  if (served) sawFieldTrue = true;
  else sawFieldFalse = true;
  // independence from the spot salt: at least one pair must diverge from
  // faithfulSideFor's parity, or the field salt is doing nothing.
  if (served !== (faithfulSideFor(s, i) === "a")) sawSaltDiverge = true;
}
eq("field read deals both texts across pairs", sawFieldTrue && sawFieldFalse, true);
eq("field salt diverges from the spot salt on some pair", sawSaltDiverge, true);

// THE LEDGER — exact-set grading, all-or-nothing.
const L: StoredChoice[] = [
  { text: "c1", correct: false, rationale: "holds" },
  { text: "c2", correct: true, rationale: "exceeds" },
  { text: "c3", correct: false, rationale: "holds" },
  { text: "c4", correct: true, rationale: "exceeds" },
];
eq("ledger: exact match is CORRECT", isCorrectLedger(L, [false, true, false, true]), true);
eq("ledger: one wrong stamp fails", isCorrectLedger(L, [false, true, false, false]), false);
eq("ledger: one false accusation fails", isCorrectLedger(L, [true, true, false, true]), false);
eq("ledger: length mismatch fails", isCorrectLedger(L, [false, true, false]), false);
eq("ledger: empty stamps fail", isCorrectLedger(L, []), false);
const CLEAN: StoredChoice[] = [
  { text: "c1", correct: false, rationale: "holds" },
  { text: "c2", correct: false, rationale: "holds" },
  { text: "c3", correct: false, rationale: "holds" },
];
eq("ledger: clean filing, all HOLDS is CORRECT", isCorrectLedger(CLEAN, [false, false, false]), true);
eq("ledger: clean filing, any EXCEEDS fails", isCorrectLedger(CLEAN, [false, true, false]), false);
eq("ledger: empty choices never grade correct", isCorrectLedger([], []), false);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
