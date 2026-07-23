/**
 * THE LADDER — locks the seniority-read rubric (docs/LADDER-10X.md). The rung
 * is stored on attempt rows like `correct`, so a silent rule change would
 * corrupt history; this table pins every row of the canonical rule table plus
 * the windowed read's thresholds and cold-start gate.
 * Run: npx tsx scripts/level.test.ts
 */
import {
  levelPick,
  levelNumeric,
  levelPaybackFinite,
  levelPaybackNever,
  levelEstimate,
  levelDrill,
  nextRungLine,
  KIND_TEMPLATES,
} from "../src/lib/level";
import { recentRead, type QuizRow } from "../src/lib/train-tracks";

let failures = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = got === want;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
  if (!ok) failures++;
};

// --- pick kinds (mcq / duel / bakeoff): conviction-gated, difficulty-gated ---
eq("pick: miss is ENTRY", levelPick(false, 50, 3).rung, 0);
eq("pick: confident miss is ENTRY (with the sting)", levelPick(false, 95, 3).rung, 0);
eq("pick: correct hedged is SENIOR", levelPick(true, 70, 3).rung, 1);
eq("pick: correct committed on subtle is PRINCIPAL", levelPick(true, 85, 2).rung, 2);
eq("pick: correct committed on a gimme caps at SENIOR", levelPick(true, 95, 1).rung, 1);
eq("pick: null confidence reads hedged", levelPick(true, null, 3).rung, 1);

// --- numeric kinds: precision-gated (unstakeable) ---
eq("numeric: miss is ENTRY", levelNumeric(false, false, 10, 4).rung, 0);
eq("numeric: trap is ENTRY", levelNumeric(false, true, 10, 4).rung, 0);
eq("numeric: inside tol is SENIOR", levelNumeric(true, false, 3, 4).rung, 1);
eq("numeric: half-tol tight is PRINCIPAL", levelNumeric(true, false, 2, 4).rung, 2);
eq("numeric: exactly tol/2 is PRINCIPAL", levelNumeric(true, false, 2.0, 4.0).rung, 2);

// --- payback: dex space + the NEVER latch ---
eq("payback finite: trap is ENTRY", levelPaybackFinite(false, true, 0.5, 0.15).rung, 0);
eq("payback finite: in-band is SENIOR", levelPaybackFinite(true, false, 0.1, 0.15).rung, 1);
eq("payback finite: half-band is PRINCIPAL", levelPaybackFinite(true, false, 0.07, 0.15).rung, 2);
eq("payback NEVER: finite commit is ENTRY", levelPaybackNever(false, 95, 3).rung, 0);
eq("payback NEVER: latched hedged is SENIOR", levelPaybackNever(true, 50, 3).rung, 1);
eq("payback NEVER: latched committed on subtle is PRINCIPAL", levelPaybackNever(true, 85, 2).rung, 2);
eq("payback NEVER: latched committed on a gimme caps at SENIOR", levelPaybackNever(true, 95, 1).rung, 1);

// --- estimate: the band is the conviction ---
eq("estimate: escaped band is ENTRY", levelEstimate(false, false, 10, 8).rung, 0);
eq("estimate: barn-door capture is ENTRY", levelEstimate(false, true, 30, 8).rung, 0);
eq("estimate: working band is SENIOR", levelEstimate(true, true, 12, 8).rung, 1);
eq("estimate: desk-sharp band is PRINCIPAL", levelEstimate(true, true, 7, 8).rung, 2);

// --- drill: name the move ---
eq("drill: miss is ENTRY", levelDrill(false, false).rung, 0);
eq("drill: caught unnamed is SENIOR", levelDrill(true, false).rung, 1);
eq("drill: caught and named is PRINCIPAL", levelDrill(true, true).rung, 2);

// --- next-rung computed lines: exact formulas from served payloads ---
const pbLine = nextRungLine("payback", { payback: { pLong: 2400, pShort: 150, out: 1000, premium: 2 } }, {});
eq("payback flip premium computed (3400/1150 ≈ 3)", pbLine?.includes("3×") ?? false, true);
const mkLine = nextRungLine("market", {}, { lever: "tax", demand: { a: 100, b: 2 }, supply: { c: 10, d: 3 } });
eq("market incidence split computed (3/5 = 60%)", mkLine?.includes("60%") ?? false, true);
eq("market non-tax lever falls back to template", nextRungLine("market", {}, { lever: "none" }), null);
const flLine = nextRungLine("flood", { flood: { sensitivity: 90, specificity: 91 } }, {});
eq("flood two-test line computed ((9/90)²=0.01 → ~1%)", flLine?.includes("1%") ?? false, true);
eq("every kind has a template", ["mcq", "estimate", "duel", "bakeoff", "flood", "market", "redline", "pool", "gap", "payback"].every((k) => !!KIND_TEMPLATES[k]), true);

// --- the windowed read: thresholds break downward, cold-start gates ---
const t0 = Date.now();
let n = 0;
const row = (level: number | null): QuizRow => ({
  quizItemId: `q${n}`, topic: "sampling", difficulty: 2, correct: true, confidence: null,
  captured: null, level, ratingAfter: 1300, createdAt: new Date(t0 + n++ * 1000),
});
eq("read: <6 leveled rows → no read (need counts down)", recentRead([row(1), row(1), row(2)])?.need, 3);
eq("read: legacy null rows are excluded", recentRead([row(null), row(null), row(null), row(1), row(1)])?.need, 4);
const twelve = (levels: number[]) => levels.map(row);
eq("read: all-senior reads SENIOR", recentRead(twelve([1, 1, 1, 1, 1, 1]))?.rung, 1);
eq("read: mean 1.5 reads PRINCIPAL", recentRead(twelve([1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2]))?.rung, 2);
eq("read: mean ~1.41 breaks DOWN to SENIOR", recentRead(twelve([1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 1]))?.rung, 1);
eq("read: mean 0.5 reads ENTRY", recentRead(twelve([0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0]))?.rung, 0);
eq("read: window is the LAST 12", recentRead([...twelve([0, 0, 0, 0, 0, 0]), ...twelve([2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2])])?.rung, 2);
eq("read: principal count reported", recentRead(twelve([2, 2, 1, 1, 1, 1]))?.principals, 2);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
