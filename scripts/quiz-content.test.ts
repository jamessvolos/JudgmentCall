/**
 * Content-integrity test for the Training Track seed pool. Locks the shape the
 * serving/grading path depends on: exactly one correct choice per item, valid
 * topic ids, non-empty prose, unique titles. Run: npx tsx scripts/quiz-content.test.ts
 */
import { QUIZ_SEEDS } from "../prisma/quiz";
import { TRACKS } from "../src/lib/train-tracks";

let failures = 0;
const ok = (cond: boolean, name: string) => {
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}`);
  if (!cond) failures++;
};

const titles = new Set<string>();
let dupTitles = 0;
const perTopic: Record<string, number> = {};

for (const q of QUIZ_SEEDS) {
  const track = TRACKS[q.track];
  const label = q.title;
  ok(!!track, `${label}: track "${q.track}" is a real track`);
  if (!track) continue;
  ok(track.topics.some((t) => t.id === q.topic), `${label}: topic "${q.topic}" exists in ${q.track}`);
  ok([1, 2, 3].includes(q.difficulty), `${label}: difficulty in 1..3`);
  ok(["mcq", "estimate", "duel", "bakeoff", "flood"].includes(q.kind), `${label}: kind is mcq|estimate|duel|bakeoff|flood`);
  ok(!!q.scenario.trim() && !!q.prompt.trim() && !!q.explanation.trim(), `${label}: scenario/prompt/explanation non-empty`);
  if (q.kind === "mcq") {
    ok(q.choices.filter((c) => c.correct).length === 1, `${label}: exactly one correct choice`);
    ok(q.choices.length >= 2 && q.choices.length <= 5, `${label}: 2-5 choices`);
    ok(q.choices.every((c) => c.text.trim() && c.rationale.trim()), `${label}: every choice has text + rationale`);
  } else if (q.kind === "estimate") {
    const p = q.payload as { min: number; max: number; truth: number; good: { lo: number; hi: number } };
    ok(!!p && p.min < p.good.lo && p.good.lo < p.truth && p.truth < p.good.hi && p.good.hi < p.max, `${label}: estimate ordering invariant holds`);
    ok(q.choices.length === 0, `${label}: estimate carries no choices`);
  } else if (q.kind === "duel") {
    const p = q.payload as { better: string; designA: { name: string }; designB: { name: string }; alsoFits?: string };
    ok(!!p && (p.better === "A" || p.better === "B"), `${label}: duel better is A|B`);
    ok(!!p.designA?.name && !!p.designB?.name, `${label}: duel has two named designs`);
    ok(!!p.alsoFits && p.alsoFits.trim().length > 0, `${label}: duel has an "also defensible" note`);
  } else if (q.kind === "bakeoff") {
    const p = q.payload as { keys: { id: string; shards: number[] }[]; best: string };
    ok(!!p && p.keys.length >= 2, `${label}: bakeoff has >=2 candidate keys`);
    ok(p.keys.every((k) => Array.isArray(k.shards) && k.shards.length === 8), `${label}: every key has 8 shards`);
    const maxOf = (k: { shards: number[] }) => Math.max(...k.shards);
    const best = p.keys.find((k) => k.id === p.best)!;
    ok(!!best && p.keys.every((k) => k.id === p.best || maxOf(k) >= maxOf(best)), `${label}: best is the most balanced key`);
  } else if (q.kind === "flood") {
    const p = q.payload as { sensitivity: number; specificity: number; min: number; max: number; truth: number };
    // truth is the prevalence at which PPV = 50%: p·sens = (1−p)·(1−spec).
    const expected = Math.round(((100 - p.specificity) / (p.sensitivity + (100 - p.specificity))) * 100 * 10) / 10;
    ok(!!p && Math.abs(expected - p.truth) <= 0.15, `${label}: flood truth is the PPV-50 prevalence`);
    ok(p.min < p.truth && p.truth < p.max, `${label}: flood truth sits inside the slider range`);
    ok(q.choices.length === 0, `${label}: flood carries no choices`);
  }
  if (titles.has(q.title)) dupTitles++;
  titles.add(q.title);
  perTopic[`${q.track}/${q.topic}`] = (perTopic[`${q.track}/${q.topic}`] ?? 0) + 1;
}

ok(dupTitles === 0, `all titles unique (${dupTitles} dup${dupTitles === 1 ? "" : "s"})`);

// Every topic in every track should carry at least a couple of items so a
// topic-filtered run is never empty.
for (const track of Object.values(TRACKS)) {
  for (const topic of track.topics) {
    const n = perTopic[`${track.id}/${topic.id}`] ?? 0;
    ok(n >= 2, `${track.id}/${topic.id}: has ${n} items (>=2)`);
  }
}

console.log(`\n  (${QUIZ_SEEDS.length} quiz items checked · ${failures === 0 ? "ALL PASS" : `${failures} FAILURES`})`);
if (failures > 0) process.exit(1);
