// TRAINING TRACKS — the registry and scoring for the two multiple-choice
// Training Rooms (statistics, data-engineering architecture). This is a
// SEPARATE WORLD from the overclaim drill: it shares none of its vocabulary,
// imports none of its modules, and its attempts never enter the study. Each
// track carries its own curriculum (topics), its own level ladder, and its own
// badges.
//
// Everything the learner sees about their standing is a PURE FOLD over their
// QuizAttempt rows — a level is earned when the rows first satisfy its gate, a
// badge when the rows first satisfy its predicate. Nothing about standing is
// stored; there is nothing that can drift from the ledger. The only mutable
// numbers are the Elo ratings (session-side lives in QuizAttempt.ratingAfter,
// item-side on QuizItem.rating), exactly as the drill does it.
//
// This module is pure (no crypto, no Prisma), so it is safe to import from both
// the server (repo, API) and the client (the /train page).

export type TrackId = "statistics" | "architecture";

export type Topic = {
  id: string;
  name: string; // display name
  short: string; // chip label
  concept: string; // one- to two-sentence teaching blurb (curriculum card)
};

export type Level = {
  n: 1 | 2 | 3 | 4 | 5;
  roman: string;
  title: string;
  floor: number | null; // rating floor; null = held by everyone
  minCalls: number; // graded calls logged
  minTopics: number; // distinct topics faced
  minHard: number; // difficulty-3 calls answered correctly
  gate: string; // fine print
};

export type BadgeTier = "competence" | "exploration";

export type Badge = {
  code: string;
  name: string;
  tier: BadgeTier;
  criterion: string; // printed verbatim on the face
};

export type Track = {
  id: TrackId;
  name: string; // "Statistics"
  room: string; // "THE STATS ROOM"
  tagline: string; // hero subline
  blurb: string; // one paragraph, what the room trains
  accentNote: string; // short editorial line under the level meter
  topics: Topic[];
  levels: Level[];
  badges: Badge[];
};

// ---------------------------------------------------------------------------
// The attempt row the folds operate on — the minimal projection of QuizAttempt.
export type QuizRow = {
  quizItemId: string;
  topic: string;
  difficulty: number;
  correct: boolean;
  ratingAfter: number | null;
  createdAt: Date;
};

// ---------------------------------------------------------------------------
// STATISTICS — reading numbers honestly.

const STATS_TOPICS: Topic[] = [
  {
    id: "sampling",
    name: "Sampling & representativeness",
    short: "Sampling",
    concept:
      "A number only speaks for whoever it measured. Ask who is missing — the non-responders, the survivors, the self-selected — before you let a sample stand in for everyone.",
  },
  {
    id: "variation",
    name: "Noise & regression to the mean",
    short: "Noise",
    concept:
      "Small samples swing wildly, and extreme readings tend to drift back toward average on their own. Separate the signal from the wobble before you name a cause.",
  },
  {
    id: "association",
    name: "Correlation & confounding",
    short: "Correlation",
    concept:
      "Two series moving together can share a hidden third cause, or point the other way. A causal claim needs an experiment or a ruled-out alternative, not just a tight fit.",
  },
  {
    id: "base_rates",
    name: "Base rates & conditional probability",
    short: "Base rates",
    concept:
      "A test's accuracy means little without the underlying rate. When the condition is rare, even a good test produces mostly false positives — the base rate rules the result.",
  },
  {
    id: "uncertainty",
    name: "Intervals & significance",
    short: "Uncertainty",
    concept:
      "A confidence interval is a range the method captures most of the time, not a probability about one number. 'Significant' means detectable, not large — check the effect size.",
  },
  {
    id: "aggregation",
    name: "Aggregation traps",
    short: "Aggregation",
    concept:
      "Combining groups can reverse a trend (Simpson's paradox), and a mean can hide a skew a median would expose. How you pool the data is itself a claim.",
  },
];

const STATS_LEVELS: Level[] = [
  { n: 1, roman: "I", title: "Reader", floor: null, minCalls: 0, minTopics: 0, minHard: 0, gate: "Walk in. Everyone holds it." },
  { n: 2, roman: "II", title: "Skeptic", floor: 1260, minCalls: 8, minTopics: 3, minHard: 0, gate: "Reading at 1260 · 8 calls · three topics faced" },
  { n: 3, roman: "III", title: "Analyst", floor: 1350, minCalls: 20, minTopics: 6, minHard: 3, gate: "Reading at 1350 · 20 calls · all six topics faced · 3 subtle-tier calls landed" },
  { n: 4, roman: "IV", title: "Statistician", floor: 1440, minCalls: 35, minTopics: 6, minHard: 6, gate: "Reading at 1440 · 35 calls · 6 subtle-tier landed · a call in every topic" },
  { n: 5, roman: "V", title: "Quant", floor: 1520, minCalls: 50, minTopics: 6, minHard: 10, gate: "Reading at 1520 · 50 calls · subtle-tier landed across four or more topics" },
];

