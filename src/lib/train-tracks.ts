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

export type TrackId = "statistics" | "architecture" | "economics" | "decision";

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

export type BadgeTier = "competence" | "exploration" | "calibration";

// Calibration badges — shared across both rooms (calibration reads the same in
// statistics and architecture). Folded over the conviction each call carried.
const CALIBRATION_BADGES: Badge[] = [
  { code: "honest_broker", name: "HONEST BROKER", tier: "calibration", criterion: "Thirty staked calls, confidence and accuracy within six points — and still holding." },
  { code: "knows_knows", name: "KNOWS WHAT THEY KNOW", tier: "calibration", criterion: "Ten locked-in calls (90%+), nine in ten landed." },
  { code: "no_bluff", name: "NO BLUFF", tier: "calibration", criterion: "No confidence tier you couldn't back up, across fifteen-plus staked calls." },
];

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
  confidence: number | null; // 25..99 conviction staked (mcq/duel); null = estimate/legacy
  captured: boolean | null; // estimate calls: truth fell in the 90% band? null otherwise
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
  ...CALIBRATION_BADGES,
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
  ...CALIBRATION_BADGES,
];

// ---------------------------------------------------------------------------
// ECONOMICS — the winner of the four-firm design competition (Misconception
// Lab's "The Lever", synthesized with Atelier Marginal's rigorous linear market
// model + iconic reveal, the naive-intuition ghost marker, and distance-graded
// feedback). The room overwrites seductive first-order fallacies by making the
// learner commit a number, stake conviction, then watch the second-order
// consequence overrun their intuition. See docs/ECON-ROOM.md.

const ECON_TOPICS: Topic[] = [
  {
    id: "opportunity_cost",
    name: "Opportunity Cost",
    short: "Opp. Cost",
    concept:
      "The true cost of any choice is the best alternative you gave up, not the cash you spent. Comparative advantage — and every real tradeoff — follows from it.",
  },
  {
    id: "sunk_cost",
    name: "Sunk Costs",
    short: "Sunk Cost",
    concept:
      "Money already spent and unrecoverable is irrelevant to the next decision. Only future costs and benefits count — 'we've come too far to quit' is the fallacy talking.",
  },
  {
    id: "nominal_vs_real",
    name: "Nominal vs Real",
    short: "Real Terms",
    concept:
      "Only inflation-adjusted (real) quantities carry welfare. A raise below inflation is a pay cut; the bigger nominal number is the money illusion at work.",
  },
  {
    id: "secondary_effects",
    name: "The Unseen",
    short: "The Unseen",
    concept:
      "Every intervention ripples past its visible first-order target. A price ceiling doesn't just lower price — it contracts supply and rations the shortage it created.",
  },
  {
    id: "tax_incidence",
    name: "Who Really Pays",
    short: "Incidence",
    concept:
      "A tax's burden splits by relative elasticity, not by who legally writes the check. The market drags the price to the split the elasticities dictate.",
  },
  {
    id: "comparative_advantage",
    name: "Gains from Trade",
    short: "Trade",
    concept:
      "Voluntary trade creates surplus; the pie isn't fixed. Advantage that matters is comparative, not absolute — a trade deficit is not a scoreboard you're losing.",
  },
];

const ECON_LEVELS: Level[] = [
  { n: 1, roman: "I", title: "Folk Economist", floor: null, minCalls: 0, minTopics: 0, minHard: 0, gate: "Walk in. Everyone holds it." },
  { n: 2, roman: "II", title: "Price-Taker", floor: 1260, minCalls: 8, minTopics: 3, minHard: 0, gate: "Reading at 1260 · 8 calls · three topics faced" },
  { n: 3, roman: "III", title: "Marginalist", floor: 1350, minCalls: 20, minTopics: 6, minHard: 3, gate: "Reading at 1350 · 20 calls · all six topics faced · 3 subtle-tier calls landed" },
  { n: 4, roman: "IV", title: "Equilibrium Thinker", floor: 1440, minCalls: 35, minTopics: 6, minHard: 6, gate: "Reading at 1440 · 35 calls · 6 subtle-tier landed · a call in every topic" },
  { n: 5, roman: "V", title: "The Invisible Hand", floor: 1520, minCalls: 50, minTopics: 6, minHard: 10, gate: "Reading at 1520 · 50 calls · subtle-tier landed across four or more topics" },
];

