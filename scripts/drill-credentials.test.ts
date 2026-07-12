/**
 * Offline unit test for The Record (grades + credentials). Locks the two
 * properties the whole system leans on: every stamp is a pure recomputation of
 * attempt rows, and every criterion is MONOTONE — appending rows can never
 * un-earn anything. Run: npx tsx scripts/drill-credentials.test.ts
 */
import {
  conferrals,
  gradeFor,
  drillGradeLabel,
  CREDENTIALS,
  type CredAttempt,
} from "../src/lib/drill-credentials";
import { FIDELITY_SKILLS, CRAFT_SKILLS, SKILL_IDS } from "../src/lib/teaching";
import { fieldServesFaithful } from "../src/lib/drill-grade";

let failures = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = got === want;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` — got ${got}, want ${want}`}`);
  if (!ok) failures++;
};

const SID = "cred-test-session";
let t = 0;
const row = (over: Partial<CredAttempt> & { skill?: string; difficulty?: number; itemMode?: string }): CredAttempt => ({
  drillItemId: over.drillItemId ?? `item-${t}`,
  correct: over.correct ?? true,
  createdAt: new Date(2026, 0, 1, 0, 0, t++),
  ratingAfter: over.ratingAfter ?? null,
  namedSkill: over.namedSkill ?? null,
  mode: over.mode ?? "",
  item: {
    skill: over.skill ?? "cause",
    difficulty: over.difficulty ?? 1,
    mode: over.itemMode ?? "spot",
  },
});
const got = (rows: CredAttempt[], code: string) =>
  conferrals(SID, rows).find((c) => c.code === code)!.earnedAt !== null;

// --- CLEAN SWEEP -------------------------------------------------------------
const sweep = Array.from({ length: 8 }, () => row({ correct: true }));
eq("clean_sweep: 8 straight earns", got(sweep, "clean_sweep"), true);
eq("clean_sweep: 7 straight + miss does not", got([...sweep.slice(0, 7), row({ correct: false })], "clean_sweep"), false);

// --- THE FINE PRINT ----------------------------------------------------------
const finePrint = [
  ...["cause", "certainty", "base_rate", "extrapolation"].flatMap((s) =>
    [1, 2].map(() => row({ skill: s, difficulty: 3, correct: true }))
  ),
  row({ skill: "cause", difficulty: 3, correct: true }),
  row({ skill: "certainty", difficulty: 3, correct: true }),
];
eq("fine_print: 10 d3 catches over 4 skills earns", got(finePrint, "fine_print"), true);
eq("fine_print: 10 d3 catches over 3 skills does not", got(
  ["cause", "certainty", "base_rate"].flatMap((s) => Array.from({ length: 4 }, () => row({ skill: s, difficulty: 3, correct: true }))),
  "fine_print"
), false);

// --- SEALS (existential window, NOT trailing) --------------------------------
const sealRows = (skills: readonly string[]) =>
  skills.flatMap((s) => [
    row({ skill: s, difficulty: 2, correct: true }),
    row({ skill: s, correct: true }),
    row({ skill: s, correct: true }),
    row({ skill: s, correct: false }),
    row({ skill: s, correct: true }),
  ]); // window of 5 with 4 correct + a mid-tier catch
const fidelitySeal = sealRows(FIDELITY_SKILLS);
eq("fidelity_seal: 4-of-5 + mid catch on every fidelity skill earns", got(fidelitySeal, "fidelity_seal"), true);
eq("fidelity_seal: one skill missing does not", got(sealRows(FIDELITY_SKILLS.slice(0, 4)), "fidelity_seal"), false);
// existential: a later slump on one skill must NOT un-earn it
const slump = [...fidelitySeal, ...Array.from({ length: 10 }, () => row({ skill: FIDELITY_SKILLS[0], correct: false }))];
eq("fidelity_seal: later slump never un-earns (existential window)", got(slump, "fidelity_seal"), true);
eq("craft_seal: same fold over craft skills", got(sealRows(CRAFT_SKILLS), "craft_seal"), true);

// --- NAMED AND CAUGHT ---------------------------------------------------------
const named = Array.from({ length: 10 }, () => row({ skill: "padding", correct: true, namedSkill: "padding" }));
eq("named_caught: 10 caught+named earns", got(named, "named_caught"), true);
eq("named_caught: mis-named calls do not count", got(
  Array.from({ length: 10 }, () => row({ skill: "padding", correct: true, namedSkill: "cause" })),
  "named_caught"
), false);

// --- THE CORRECTION ------------------------------------------------------------
const correction = [
  row({ skill: "certainty", correct: false }),
  row({ skill: "certainty", correct: false }),
  row({ skill: "certainty", correct: true }),
  row({ skill: "certainty", correct: true }),
  row({ skill: "certainty", correct: true }),
];
eq("correction: behind then 3 straight earns", got(correction, "correction"), true);
eq("correction: 3 straight without ever being behind does not", got(
  Array.from({ length: 5 }, () => row({ skill: "certainty", correct: true })),
  "correction"
), false);

// --- FIELD stamps ---------------------------------------------------------------
// choose item ids by served parity so CLEAN HANDS is deterministic
const faithfulIds: string[] = [];
const overIds: string[] = [];
for (let k = 0; faithfulIds.length < 12 || overIds.length < 12; k++) {
  (fieldServesFaithful(SID, `f-${k}`) ? faithfulIds : overIds).push(`f-${k}`);
}
const fieldSkills = ["cause", "certainty", "base_rate", "extrapolation"];
const coldReader = Array.from({ length: 10 }, (_, i) =>
  row({ drillItemId: overIds[i], mode: "field", correct: true, skill: fieldSkills[i % 4] })
);
eq("cold_reader: 10 correct field reads across 4 skills earns", got(coldReader, "cold_reader"), true);
eq("cold_reader: 9 do not", got(coldReader.slice(0, 9), "cold_reader"), false);
const cleanHands = Array.from({ length: 8 }, (_, i) =>
  row({ drillItemId: faithfulIds[i], mode: "field", correct: true, skill: fieldSkills[i % 4] })
);
eq("clean_hands: 8 faithful tellings cleared earns", got(cleanHands, "clean_hands"), true);
eq("clean_hands: overclaimed catches do not count toward it", got(coldReader, "clean_hands"), false);

// --- THE AUDITOR -----------------------------------------------------------------
const auditor = [
  row({ itemMode: "ledger", correct: true, difficulty: 2 }),
  row({ itemMode: "ledger", correct: true, difficulty: 3 }),
  row({ itemMode: "ledger", correct: true, difficulty: 1 }),
  row({ itemMode: "ledger", correct: true, difficulty: 1 }),
  row({ itemMode: "ledger", correct: true, difficulty: 1 }),
];
eq("auditor: 5 perfect ledgers, 2 mid+ earns", got(auditor, "auditor"), true);
eq("auditor: 5 perfect but only 1 mid+ does not", got(
  [row({ itemMode: "ledger", correct: true, difficulty: 2 }), ...Array.from({ length: 4 }, () => row({ itemMode: "ledger", correct: true, difficulty: 1 }))],
  "auditor"
), false);

// --- EXPLORATION -------------------------------------------------------------------
const rounds = SKILL_IDS.map((s) => row({ skill: s, correct: false }));
eq("rounds: facing all ten earns (correctness not required)", got(rounds, "rounds"), true);
eq("rounds: nine skills does not", got(rounds.slice(0, 9), "rounds"), false);
const benches = [
  row({ itemMode: "spot" }),
  row({ itemMode: "fix" }),
  row({ itemMode: "calibrate" }),
  row({ mode: "field", itemMode: "spot" }),
  row({ itemMode: "ledger" }),
];
eq("all_benches: one call on each of 5 instruments earns", got(benches, "all_benches"), true);
eq("all_benches: four instruments does not", got(benches.slice(0, 4), "all_benches"), false);
const deep = [row({ skill: "cause", difficulty: 3, correct: false }), row({ skill: "padding", difficulty: 3, correct: false })];
eq("deep_end: a d3 attempt in both families earns, correct not required", got(deep, "deep_end"), true);
eq("deep_end: one family only does not", got([deep[0]], "deep_end"), false);

// --- MONOTONICITY (the load-bearing property) -----------------------------------------
const noise = Array.from({ length: 40 }, (_, i) =>
  row({ skill: SKILL_IDS[i % 10], correct: i % 3 === 0, difficulty: (i % 3) + 1, mode: i % 4 === 0 ? "field" : "" })
);
for (const [name, fixture] of [
  ["clean_sweep", sweep],
  ["fine_print", finePrint],
  ["fidelity_seal", fidelitySeal],
  ["named_caught", named],
  ["correction", correction],
  ["cold_reader", coldReader],
  ["clean_hands", cleanHands],
  ["auditor", auditor],
  ["rounds", rounds],
  ["all_benches", benches],
  ["deep_end", deep],
] as [string, CredAttempt[]][]) {
  eq(`monotone: ${name} survives 40 arbitrary appended rows`, got([...fixture, ...noise], name), true);
}
eq("all 12 credentials are defined", CREDENTIALS.length, 12);

// --- GRADES ------------------------------------------------------------------------------
// Grade II via ratingAfter trail: 10 calls, catches in both families, crossing 1240.
const gradeII = [
  ...Array.from({ length: 5 }, (_, i) => row({ skill: "cause", correct: true, ratingAfter: 1200 + i * 8 })),
  ...Array.from({ length: 4 }, (_, i) => row({ skill: "padding", correct: true, ratingAfter: 1232 + i * 2 })),
  row({ skill: "cause", correct: true, ratingAfter: 1250 }),
];
const g2 = gradeFor(gradeII, 1250);
eq("grade II earned via ratingAfter trail", g2.grade.n, 2);
eq("grade II conferral date is the crossing attempt's", g2.earnedAt?.getTime(), gradeII[9].createdAt.getTime());
// monotone: a later slump below the floor does not demote
const slumped = [...gradeII, ...Array.from({ length: 6 }, () => row({ skill: "cause", correct: false, ratingAfter: 1100 }))];
eq("grade II survives a later slump (monotone)", gradeFor(slumped, 1100).grade.n, 2);
// pre-instrument rows: null ratingAfter everywhere, live rating carries via the virtual terminal row
const preInstrument = [
  ...Array.from({ length: 6 }, () => row({ skill: "cause", correct: true })),
  ...Array.from({ length: 5 }, () => row({ skill: "padding", correct: true })),
];
eq("grade II from a pre-instrument record + live rating", gradeFor(preInstrument, 1300).grade.n, 2);
eq("no grade II when the gate is unmet even above the floor", gradeFor(
  Array.from({ length: 12 }, () => row({ skill: "cause", correct: true })), // no craft catch
  1300
).grade.n, 1);
eq("grade I holds with an empty record", gradeFor([], 1200).grade.n, 1);
eq("nextGate names a concrete need", gradeFor([], 1200).nextGate?.includes("GRADE II"), true);
eq("poster label is neutral English", drillGradeLabel(gradeII, 1250), "Grade II · Close Reader");

// --- v3 guard: exam rows see through to the item's own mode -------------------
const examLedger = [
  row({ itemMode: "ledger", mode: "exam", correct: true, difficulty: 2 }),
  row({ itemMode: "ledger", mode: "exam", correct: true, difficulty: 3 }),
  ...Array.from({ length: 3 }, () => row({ itemMode: "ledger", correct: true, difficulty: 1 })),
];
eq("auditor counts exam-served ledgers", got(examLedger, "auditor"), true);
const examBenches = [
  row({ itemMode: "spot" }),
  row({ itemMode: "fix" }),
  row({ itemMode: "calibrate" }),
  row({ itemMode: "ledger" }),
  row({ mode: "exam", itemMode: "spot" }), // an exam spot IS a spot — no sixth bench
];
eq("exam rows cannot mint ALL BENCHES", got(examBenches, "all_benches"), false);
eq("field still completes the benches", got([...examBenches.slice(0, 4), row({ mode: "field", itemMode: "spot" })], "all_benches"), true);
// regression: a pre-v3 history (modes "" and "field" only) is untouched by the guard
const preV3 = [...sweep, ...coldReader, ...benches];
const before = JSON.stringify(conferrals(SID, preV3).map((c) => ({ c: c.code, e: c.earnedAt?.getTime() ?? null })));
eq("pre-v3 records are byte-identical under the guard", JSON.stringify(conferrals(SID, preV3).map((c) => ({ c: c.code, e: c.earnedAt?.getTime() ?? null }))), before);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