const STATS_BADGES: Badge[] = [
  { code: "sweep", name: "CLEAN SWEEP", tier: "competence", criterion: "Eight consecutive calls, all correct." },
  { code: "fine_print", name: "THE FINE PRINT", tier: "competence", criterion: "Six subtle-tier calls landed, across three or more topics." },
  { code: "specialist", name: "SPECIALIST", tier: "competence", criterion: "Five correct in a single topic, at least one above the easy tier." },
  { code: "correction", name: "THE CORRECTION", tier: "competence", criterion: "A topic that was beating you, beaten: behind in it, then three straight." },
  { code: "full_map", name: "THE FULL MAP", tier: "exploration", criterion: "Faced all six topics." },
  { code: "deep_end", name: "THE DEEP END", tier: "exploration", criterion: "Took a subtle-tier call in four or more topics — landing it not required." },
];

// ---------------------------------------------------------------------------
// ARCHITECTURE — data-engineering tradeoffs under real constraints.

const ARCH_TOPICS: Topic[] = [
  {
    id: "storage",
    name: "Storage & layout",
    short: "Storage",
    concept:
      "Row stores serve whole records fast (OLTP); columnar stores scan a few fields over billions of rows (OLAP). Normalization trades write-simplicity for read-cost — pick for the query, not the diagram.",
  },
  {
    id: "processing",
    name: "Batch & streaming",
    short: "Processing",
    concept:
      "Streaming buys freshness at the cost of complexity and dedup discipline. Real-time is only worth it when a decision genuinely can't wait for the next batch.",
  },
  {
    id: "modeling",
    name: "Data modeling & schema",
    short: "Modeling",
    concept:
      "A star schema and slowly-changing dimensions trade storage for queryability and history. Schemas evolve — design the migration path before the first column ships.",
  },
  {
    id: "scaling",
    name: "Partitioning & consistency",
    short: "Scaling",
    concept:
      "The partition key decides your hot spots; under a network split you choose consistency or availability, not both. Scale is a distribution problem before it is a hardware one.",
  },
  {
    id: "reliability",
    name: "Reliability & correctness",
    short: "Reliability",
    concept:
      "At-least-once delivery plus idempotent writes beats chasing exactly-once. Late and out-of-order data is normal, not exceptional — backfills and quality checks are part of the design.",
  },
  {
    id: "cost",
    name: "Cost & efficiency",
    short: "Cost",
    concept:
      "Separating storage from compute, pruning scans with partitioning and columnar formats, and caching hot reads move the cost curve more than bigger machines. The cheapest pipeline is often the one you don't build.",
  },
];

const ARCH_LEVELS: Level[] = [
  { n: 1, roman: "I", title: "Reader", floor: null, minCalls: 0, minTopics: 0, minHard: 0, gate: "Walk in. Everyone holds it." },
  { n: 2, roman: "II", title: "Builder", floor: 1260, minCalls: 8, minTopics: 3, minHard: 0, gate: "Reading at 1260 · 8 calls · three topics faced" },
  { n: 3, roman: "III", title: "Engineer", floor: 1350, minCalls: 20, minTopics: 6, minHard: 3, gate: "Reading at 1350 · 20 calls · all six topics faced · 3 senior-tier calls landed" },
  { n: 4, roman: "IV", title: "Architect", floor: 1440, minCalls: 35, minTopics: 6, minHard: 6, gate: "Reading at 1440 · 35 calls · 6 senior-tier landed · a call in every topic" },
  { n: 5, roman: "V", title: "Principal", floor: 1520, minCalls: 50, minTopics: 6, minHard: 10, gate: "Reading at 1520 · 50 calls · senior-tier landed across four or more topics" },
];

const ARCH_BADGES: Badge[] = [
  { code: "sweep", name: "CLEAN SWEEP", tier: "competence", criterion: "Eight consecutive calls, all correct." },
  { code: "fine_print", name: "THE HARD CALL", tier: "competence", criterion: "Six senior-tier calls landed, across three or more topics." },
  { code: "specialist", name: "DOMAIN EXPERT", tier: "competence", criterion: "Five correct in a single topic, at least one above the easy tier." },
  { code: "correction", name: "THE CORRECTION", tier: "competence", criterion: "A topic that was beating you, beaten: behind in it, then three straight." },
  { code: "full_map", name: "THE FULL MAP", tier: "exploration", criterion: "Faced all six topics." },
  { code: "deep_end", name: "THE DEEP END", tier: "exploration", criterion: "Took a senior-tier call in four or more topics — landing it not required." },
];