const ECON_BADGES: Badge[] = [
  { code: "sweep", name: "CLEAN SWEEP", tier: "competence", criterion: "Eight consecutive calls, all correct." },
  { code: "fine_print", name: "SECOND-ORDER SIGHT", tier: "competence", criterion: "Six subtle-tier calls landed, across three or more topics." },
  { code: "specialist", name: "SPECIALIST", tier: "competence", criterion: "Five correct in a single topic, at least one above the easy tier." },
  { code: "correction", name: "KILLED A DARLING", tier: "competence", criterion: "A topic that was beating you, beaten: behind in it, then three straight." },
  { code: "full_map", name: "THE FULL MAP", tier: "exploration", criterion: "Faced all six topics." },
  { code: "deep_end", name: "THE DEEP END", tier: "exploration", criterion: "Took a subtle-tier call in four or more topics — landing it not required." },
  ...CALIBRATION_BADGES,
];

// ---------------------------------------------------------------------------
// DECISION — the Solver Room: probability → price → margin → equilibrium. The
// specialist track for decision quality under uncertainty: compound the odds,
// price the bet, weigh the increment, size the stake, and hold the frequencies
// that can't be exploited. Results-oriented thinking is the enemy the whole
// room is built to overwrite. See docs/GTO-10X.md.

const DECISION_TOPICS: Topic[] = [
  {
    id: "probability",
    name: "Compound Odds",
    short: "Odds",
    concept:
      "Independent chances multiply, they don't add — and 'at least one' is the complement trick: 1 − (1−p)ⁿ. Most bad bets start with a mis-multiplied probability.",
  },
  {
    id: "expected_value",
    name: "Expected Value",
    short: "EV",
    concept:
      "A decision's worth is the probability-weighted sum of its outcomes, not its best case or its last result. The break-even probability — where EV crosses zero — is the price of the bet.",
  },
  {
    id: "marginal_ev",
    name: "The Margin",
    short: "Margin",
    concept:
      "Decisions are made at the margin: the question is never 'is this good?' but 'how much better than the next-best line?' Agonizing decisions are usually close; the costly ones are the blowouts nobody sweats.",
  },
  {
    id: "equilibrium",
    name: "Unexploitable",
    short: "GTO",
    concept:
      "At equilibrium your frequencies make the opponent's options equally worthless — bluffs priced by the pot, defenses set so aggression can't profit. GTO isn't the most profitable line; it's the one that can't be beaten.",
  },
  {
    id: "bankroll",
    name: "Sizing & Ruin",
    short: "Sizing",
    concept:
      "Knowing a bet is +EV is half the skill; how much is the other half. Over-betting a winning edge is how winners go broke — growth peaks at the Kelly fraction and turns to ruin past it.",
  },
  {
    id: "exploitation",
    name: "The Deviation",
    short: "Exploit",
    concept:
      "Against a mistaken opponent, the maximally exploitative line beats the equilibrium one — but every deviation opens a door back at you. Exploit is a bet on your read; GTO is the fallback when the read runs out.",
  },
];

const DECISION_LEVELS: Level[] = [
  { n: 1, roman: "I", title: "Results-Oriented", floor: null, minCalls: 0, minTopics: 0, minHard: 0, gate: "Walk in. Everyone holds it." },
  { n: 2, roman: "II", title: "Odds Literate", floor: 1260, minCalls: 8, minTopics: 3, minHard: 0, gate: "Reading at 1260 · 8 calls · three topics faced" },
  { n: 3, roman: "III", title: "EV Thinker", floor: 1350, minCalls: 20, minTopics: 6, minHard: 3, gate: "Reading at 1350 · 20 calls · all six topics faced · 3 subtle-tier calls landed" },
  { n: 4, roman: "IV", title: "Unexploitable", floor: 1440, minCalls: 35, minTopics: 6, minHard: 6, gate: "Reading at 1440 · 35 calls · 6 subtle-tier landed · a call in every topic" },
  { n: 5, roman: "V", title: "The Solver", floor: 1520, minCalls: 50, minTopics: 6, minHard: 10, gate: "Reading at 1520 · 50 calls · subtle-tier landed across four or more topics" },
];

