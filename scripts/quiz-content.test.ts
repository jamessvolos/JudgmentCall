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
  ok(["mcq", "estimate", "duel"].includes(q.kind), `${label}: kind is mcq|estimate|duel`);
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
    const p = q.payload as { better: string; designA: { name: string }; designB: { name: string } };
    ok(!!p && (p.better === "A" || p.better === "B"), `${label}: duel better is A|B`);
    ok(!!p.designA?.name && !!p.designB?.name, `${label}: duel has two named designs`);
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
