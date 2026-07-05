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

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