const DECISION_BADGES: Badge[] = [
  { code: "sweep", name: "CLEAN SWEEP", tier: "competence", criterion: "Eight consecutive calls, all correct." },
  { code: "fine_print", name: "THIN VALUE", tier: "competence", criterion: "Six subtle-tier calls landed, across three or more topics." },
  { code: "specialist", name: "SPECIALIST", tier: "competence", criterion: "Five correct in a single topic, at least one above the easy tier." },
  { code: "correction", name: "OFF TILT", tier: "competence", criterion: "A topic that was beating you, beaten: behind in it, then three straight." },
  { code: "full_map", name: "THE FULL MAP", tier: "exploration", criterion: "Faced all six topics." },
  { code: "deep_end", name: "THE DEEP END", tier: "exploration", criterion: "Took a subtle-tier call in four or more topics — landing it not required." },
  ...CALIBRATION_BADGES,
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
  economics: {
    id: "economics",
    name: "Economics",
    room: "THE MARKET ROOM",
    tagline: "Catch the fallacy before it catches you.",
    blurb:
      "Economics is a minefield of seductive first answers — the seller pays the tax, the price cap helps everyone, a raise is a raise, sunk money must be recouped. Each call makes you commit a number and stake how sure you are; then the second-order consequence overruns your intuition, in motion, beside where you guessed.",
    accentNote: "Rating moves like a chess ladder — the harder the call, the more it swings.",
    topics: ECON_TOPICS,
    levels: ECON_LEVELS,
    badges: ECON_BADGES,
  },
  decision: {
    id: "decision",
    name: "Decision Science",
    room: "THE SOLVER ROOM",
    tagline: "Play the odds, not the outcome.",
    blurb:
      "The specialist room for decisions under uncertainty: compound the odds without averaging them, price a bet at its break-even, weigh the margin between the two best lines, size the stake so a winning edge can't ruin you, and hold the frequencies no opponent can exploit. Every call commits a number; the reveal shows the math that was waiting.",
    accentNote: "Rating moves like a chess ladder — the harder the call, the more it swings.",
    topics: DECISION_TOPICS,
    levels: DECISION_LEVELS,
    badges: DECISION_BADGES,
  },
};

export const TRACK_IDS: TrackId[] = ["statistics", "architecture", "economics", "decision"];