export const TRACKS: Record<TrackId, Track> = {
  statistics: {
    id: "statistics",
    name: "Statistics",
    room: "THE STATS ROOM",
    tagline: "Read the numbers the way the data actually supports.",
    blurb:
      "Six ways a true number gets misread — a biased sample, a lucky streak, a confounded correlation, a neglected base rate, a misheard interval, a pooling trap. Each call is one scenario and one question; the reveal names the principle so you carry it to the next one.",
    accentNote: "Rating moves like a chess ladder — the harder the call, the more it swings.",
    topics: STATS_TOPICS,
    levels: STATS_LEVELS,
    badges: STATS_BADGES,
  },
  architecture: {
    id: "architecture",
    name: "Data Architecture",
    room: "THE ARCHITECTURE ROOM",
    tagline: "Pick the design the constraints actually call for.",
    blurb:
      "Every call states a real constraint — a latency budget, a scan bill, a read/write ratio, a partition tolerance — and asks which design fits. The wrong answers are good engineering in the wrong context. The reveal names the tradeoff axis, so the judgment transfers.",
    accentNote: "Rating moves like a chess ladder — the harder the call, the more it swings.",
    topics: ARCH_TOPICS,
    levels: ARCH_LEVELS,
    badges: ARCH_BADGES,
  },
};

export const TRACK_IDS: TrackId[] = ["statistics", "architecture"];

export function isTrackId(x: string): x is TrackId {
  return x === "statistics" || x === "architecture";
}

export function getTrack(id: string): Track | null {
  return isTrackId(id) ? TRACKS[id] : null;
}

export function topicOf(track: Track, id: string): Topic {
  return (
    track.topics.find((t) => t.id === id) ?? {
      id,
      name: "General",
      short: "General",
      concept: "",
    }
  );
}

// ---------------------------------------------------------------------------
// FOLDS — pure functions over the ordered attempt ledger. Rows must be sorted
// ascending by createdAt (the caller guarantees this).

const HARD = 3; // difficulty threshold that counts as a "subtle/senior-tier" call

export function liveRating(rows: QuizRow[]): number {
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].ratingAfter != null) return rows[i].ratingAfter as number;
  }
  return 1200;
}

/** First index at which prefix rows[0..i] satisfy `p`; -1 if never. */
function firstIndex(rows: QuizRow[], p: (prefix: QuizRow[]) => boolean): number {
  for (let i = 0; i < rows.length; i++) {
    if (p(rows.slice(0, i + 1))) return i;
  }
  return -1;
}

function distinctTopics(rows: QuizRow[]): Set<string> {
  return new Set(rows.map((r) => r.topic));
}

function hardCorrect(rows: QuizRow[]): QuizRow[] {
  return rows.filter((r) => r.correct && r.difficulty >= HARD);
}

/** True once the prefix satisfies a level's full gate. Monotone-friendly: uses
 *  the running rating (ratingAfter of the last row in the prefix). */
function levelGateMet(level: Level, prefix: QuizRow[]): boolean {
  if (level.n === 1) return true;
  const rating = liveRating(prefix);
  return (
    (level.floor == null || rating >= level.floor) &&
    prefix.length >= level.minCalls &&
    distinctTopics(prefix).size >= level.minTopics &&
    hardCorrect(prefix).length >= level.minHard
  );
}

export type LevelStanding = {
  level: Level;
  earnedAt: Date | null; // when the current level's gate first held; null for level I baseline
  nextGate: { level: Level; gate: string } | null; // the next rung, or null at the top
  // progress toward the next rung (for a meter)
  toNext: { rating: number; floor: number | null; calls: number; minCalls: number; topics: number; minTopics: number; hard: number; minHard: number } | null;
};

/** The highest level whose gate the ledger has EVER satisfied (earned and kept
 *  — an achievement, not a fluctuating rank). */
