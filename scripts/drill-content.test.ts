/**
 * Locks two things that would silently corrupt the Training Room:
 *  1. choice grading (parseChoices / isCorrectChoice / correctChoiceIndex).
 *  2. content integrity of the authored pool — every fix/calibrate item has
 *     exactly one correct choice, every spot item has both tellings + a device,
 *     skills are valid, and titles are unique (the natural upsert key).
 * Run: npx tsx scripts/drill-content.test.ts
 */
import { parseChoices, isCorrectChoice, correctChoiceIndex } from "../src/lib/drill-grade";
import { DRILL_SEEDS } from "../prisma/drills";

let failures = 0;
const ok = (name: string, cond: boolean, extra = "") => {
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : ` — ${extra}`}`);
  if (!cond) failures++;
};

// --- choice grading units ---
const json = JSON.stringify([
  { text: "a", correct: false, rationale: "r0" },
  { text: "b", correct: true, rationale: "r1" },
  { text: "c", correct: false, rationale: "r2" },
]);
const parsed = parseChoices(json);
ok("parseChoices returns all rows", parsed.length === 3, `${parsed.length}`);
ok("isCorrectChoice true on the correct index", isCorrectChoice(parsed, 1) === true);
ok("isCorrectChoice false on a wrong index", isCorrectChoice(parsed, 0) === false);
ok("isCorrectChoice false out of range", isCorrectChoice(parsed, 9) === false);
ok("correctChoiceIndex finds it", correctChoiceIndex(parsed) === 1);
ok("parseChoices tolerates junk", parseChoices("not json").length === 0);
ok("parseChoices tolerates null", parseChoices(null).length === 0);

// --- content integrity across the whole shipped pool ---
const validSkills = new Set([
  "cause",
  "single_cause",
  "extrapolation",
  "certainty",
  "base_rate",
  "buried_lede",
  "false_precision",
  "missing_sowhat",
  "absent_caveat",
  "padding",
]);
const titles = new Set<string>();
for (const d of DRILL_SEEDS) {
  ok(`skill valid: ${d.title}`, validSkills.has(d.skill), d.skill);
  ok(`unique title: ${d.title}`, !titles.has(d.title), "duplicate");
  titles.add(d.title);
  ok(`difficulty 1-3: ${d.title}`, d.difficulty >= 1 && d.difficulty <= 3, `${d.difficulty}`);
  if (d.mode === "spot") {
    ok(
      `spot has both tellings + device: ${d.title}`,
      !!d.faithfulText && !!d.overclaimedText && !!d.device
    );
  } else if (d.mode === "ledger") {
    // Ledger contract: 3-5 claims in reading order, 0-2 flagged as exceeding,
    // always >=2 clean claims, every claim has text + rationale, and (for the
    // HOLDS/EXCEEDS grammar) the skill must be fidelity-family.
    const cs = d.choices ?? [];
    const flagged = cs.filter((c) => c.correct).length;
    ok(`ledger has 3-5 claims: ${d.title}`, cs.length >= 3 && cs.length <= 5, `${cs.length}`);
    ok(`ledger flags 0-2: ${d.title}`, flagged >= 0 && flagged <= 2, `${flagged}`);
    ok(`ledger keeps >=2 clean: ${d.title}`, cs.length - flagged >= 2, `${cs.length - flagged} clean`);
    ok(
      `ledger claims all have text + rationale: ${d.title}`,
      cs.every((c) => c.text.trim().length > 0 && c.rationale.trim().length > 0)
    );
    ok(
      `ledger skill is fidelity-family: ${d.title}`,
      ["cause", "single_cause", "extrapolation", "certainty", "base_rate"].includes(d.skill),
      d.skill
    );
  } else {
    const n = (d.choices ?? []).filter((c) => c.correct).length;
    ok(`${d.mode} has exactly one correct: ${d.title}`, n === 1, `${n} correct`);
    ok(`${d.mode} has >=2 choices: ${d.title}`, (d.choices ?? []).length >= 2);
  }
}
console.log(`\n  (${DRILL_SEEDS.length} items checked)`);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