export function isTrackId(x: string): x is TrackId {
  return x === "statistics" || x === "architecture" || x === "economics" || x === "decision";
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

// --- calibration badges: held on the SUSTAINED ledger, not latched on the
// first lucky prefix. Each returns whether the badge holds on the full rows now;
// badgeConferrals stamps the last staked call's time while it holds (so a badge
// can be lost if calibration slips — an honest, non-inflating signal).
function honestBrokerHeld(rows: QuizRow[]): boolean {
  const c = calibration(rows);
  return c.n >= 30 && c.ece <= 0.06; // 30-call sustained window, diagnostic ECE tight
}
function knowsKnowsHeld(rows: QuizRow[]): boolean {
  // ≥10 locked-in calls (90%+), and ≥90% of them right — a calibrated 90% claim
  // should land ~90%+, so the old 85% bar certified overconfidence.
  const locked = rows.filter((r) => r.confidence != null && (r.confidence as number) >= 90);
  return locked.length >= 10 && locked.filter((r) => r.correct).length / locked.length >= 0.9;
}
function noBluffHeld(rows: QuizRow[]): boolean {
  const c = calibration(rows);
  if (c.n < 15) return false;
  return c.bins.every((b) => b.count < 4 || b.accuracy >= b.meanConf - 0.12);
}
function lastStakedTime(rows: QuizRow[]): Date | null {
  for (let i = rows.length - 1; i >= 0; i--) if (rows[i].confidence != null) return rows[i].createdAt;
  return null;
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
  // Calibration badges hold on the sustained ledger (can be lost), so they are
  // stamped from the latest staked call while they hold — not latched forever.
  const calStamp = lastStakedTime(rows);
  const calHeld: Record<string, boolean> = {
    honest_broker: honestBrokerHeld(rows),
    knows_knows: knowsKnowsHeld(rows),
    no_bluff: noBluffHeld(rows),
  };
  return track.badges.map((b) => ({
    code: b.code,
    name: b.name,
    tier: b.tier,
    criterion: b.criterion,
    earnedAt:
      b.tier === "calibration"
        ? calHeld[b.code]
          ? calStamp
          : null
        : idxFor[b.code] >= 0
          ? rows[idxFor[b.code]].createdAt
          : null,
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

// ---------------------------------------------------------------------------
// CALIBRATION — the 10x metric. Every call carries a conviction (50..99%); this
// folds the staked rows into a reliability diagram (binned confidence vs.
// accuracy), an expected-calibration-error, a Brier score, and a plain-English
// tendency. Rows without a confidence (legacy / unstaked) are ignored. Pure.

export type CalBin = {
  lo: number; // bin lower bound in percent (e.g. 50)
  hi: number; // bin upper bound in percent (e.g. 60)
  meanConf: number; // mean stated confidence in the bin, 0..1
  accuracy: number; // fraction correct in the bin, 0..1
  count: number;
};

export type Calibration = {
  n: number; // staked calls
  brier: number; // mean (p - o)^2 over staked calls, 0..1 (lower is better)
  brierRef: number; // Brier of an always-predict-base-rate forecaster (the reference)
  skill: number; // Brier skill score 1 - brier/brierRef (higher is better; can be < 0)
  ece: number; // expected calibration error — a DIAGNOSTIC only, not the grade
  reliability: number; // Murphy decomposition: Σ w_b (conf_b − acc_b)^2 (lower is better)
  resolution: number; // Murphy decomposition: Σ w_b (acc_b − acc)^2 (HIGHER is better — sharpness)
  accuracy: number; // overall accuracy over staked calls, 0..1
  meanConf: number; // overall mean confidence, 0..1
  tendency: "overconfident" | "underconfident" | "sharp" | "unrated";
  score: number | null; // 0..100 Brier-skill grade; null until SCORE_MIN_N staked calls
  gap: number; // signed meanConf - accuracy (positive = overconfident), 0..1
  bins: CalBin[]; // for the reliability diagram + No-Bluff diagnostic
};

// Interval calibration — the purest calibration signal, from Estimate-with-a-band
// calls. A well-calibrated 90% interval should capture the truth ~90% of the time.
export type IntervalCoverage = {
  n: number; // estimate calls made
  captured: number; // how many caught the truth
  rate: number; // captured / n, 0..1
  nominal: number; // the target coverage (0.90)
};

export function intervalCoverage(rows: QuizRow[]): IntervalCoverage {
  const est = rows.filter((r) => r.captured != null);
  const n = est.length;
  const captured = est.filter((r) => r.captured).length;
  return { n, captured, rate: n ? captured / n : 0, nominal: 0.9 };
}

// Bins span the FULL usable conviction range. Chance on a 4-option MCQ is 25%,
// so the reliability diagram and the No-Bluff diagnostic start at 25, not 50 —
// otherwise an honest "no idea" guess is mislabelled as overconfident.
const CAL_BINS: [number, number][] = [
  [25, 45],
  [45, 60],
  [60, 75],
  [75, 90],
  [90, 100],
];
export const CAL_AXIS_MIN = 25; // reliability-diagram x-axis floor (percent)
// The grade needs enough staked calls to be more than binned noise (a decision
// scientist's floor: 5 fixed bins are meaningless at n=5).
const SCORE_MIN_N = 30;
const RATE_MIN_N = 5; // tendency (over/under/sharp) needs only a coarse read

export function calibration(rows: QuizRow[]): Calibration {
  const staked = rows.filter((r) => r.confidence != null);
  const n = staked.length;
  const bins: CalBin[] = CAL_BINS.map(([lo, hi]) => {
    const inBin = staked.filter((r) => {
      const c = r.confidence as number;
      return c >= lo && (hi === 100 ? c <= 100 : c < hi);
    });
    const count = inBin.length;
    return {
      lo,
      hi,
      count,
      meanConf: count ? inBin.reduce((s, r) => s + (r.confidence as number), 0) / count / 100 : (lo + hi) / 200,
      accuracy: count ? inBin.filter((r) => r.correct).length / count : 0,
    };
  });
  if (n === 0) {
    return { n: 0, brier: 0, brierRef: 0, skill: 0, ece: 0, reliability: 0, resolution: 0, accuracy: 0, meanConf: 0, tendency: "unrated", score: null, gap: 0, bins };
  }
  const accuracy = staked.filter((r) => r.correct).length / n;
  const meanConf = staked.reduce((s, r) => s + (r.confidence as number), 0) / n / 100;
  const brier = staked.reduce((s, r) => {
    const p = (r.confidence as number) / 100;
    const o = r.correct ? 1 : 0;
    return s + (p - o) * (p - o);
  }, 0) / n;
  // Reference: always predict the base rate. Its Brier is accuracy*(1-accuracy).
  const brierRef = accuracy * (1 - accuracy);
  // Brier SKILL SCORE — proper: honest, sharp reporting maximises it; you cannot
  // game it by hedging toward your base rate (that only matches the reference).
  const skill = brierRef > 0 ? 1 - brier / brierRef : brier === 0 ? 1 : 0;
  const ece = bins.reduce((s, b) => s + (b.count / n) * Math.abs(b.meanConf - b.accuracy), 0);
  // Murphy decomposition (Brier = reliability − resolution + uncertainty): teaches
  // that being calibrated (reliability↓) isn't enough — you must also be sharp
  // (resolution↑, telling hard from easy) rather than staking one flat number.
  const reliability = bins.reduce((s, b) => s + (b.count / n) * (b.meanConf - b.accuracy) ** 2, 0);
  const resolution = bins.reduce((s, b) => s + (b.count / n) * (b.accuracy - accuracy) ** 2, 0);
  const gap = meanConf - accuracy;
  const tendency: Calibration["tendency"] =
    n < RATE_MIN_N ? "unrated" : gap > 0.07 ? "overconfident" : gap < -0.07 ? "underconfident" : "sharp";
  const score = n < SCORE_MIN_N ? null : Math.max(0, Math.min(100, Math.round(100 * skill)));
  return { n, brier, brierRef, skill, ece, reliability, resolution, accuracy, meanConf, tendency, score, gap, bins };
}