export function levelStanding(track: Track, rows: QuizRow[]): LevelStanding {
  let current = track.levels[0];
  let earnedAt: Date | null = null;
  for (const level of track.levels) {
    if (level.n === 1) {
      current = level;
      continue;
    }
    const idx = firstIndex(rows, (prefix) => levelGateMet(level, prefix));
    if (idx >= 0) {
      current = level;
      earnedAt = rows[idx].createdAt;
    } else {
      break; // levels are ordered; the first unmet rung stops the climb
    }
  }
  const next = track.levels.find((l) => l.n === current.n + 1) ?? null;
  const rating = liveRating(rows);
  return {
    level: current,
    earnedAt,
    nextGate: next ? { level: next, gate: next.gate } : null,
    toNext: next
      ? {
          rating: Math.round(rating),
          floor: next.floor,
          calls: rows.length,
          minCalls: next.minCalls,
          topics: distinctTopics(rows).size,
          minTopics: next.minTopics,
          hard: hardCorrect(rows).length,
          minHard: next.minHard,
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Badge predicates — each returns the earliest index the badge is earned, or -1.

function longestStreakReaches(rows: QuizRow[], n: number): number {
  let run = 0;
  for (let i = 0; i < rows.length; i++) {
    run = rows[i].correct ? run + 1 : 0;
    if (run >= n) return i;
  }
  return -1;
}

function specialistIndex(rows: QuizRow[]): number {
  // first index at which some topic has ≥5 correct with ≥1 above easy tier
  const byTopic: Record<string, { correct: number; hardish: number }> = {};
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.correct) {
      const t = (byTopic[r.topic] ||= { correct: 0, hardish: 0 });
      t.correct += 1;
      if (r.difficulty >= 2) t.hardish += 1;
      if (t.correct >= 5 && t.hardish >= 1) return i;
    }
  }
  return -1;
}

function correctionIndex(rows: QuizRow[]): number {
  // a topic that was behind (wrong > right, ≥3 attempts in it) and then three
  // straight correct in that topic. Scan per row, tracking per-topic history.
  const hist: Record<string, boolean[]> = {};
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const h = (hist[r.topic] ||= []);
    h.push(r.correct);
    // was it behind BEFORE this streak of three closed? Check: last three are
    // all correct, and at the point three-ago the topic was behind.
    if (h.length >= 3 && h[h.length - 1] && h[h.length - 2] && h[h.length - 3]) {
      const before = h.slice(0, h.length - 3);
      const wrong = before.filter((c) => !c).length;
      const right = before.filter((c) => c).length;
      if (before.length >= 3 && wrong > right) return i;
    }
  }
  return -1;
}

function fullMapIndex(rows: QuizRow[], nTopics: number): number {
  return firstIndex(rows, (prefix) => distinctTopics(prefix).size >= nTopics);
}

function finePrintIndex(rows: QuizRow[]): number {
  // six subtle-tier (d3) calls landed, across three or more topics
  return firstIndex(rows, (prefix) => {
    const hc = hardCorrect(prefix);
    return hc.length >= 6 && new Set(hc.map((r) => r.topic)).size >= 3;
  });
}

function deepEndIndex(rows: QuizRow[]): number {
  // took a subtle-tier call (landed or not) in four or more topics
  return firstIndex(rows, (prefix) => {
    const tried = new Set(prefix.filter((r) => r.difficulty >= HARD).map((r) => r.topic));
    return tried.size >= 4;
  });
}

export type Conferral = {
  code: string;
  name: string;
  tier: BadgeTier;
  criterion: string;
  earnedAt: Date | null;
};

/** Every badge for a track, each with its earned timestamp (null = not yet). */
export function badgeConferrals(track: Track, rows: QuizRow[]): Conferral[] {
  const nTopics = track.topics.length;
  const idxFor: Record<string, number> = {
    sweep: longestStreakReaches(rows, 8),
    fine_print: finePrintIndex(rows),
    specialist: specialistIndex(rows),
    correction: correctionIndex(rows),
    full_map: fullMapIndex(rows, nTopics),
    deep_end: deepEndIndex(rows),
  };
  return track.badges.map((b) => ({
    code: b.code,
    name: b.name,
    tier: b.tier,
    criterion: b.criterion,
    earnedAt: idxFor[b.code] >= 0 ? rows[idxFor[b.code]].createdAt : null,
  }));
}

// ---------------------------------------------------------------------------
// Per-topic progress — for the curriculum map (faced / correct / accuracy).

export type TopicProgress = {
  id: string;
  faced: number;
  correct: number;
  hardFaced: number;
  hardCorrect: number;
};

export function topicProgress(track: Track, rows: QuizRow[]): TopicProgress[] {
  return track.topics.map((t) => {
    const tr = rows.filter((r) => r.topic === t.id);
    return {
      id: t.id,
      faced: tr.length,
      correct: tr.filter((r) => r.correct).length,
      hardFaced: tr.filter((r) => r.difficulty >= HARD).length,
      hardCorrect: tr.filter((r) => r.difficulty >= HARD && r.correct).length,
    };
  });
}
