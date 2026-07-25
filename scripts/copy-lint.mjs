// COPY LINT — counts the writing fingerprints that make prose read
// machine-generated, so the voice pass is measurable and CI can hold the line
// (docs/VOICE.md). Run `node scripts/copy-lint.mjs` for the report, or
// `node scripts/copy-lint.mjs --check` to fail when any group regresses past
// the thresholds recorded in scripts/copy-lint.baseline.json.
//
// Metrics (per corpus group, per 1k words where noted):
//   emdash      " — " spaced em-dashes /1k words
//   notthe      the "— not the Y" / ", not the Y" contrast construction /1k
//   epigram     share of explanations whose FINAL sentence is a short,
//               number-free epigram (< 60 chars) — the closing-aphorism habit
//   thecaps     "THE NOUN" all-caps names in UI surface files (absolute count)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

// ---- string extraction ------------------------------------------------------
function quizProse(file) {
  const items = JSON.parse(read(file));
  const out = [];
  for (const it of items) {
    for (const k of ["scenario", "prompt", "explanation"]) if (typeof it[k] === "string") out.push({ text: it[k], isExplanation: k === "explanation" });
    for (const c of it.choices ?? []) if (typeof c.rationale === "string") out.push({ text: c.rationale, isExplanation: false });
  }
  return out;
}
// crude but stable: every quoted string >= 40 chars with >= 4 spaces in a TS/TSX
// file is treated as prose (labels and class names fall below the bar).
function tsProse(file) {
  const src = read(file);
  const out = [];
  const re = /"((?:[^"\\\n]|\\.){40,}?)"/g;
  let m;
  while ((m = re.exec(src))) {
    const s = m[1];
    if ((s.match(/ /g) ?? []).length >= 4 && !/className|http|\\n/.test(s)) out.push({ text: s, isExplanation: /explanation/.test(src.slice(Math.max(0, m.index - 120), m.index)) });
  }
  return out;
}
function uiTheCaps(files) {
  let n = 0;
  for (const f of files) {
    const src = read(f);
    n += (src.match(/\bTHE [A-Z]{3,}/g) ?? []).length;
  }
  return n;
}

// ---- metrics ---------------------------------------------------------------
const words = (texts) => texts.reduce((s, t) => s + t.text.split(/\s+/).length, 0);
const per1k = (count, w) => Math.round((count / Math.max(1, w)) * 10000) / 10;
function countRe(texts, re) {
  return texts.reduce((s, t) => s + (t.text.match(re) ?? []).length, 0);
}
function epigramShare(texts) {
  const exps = texts.filter((t) => t.isExplanation);
  if (exps.length === 0) return 0;
  let hits = 0;
  for (const t of exps) {
    const sentences = t.text.split(/(?<=[.!?])\s+/).filter(Boolean);
    const last = sentences[sentences.length - 1] ?? "";
    if (last.length > 0 && last.length < 60 && !/\d/.test(last)) hits++;
  }
  return Math.round((hits / exps.length) * 100);
}

// ---- corpora ---------------------------------------------------------------
const GROUPS = {
  "statistics": ["prisma/quiz-source/statistics.json", "prisma/quiz-source/estimate.json", "prisma/quiz-source/flood.json", "prisma/quiz-source/pool.json"],
  "economics": ["prisma/quiz-source/economics.json", "prisma/quiz-source/market.json"],
  "architecture": ["prisma/quiz-source/architecture.json", "prisma/quiz-source/duel.json", "prisma/quiz-source/bakeoff.json", "prisma/quiz-source/redline.json"],
  "decision": ["prisma/quiz-source/decision.json", "prisma/quiz-source/gap.json"],
  "ml": ["prisma/quiz-source/ml.json", "prisma/quiz-source/payback.json"],
  "drills": ["prisma/drills.ts", "prisma/drills-pool.ts", "prisma/drills-edition2.ts", "prisma/drills-compose.ts"],
  "ui": ["src/app/page.tsx", "src/app/train/page.tsx", "src/app/train/[track]/TrackRoom.tsx", "src/app/drill/page.tsx", "src/lib/level.ts", "src/lib/train-tracks.ts"],
};
const UI_FILES = GROUPS.ui;

const NOTTHE = /(?:—|,)\s*not\s+(?:the|a|an|just|its|your|by|what)\b/g;
const EMDASH = / — /g;

const report = {};
for (const [name, files] of Object.entries(GROUPS)) {
  const texts = files.flatMap((f) => (f.endsWith(".json") ? quizProse(f) : tsProse(f)));
  const w = words(texts);
  report[name] = {
    words: w,
    emdash: per1k(countRe(texts, EMDASH), w),
    notthe: per1k(countRe(texts, NOTTHE), w),
    epigram: epigramShare(texts),
  };
}
report.ui.thecaps = uiTheCaps(UI_FILES);

const args = process.argv.slice(2);
if (args.includes("--baseline")) {
  writeFileSync(join(ROOT, "scripts/copy-lint.baseline.json"), JSON.stringify(report, null, 2));
  console.log("baseline written");
}

console.log("group           words  emdash/1k  notthe/1k  epigram%  thecaps");
for (const [name, r] of Object.entries(report)) {
  console.log(
    `${name.padEnd(15)}${String(r.words).padStart(6)}  ${String(r.emdash).padStart(8)}  ${String(r.notthe).padStart(8)}  ${String(r.epigram).padStart(7)}  ${r.thecaps ?? ""}`
  );
}

if (args.includes("--check")) {
  const basePath = join(ROOT, "scripts/copy-lint.baseline.json");
  if (!existsSync(basePath)) {
    console.error("copy-lint: no baseline recorded; run with --baseline first");
    process.exit(1);
  }
  const base = JSON.parse(readFileSync(basePath, "utf8"));
  let fail = 0;
  // 15% headroom over the recorded baseline; thecaps is absolute.
  for (const [name, r] of Object.entries(report)) {
    const b = base[name];
    if (!b) continue;
    for (const k of ["emdash", "notthe", "epigram"]) {
      if (r[k] > b[k] * 1.15 + 0.5) {
        console.error(`copy-lint: ${name}.${k} regressed (${r[k]} > baseline ${b[k]})`);
        fail = 1;
      }
    }
    if (name === "ui" && r.thecaps > b.thecaps) {
      console.error(`copy-lint: ui.thecaps regressed (${r.thecaps} > baseline ${b.thecaps})`);
      fail = 1;
    }
  }
  process.exit(fail);
}
