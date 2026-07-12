"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getOrCreateSessionId, nowMs } from "@/lib/session-client";
import { TRACKS, TRACK_IDS, topicOf, type TrackId, type Track } from "@/lib/train-tracks";

// The client experience for one Training Room track (10x). A three-phase
// machine: dashboard → run → recap. The run serves three interaction kinds —
// an MCQ, an Estimate-with-a-band, and a Design Duel — and every call carries a
// CONVICTION (50–99%). Conviction feeds the calibration track (are you as right
// as you feel?), the room's headline 10x metric. Separate world from the study.

const RUN_LENGTH = 8;

// ---- DTOs -------------------------------------------------------------------
type ServedChoice = { i: number; text: string };
type DuelDesign = { name: string; sketch: string; bullets: string[] };
type ItemDto = {
  id: string;
  track: string;
  topic: string;
  kind: "mcq" | "estimate" | "duel";
  difficulty: number;
  scenario: string;
  prompt: string;
  choices?: ServedChoice[];
  estimate?: { unit: string; min: number; max: number };
  duel?: { constraint: string; designA: DuelDesign; designB: DuelDesign };
};
type LevelDto = { n: number; roman: string; title: string; floor: number | null; gate: string };
type CalBinDto = { lo: number; hi: number; meanConf: number; accuracy: number; count: number };
type CalibrationDto = {
  n: number;
  brier: number;
  ece: number;
  accuracy: number;
  meanConf: number;
  tendency: "overconfident" | "underconfident" | "sharp" | "unrated";
  score: number | null;
  gap: number;
  bins: CalBinDto[];
};
type StandingDto = {
  liveRating: number;
  count: number;
  level: {
    level: LevelDto;
    earnedAt: string | null;
    nextGate: { level: LevelDto; gate: string } | null;
    toNext: { rating: number; floor: number | null; calls: number; minCalls: number; topics: number; minTopics: number; hard: number; minHard: number } | null;
  };
  badges: { code: string; name: string; tier: "competence" | "exploration" | "calibration"; criterion: string; earnedAt: string | null }[];
  topics: { id: string; faced: number; correct: number; hardFaced: number; hardCorrect: number }[];
  calibration: CalibrationDto;
};
type GetDto = { item: ItemDto | null; remaining: number; liveRating: number; count: number; standing: StandingDto | null };
type RevealChoice = { i: number; text: string; correct: boolean; rationale: string };
type PostDto = {
  correct: boolean;
  kind: "mcq" | "estimate" | "duel";
  topic: string;
  confidence: number | null;
  // mcq
  choices?: RevealChoice[];
  correctIndex?: number;
  pickedIndex?: number;
  explanation?: string;
  // estimate
  truth?: number;
  good?: { lo: number; hi: number };
  unit?: string;
  captured?: boolean;
  notLazy?: boolean;
  your?: { point: number; lo: number; hi: number };
  // duel
  better?: "A" | "B";
  deskRationale?: string;
  failureMode?: string;
  room?: { a: number; b: number; total: number };
  liveRating: number;
  ratingDelta: number;
  count: number;
};

type Phase = "dashboard" | "run" | "recap";
const TIER_LABEL = (d: number) => (d >= 3 ? "SUBTLE" : d === 2 ? "MID" : "FOUNDATION");

// conviction word for a slider value
function convictionWord(c: number): string {
  if (c >= 93) return "Locked in";
  if (c >= 80) return "Confident";
  if (c >= 65) return "Leaning";
  return "A hunch";
}

export function TrackRoom({ trackId }: { trackId: TrackId }) {
  const track: Track = TRACKS[trackId];
  const other = TRACK_IDS.find((t) => t !== trackId)!;

  const [phase, setPhase] = useState<Phase>("dashboard");
  const [standing, setStanding] = useState<StandingDto | null>(null);
  const [rating, setRating] = useState<number>(1200);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [item, setItem] = useState<ItemDto | null>(null);
  const [reveal, setReveal] = useState<PostDto | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [topicFilter, setTopicFilter] = useState<string | undefined>(undefined);
  const servedAt = useRef<number>(0);

  const [runIndex, setRunIndex] = useState(0);
  const [runCorrect, setRunCorrect] = useState(0);
  const [runStart, setRunStart] = useState<{ rating: number; levelN: number; badges: Set<string>; calScore: number | null }>({
    rating: 1200,
    levelN: 1,
    badges: new Set<string>(),
    calScore: null,
  });
  const [poolDry, setPoolDry] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const sid = getOrCreateSessionId();
        await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sid, segment: "other" }),
        });
        const res = await fetch(`/api/train?sessionId=${encodeURIComponent(sid)}&track=${trackId}`);
        if (!res.ok) throw new Error(`load failed (${res.status})`);
        const data: GetDto = await res.json();
        setStanding(data.standing);
        setRating(data.standing?.liveRating ?? data.liveRating);
      } catch {
        setError("Couldn't load the room. Try again.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchItem = useCallback(
    async (topic?: string): Promise<ItemDto | null> => {
      const sid = getOrCreateSessionId();
      const q = new URLSearchParams({ sessionId: sid, track: trackId });
      if (topic) q.set("topic", topic);
      const res = await fetch(`/api/train?${q.toString()}`);
      if (!res.ok) throw new Error(`item failed (${res.status})`);
      const data: GetDto = await res.json();
      if (data.standing) {
        setStanding(data.standing);
        setRating(data.standing.liveRating);
      }
      return data.item;
    },
    [trackId]
  );

  const refresh = useCallback(async () => {
    const sid = getOrCreateSessionId();
    const res = await fetch(`/api/train?sessionId=${encodeURIComponent(sid)}&track=${trackId}`);
    if (res.ok) {
      const data: GetDto = await res.json();
      if (data.standing) {
        setStanding(data.standing);
        setRating(data.standing.liveRating);
      }
    }
  }, [trackId]);

  const startRun = useCallback(
    async (topic?: string) => {
      setError(null);
      try {
        const next = await fetchItem(topic);
        if (!next) {
          setError(topic ? "You've cleared every call in that topic." : "You've cleared every call in this room — check back after the next edition.");
          return;
        }
        setRunStart({
          rating: standing?.liveRating ?? rating,
          levelN: standing?.level.level.n ?? 1,
          badges: new Set((standing?.badges ?? []).filter((b) => b.earnedAt).map((b) => b.code)),
          calScore: standing?.calibration.score ?? null,
        });
        setTopicFilter(topic);
        setRunIndex(0);
        setRunCorrect(0);
        setPoolDry(false);
        setReveal(null);
        setItem(next);
        servedAt.current = nowMs();
        setPhase("run");
      } catch {
        setError("Couldn't start a run. Try again.");
      }
    },
    [fetchItem, standing, rating]
  );

  const submit = useCallback(
    async (answer: { pickedIndex?: number; point?: number; lo?: number; hi?: number }, confidence: number | null) => {
      if (!item || submitting || reveal) return;
      setSubmitting(true);
      try {
        const sid = getOrCreateSessionId();
        const res = await fetch("/api/train", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sid,
            track: trackId,
            quizId: item.id,
            confidence,
            ...answer,
            latencyMs: Math.round(nowMs() - servedAt.current),
          }),
        });
        if (!res.ok) throw new Error(`grade failed (${res.status})`);
        const data: PostDto = await res.json();
        setReveal(data);
        setRating(data.liveRating);
        if (data.correct) setRunCorrect((c) => c + 1);
      } catch {
        setError("Couldn't record that call. Try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [item, submitting, reveal, trackId]
  );

  const next = useCallback(async () => {
    const answered = runIndex + 1;
    setRunIndex(answered);
    if (answered >= RUN_LENGTH) {
      await refresh();
      setPhase("recap");
      return;
    }
    try {
      const nx = await fetchItem(topicFilter);
      if (!nx) {
        setPoolDry(true);
        await refresh();
        setPhase("recap");
        return;
      }
      setReveal(null);
      setItem(nx);
      servedAt.current = nowMs();
    } catch {
      setError("Couldn't load the next call. Try again.");
    }
  }, [runIndex, fetchItem, topicFilter, refresh]);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-5 py-10">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-rule-strong/40" aria-hidden />
        <p className="masthead text-ink-strong">{track.room}</p>
        <span className="h-px flex-1 bg-rule-strong/40" aria-hidden />
      </div>
      <div className="double-rule mt-3" aria-hidden />

      {error && (
        <p className="mt-6 rounded-md border border-danger/40 bg-danger/5 px-4 py-3 text-center text-sm text-danger">{error}</p>
      )}

      {loading && !standing ? (
        <p className="mt-16 text-center font-mono text-sm text-muted">Opening the room…</p>
      ) : phase === "dashboard" && standing ? (
        <Dashboard track={track} standing={standing} rating={rating} otherId={other} onStart={startRun} />
      ) : phase === "run" && item ? (
        <Run
          track={track}
          item={item}
          reveal={reveal}
          submitting={submitting}
          rating={rating}
          position={runIndex + 1}
          total={RUN_LENGTH}
          levelRoman={standing?.level.level.roman ?? "I"}
          onSubmit={submit}
          onNext={next}
        />
      ) : phase === "recap" && standing ? (
        <Recap
          track={track}
          standing={standing}
          runCorrect={runCorrect}
          runAnswered={poolDry ? runIndex : Math.min(runIndex + 1, RUN_LENGTH)}
          ratingDelta={standing.liveRating - runStart.rating}
          leveledUp={standing.level.level.n > runStart.levelN ? standing.level.level : null}
          newBadges={standing.badges.filter((b) => b.earnedAt && !runStart.badges.has(b.code))}
          poolDry={poolDry}
          onAgain={() => startRun(topicFilter)}
          onHome={() => setPhase("dashboard")}
        />
      ) : null}

      <div className="mt-14 text-center">
        <Link href="/drill" className="font-mono text-xs text-muted underline-offset-4 hover:text-foreground hover:underline">
          ← back to the Training Rooms
        </Link>
      </div>
    </main>
  );
}

// ============================================================ Level meter
function LevelMeter({ track, standing, rating }: { track: Track; standing: StandingDto; rating: number }) {
  const cur = standing.level.level;
  const toNext = standing.level.toNext;
  const nextLevel = standing.level.nextGate?.level ?? null;
  const fromFloor = cur.floor ?? 1200;
  const toFloor = nextLevel?.floor ?? fromFloor + 120;
  const pct = Math.max(0, Math.min(1, (rating - fromFloor) / Math.max(1, toFloor - fromFloor)));
  return (
    <div className="text-center">
      <p className="kicker text-muted">{track.tagline}</p>
      <div className="mt-3">
        <span className="block font-mono text-[clamp(2.25rem,7vw,3.25rem)] font-semibold leading-none text-accent tabular-nums">{rating}</span>
        <p className="mt-2 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ink-strong">
          Level {cur.roman} · {cur.title}
          <span className="ml-2 font-normal normal-case tracking-normal text-muted">· {standing.count} calls logged</span>
        </p>
      </div>
      {nextLevel && toNext ? (
        <div className="mx-auto mt-4 max-w-sm">
          <div className="h-1 w-full overflow-hidden rounded-full bg-card-border">
            <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${Math.round(pct * 100)}%` }} />
          </div>
          <p className="mt-2 font-mono text-[0.7rem] text-muted">Level {nextLevel.roman} · {nextLevel.title} — {nextLevel.gate}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 font-mono text-[0.65rem] text-muted/70">
            <GateChip label="reading" have={toNext.rating} need={toNext.floor ?? 0} />
            <GateChip label="calls" have={toNext.calls} need={toNext.minCalls} />
            <GateChip label="topics" have={toNext.topics} need={toNext.minTopics} />
            {toNext.minHard > 0 && <GateChip label="subtle" have={toNext.hard} need={toNext.minHard} />}
          </div>
        </div>
      ) : (
        <p className="mt-3 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-accent">Top of the ladder — the room is yours.</p>
      )}
    </div>
  );
}
function GateChip({ label, have, need }: { label: string; have: number; need: number }) {
  const met = have >= need;
  return <span className={met ? "text-accent" : "text-muted/70"}>{label} {Math.min(have, need)}/{need}{met ? " ✓" : ""}</span>;
}

// ============================================================ Calibration
// A reliability diagram: your stated confidence (x) vs. how often you were right
// (y). The diagonal is perfect calibration; dots below it are overconfidence.
function CalibrationCard({ cal }: { cal: CalibrationDto }) {
  const W = 240, H = 160, pad = 26;
  const x = (conf: number) => pad + (conf - 0.5) * ((W - 2 * pad) / 0.5); // 0.5..1.0 → pad..W-pad
  const y = (acc: number) => H - pad - acc * (H - 2 * pad); // 0..1 → bottom..top
  const active = cal.bins.filter((b) => b.count > 0);
  const tendencyCopy =
    cal.tendency === "overconfident"
      ? "You lean overconfident — your sureness runs ahead of your accuracy."
      : cal.tendency === "underconfident"
        ? "You lean underconfident — you're right more often than you claim."
        : cal.tendency === "sharp"
          ? "Sharp — your confidence tracks your accuracy."
          : "Stake conviction on a few more calls to read your calibration.";
  return (
    <div className="rounded-lg border border-card-border bg-card px-4 py-4">
      <div className="flex items-baseline justify-between">
        <p className="kicker text-muted">Calibration</p>
        {cal.score != null && (
          <span className="font-mono text-xs tabular-nums text-accent">
            {cal.score}<span className="text-muted">/100</span>
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[260px]" role="img" aria-label="Calibration reliability diagram">
          {/* frame */}
          <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} className="stroke-card-border" strokeWidth={1} />
          <line x1={pad} y1={pad} x2={pad} y2={H - pad} className="stroke-card-border" strokeWidth={1} />
          {/* perfect-calibration diagonal */}
          <line x1={x(0.5)} y1={y(0.5)} x2={x(1)} y2={y(1)} className="stroke-rule-strong" strokeDasharray="3 3" strokeWidth={1} />
          {/* connecting path of your bins */}
          {active.length > 1 && (
            <polyline
              points={active.map((b) => `${x(b.meanConf)},${y(b.accuracy)}`).join(" ")}
              className="fill-none stroke-accent"
              strokeWidth={1.5}
            />
          )}
          {/* dots, sized by count */}
          {active.map((b, i) => (
            <circle key={i} cx={x(b.meanConf)} cy={y(b.accuracy)} r={Math.min(7, 3 + b.count)} className="fill-accent" />
          ))}
          <text x={pad} y={H - 8} className="fill-muted" style={{ fontSize: 8, fontFamily: "var(--font-mono)" }}>50%</text>
          <text x={W - pad - 14} y={H - 8} className="fill-muted" style={{ fontSize: 8, fontFamily: "var(--font-mono)" }}>99%</text>
          <text x={4} y={pad + 4} className="fill-muted" style={{ fontSize: 8, fontFamily: "var(--font-mono)" }}>100%</text>
        </svg>
        <div className="text-left">
          <p className="text-sm leading-relaxed text-foreground">{tendencyCopy}</p>
          {cal.n > 0 && (
            <p className="mt-2 font-mono text-[0.65rem] text-muted">
              {cal.n} staked · accuracy {Math.round(cal.accuracy * 100)}% · avg conviction {Math.round(cal.meanConf * 100)}%
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================ Dashboard
function Dashboard({ track, standing, rating, otherId, onStart }: {
  track: Track; standing: StandingDto; rating: number; otherId: TrackId; onStart: (topic?: string) => void;
}) {
  const progressFor = (id: string) => standing.topics.find((t) => t.id === id);
  const otherTrack = TRACKS[otherId];
  return (
    <div className="rise mt-6">
      <LevelMeter track={track} standing={standing} rating={rating} />
      <p className="mx-auto mt-6 max-w-md text-center text-sm leading-relaxed text-muted">{track.blurb}</p>

      <button onClick={() => onStart()} className="mt-6 w-full rounded-lg bg-accent px-5 py-4 text-center font-mono text-sm font-semibold uppercase tracking-[0.14em] text-background transition-transform hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        Start a run — {RUN_LENGTH} calls →
      </button>
      <p className="mt-2 text-center font-mono text-[0.7rem] text-muted/70">Every call, stake a conviction. Calibration tracks whether your sureness matches your accuracy.</p>

      {/* calibration */}
      <div className="mt-8">
        <CalibrationCard cal={standing.calibration} />
      </div>

      {/* topic map */}
      <div className="mt-8">
        <div className="flex items-center gap-3">
          <p className="kicker text-muted">The curriculum</p>
          <span className="h-px flex-1 bg-rule-strong/25" aria-hidden />
        </div>
        <p className="mt-2 font-mono text-[0.7rem] text-muted/70">Tap a topic to drill it on its own.</p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {track.topics.map((topic) => {
            const p = progressFor(topic.id);
            const faced = p?.faced ?? 0;
            const correct = p?.correct ?? 0;
            return (
              <button key={topic.id} onClick={() => onStart(topic.id)} className="group rounded-lg border border-card-border bg-card px-4 py-3 text-left transition-colors hover:border-rule-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-ink-strong">{topic.name}</span>
                  <span className="shrink-0 font-mono text-[0.65rem] text-muted tabular-nums">{faced === 0 ? "not yet faced" : `${correct}/${faced}`}</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted">{topic.concept}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* The Record */}
      <div className="mt-8">
        <div className="flex items-center gap-3">
          <p className="kicker text-muted">The Record</p>
          <span className="h-px flex-1 bg-rule-strong/25" aria-hidden />
        </div>
        <p className="mt-2 font-mono text-[0.7rem] text-muted/70">Every badge is recomputed from your calls — nothing is granted, only recorded.</p>
        <BadgeLedger badges={standing.badges} />
      </div>

      {/* other rooms */}
      <div className="mt-8 rounded-lg border border-card-border bg-card px-4 py-4">
        <p className="kicker text-muted">Other rooms</p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Link href={`/train/${otherId}`} className="rounded-md border border-card-border px-3 py-2 text-sm text-ink-strong transition-colors hover:border-rule-strong">
            <span className="font-semibold">{otherTrack.name}</span>
            <span className="mt-0.5 block font-mono text-[0.65rem] text-muted">{otherTrack.tagline}</span>
          </Link>
          <Link href="/drill" className="rounded-md border border-card-border px-3 py-2 text-sm text-ink-strong transition-colors hover:border-rule-strong">
            <span className="font-semibold">Spot the overreach</span>
            <span className="mt-0.5 block font-mono text-[0.65rem] text-muted">The original room — catch a telling that outruns its data</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function BadgeGroup({ label, items }: { label: string; items: StandingDto["badges"] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted/70">{label}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((b) => {
          const earned = !!b.earnedAt;
          return (
            <li key={b.code} className={`flex items-start justify-between gap-3 rounded-md border px-3 py-2 ${earned ? "border-accent/40 bg-accent/5" : "border-card-border bg-card"}`}>
              <span>
                <span className={`font-mono text-xs font-semibold uppercase tracking-[0.1em] ${earned ? "text-accent" : "text-muted"}`}>{b.name}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted">{b.criterion}</span>
              </span>
              <span className={`shrink-0 font-mono text-[0.6rem] uppercase tracking-[0.14em] ${earned ? "text-accent" : "text-muted/70"}`}>{earned ? "held" : "open"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
function BadgeLedger({ badges }: { badges: StandingDto["badges"] }) {
  return (
    <>
      <BadgeGroup label="Calibration — do you know how sure to be?" items={badges.filter((b) => b.tier === "calibration")} />
      <BadgeGroup label="Competence" items={badges.filter((b) => b.tier === "competence")} />
      <BadgeGroup label="Exploration — coverage, not skill" items={badges.filter((b) => b.tier === "exploration")} />
    </>
  );
}

// ============================================================ Run
function Run({ track, item, reveal, submitting, rating, position, total, levelRoman, onSubmit, onNext }: {
  track: Track; item: ItemDto; reveal: PostDto | null; submitting: boolean; rating: number;
  position: number; total: number; levelRoman: string;
  onSubmit: (answer: { pickedIndex?: number; point?: number; lo?: number; hi?: number }, confidence: number | null) => void;
  onNext: () => void;
}) {
  const topic = topicOf(track, item.topic);
  const kindLabel = item.kind === "estimate" ? "ESTIMATE" : item.kind === "duel" ? "DUEL" : "CALL";
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted">
        <span>{topic.short} · <span className="text-muted/70">{kindLabel} · {TIER_LABEL(item.difficulty)}</span></span>
        <span className="tabular-nums">Lv {levelRoman} · {rating} · {Math.min(position, total)}/{total}</span>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-card-border" aria-hidden>
        <div className="h-full rounded-full bg-rule-strong transition-[width] duration-300" style={{ width: `${(Math.min(position, total) / total) * 100}%` }} />
      </div>

      {item.kind === "mcq" && <McqCall key={item.id} item={item} reveal={reveal} submitting={submitting} onSubmit={onSubmit} onNext={onNext} last={position >= total} />}
      {item.kind === "estimate" && <EstimateCall key={item.id} item={item} reveal={reveal} submitting={submitting} onSubmit={onSubmit} onNext={onNext} last={position >= total} />}
      {item.kind === "duel" && <DuelCall key={item.id} item={item} reveal={reveal} submitting={submitting} onSubmit={onSubmit} onNext={onNext} last={position >= total} />}
    </div>
  );
}

// ---- conviction bar (mcq + duel) -------------------------------------------
function ConvictionBar({ conviction, setConviction, onCommit, submitting }: {
  conviction: number; setConviction: (n: number) => void; onCommit: () => void; submitting: boolean;
}) {
  return (
    <div className="mt-5 rounded-lg border border-accent/30 bg-accent/5 px-4 py-4">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted">How sure are you?</p>
        <span className="font-mono text-sm tabular-nums text-accent">{conviction}% · {convictionWord(conviction)}</span>
      </div>
      <input type="range" min={50} max={99} value={conviction} onChange={(e) => setConviction(Number(e.target.value))} aria-label="Conviction" className="mt-3 w-full accent-[var(--accent)]" />
      <p className="mt-1 font-mono text-[0.6rem] text-muted/70">A confident miss stings your calibration more than a hedged one. Report what you actually believe.</p>
      <button onClick={onCommit} disabled={submitting} className="mt-3 w-full rounded-md bg-foreground px-4 py-3 text-center font-mono text-xs font-semibold uppercase tracking-[0.14em] text-background transition-transform hover:-translate-y-px disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        Lock it in →
      </button>
    </div>
  );
}

// ---- reveal footer ----------------------------------------------------------
function RevealHeader({ correct, delta, rating }: { correct: boolean; delta: number; rating: number }) {
  return (
    <div className="flex items-center justify-between">
      <p className={`font-mono text-sm font-semibold uppercase tracking-[0.12em] ${correct ? "text-accent" : "text-danger"}`}>{correct ? "Landed it" : "Not this time"}</p>
      <span className={`font-mono text-xs tabular-nums ${delta >= 0 ? "text-accent" : "text-danger"}`}>{delta >= 0 ? "+" : ""}{delta} → {rating}</span>
    </div>
  );
}
function NextButton({ last, onNext }: { last: boolean; onNext: () => void }) {
  return (
    <button onClick={onNext} className="mt-4 w-full rounded-md bg-foreground px-4 py-3 text-center font-mono text-xs font-semibold uppercase tracking-[0.14em] text-background transition-transform hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
      {last ? "See the recap →" : "Next call →"}
    </button>
  );
}

// ---- MCQ --------------------------------------------------------------------
function McqCall({ item, reveal, submitting, onSubmit, onNext, last }: {
  item: ItemDto; reveal: PostDto | null; submitting: boolean;
  onSubmit: (a: { pickedIndex: number }, c: number | null) => void; onNext: () => void; last: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [conviction, setConviction] = useState(75);
  return (
    <>
      <div className="pair-in mt-5 rounded-lg border border-card-border bg-card px-4 py-4">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted">The scenario</p>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-foreground">{item.scenario}</p>
      </div>
      <p className="mt-5 text-center text-base font-semibold text-ink-strong">{item.prompt}</p>
      <ul className="mt-4 space-y-2.5">
        {(item.choices ?? []).map((c, idx) => {
          const rc = reveal?.choices?.find((x) => x.i === c.i);
          const isSel = selected === c.i;
          let cls = "border-card-border bg-card hover:border-rule-strong";
          if (reveal) {
            if (rc?.correct) cls = "border-accent bg-accent/10";
            else if (reveal.pickedIndex === c.i) cls = "border-danger bg-danger/10";
            else cls = "border-card-border bg-card opacity-70";
          } else if (isSel) cls = "border-accent bg-accent/10";
          return (
            <li key={c.i}>
              <button disabled={!!reveal || submitting} onClick={() => setSelected(c.i)} aria-pressed={isSel}
                className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default ${cls}`}>
                <span className="mt-px shrink-0 font-mono text-xs text-muted tabular-nums">{idx + 1}</span>
                <span className="text-sm leading-relaxed text-foreground">{c.text}</span>
                {reveal && rc?.correct && <span className="ml-auto shrink-0 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-accent">correct</span>}
                {reveal && reveal.pickedIndex === c.i && !rc?.correct && <span className="ml-auto shrink-0 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-danger">your call</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {!reveal && selected != null && (
        <ConvictionBar conviction={conviction} setConviction={setConviction} submitting={submitting} onCommit={() => onSubmit({ pickedIndex: selected }, conviction)} />
      )}
      {reveal && (
        <div className="verdict-card-in mt-5 rounded-lg border border-card-border bg-card px-4 py-4">
          <RevealHeader correct={reveal.correct} delta={reveal.ratingDelta} rating={reveal.liveRating} />
          {reveal.confidence != null && <ConvictionEcho confidence={reveal.confidence} correct={reveal.correct} />}
          <p className="mt-2 text-sm leading-relaxed text-foreground">{reveal.explanation}</p>
          <NextButton last={last} onNext={onNext} />
        </div>
      )}
    </>
  );
}
function ConvictionEcho({ confidence, correct }: { confidence: number; correct: boolean }) {
  const msg = correct
    ? confidence >= 90 ? "You were sure — and right. That's what conviction is for." : "Landed it while hedging — a little more conviction next time."
    : confidence >= 90 ? "You were sure — and wrong. That's the expensive kind of miss." : "A hedged miss — your uncertainty was honest.";
  return <p className="mt-1 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-muted">Staked {confidence}% · {msg}</p>;
}

// ---- ESTIMATE (drag a point + a 90% band on a number line) ------------------
function EstimateCall({ item, reveal, submitting, onSubmit, onNext, last }: {
  item: ItemDto; reveal: PostDto | null; submitting: boolean;
  onSubmit: (a: { point: number; lo: number; hi: number }, c: number | null) => void; onNext: () => void; last: boolean;
}) {
  const est = item.estimate!;
  const span = est.max - est.min;
  const mid = est.min + span / 2;
  const [point, setPoint] = useState(mid);
  const [lo, setLo] = useState(est.min + span * 0.35);
  const [hi, setHi] = useState(est.min + span * 0.65);
  const [drag, setDrag] = useState<null | "point" | "lo" | "hi">(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const W = 320, H = 70, pad = 16;
  const toX = (v: number) => pad + ((v - est.min) / span) * (W - 2 * pad);
  const toV = (clientX: number) => {
    const svg = svgRef.current; if (!svg) return point;
    const r = svg.getBoundingClientRect();
    const px = ((clientX - r.left) / r.width) * W;
    const v = est.min + ((px - pad) / (W - 2 * pad)) * span;
    return Math.max(est.min, Math.min(est.max, v));
  };
  const fmt = (v: number) => `${Math.round(v * 10) / 10}${est.unit}`;
  const onMove = (clientX: number) => {
    if (!drag || reveal) return;
    const v = toV(clientX);
    if (drag === "point") setPoint(v);
    else if (drag === "lo") setLo(Math.min(v, hi - span * 0.01));
    else setHi(Math.max(v, lo + span * 0.01));
  };
  return (
    <>
      <div className="pair-in mt-5 rounded-lg border border-card-border bg-card px-4 py-4">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted">The scenario</p>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-foreground">{item.scenario}</p>
      </div>
      <p className="mt-5 text-center text-base font-semibold text-ink-strong">{item.prompt}</p>
      <p className="mt-1 text-center font-mono text-[0.65rem] text-muted/70">Drag your best estimate ◆ and a 90% interval [ ]. Honest width beats a lucky guess.</p>

      <div className="mt-4 rounded-lg border border-card-border bg-card px-3 py-4"
        onPointerMove={(e) => onMove(e.clientX)} onPointerUp={() => setDrag(null)} onPointerLeave={() => setDrag(null)}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full touch-none select-none" role="group" aria-label="Number line estimate">
          {/* axis */}
          <line x1={pad} y1={44} x2={W - pad} y2={44} className="stroke-card-border" strokeWidth={2} />
          {/* your band */}
          {!reveal && <rect x={toX(lo)} y={38} width={Math.max(1, toX(hi) - toX(lo))} height={12} className="fill-accent/20 stroke-accent" strokeWidth={1} rx={2} />}
          {/* reveal: your band + truth + good band */}
          {reveal && reveal.your && (
            <>
              <rect x={toX(reveal.your.lo)} y={38} width={Math.max(1, toX(reveal.your.hi) - toX(reveal.your.lo))} height={12} className={`${reveal.captured ? "fill-accent/20 stroke-accent" : "fill-danger/20 stroke-danger"}`} strokeWidth={1} rx={2} />
              {reveal.good && <rect x={toX(reveal.good.lo)} y={24} width={Math.max(1, toX(reveal.good.hi) - toX(reveal.good.lo))} height={6} className="fill-rule-strong/30 stroke-rule-strong" strokeWidth={0.75} rx={2} />}
              {reveal.truth != null && <line x1={toX(reveal.truth)} y1={18} x2={toX(reveal.truth)} y2={56} className="stroke-ink-strong" strokeWidth={2} />}
              {reveal.truth != null && <text x={toX(reveal.truth)} y={14} textAnchor="middle" className="fill-ink-strong" style={{ fontSize: 9, fontFamily: "var(--font-mono)" }}>{fmt(reveal.truth)}</text>}
            </>
          )}
          {/* handles */}
          {!reveal && (
            <>
              <g onPointerDown={() => setDrag("lo")} className="cursor-ew-resize"><rect x={toX(lo) - 4} y={34} width={8} height={20} className="fill-accent" rx={1} /></g>
              <g onPointerDown={() => setDrag("hi")} className="cursor-ew-resize"><rect x={toX(hi) - 4} y={34} width={8} height={20} className="fill-accent" rx={1} /></g>
              <g onPointerDown={() => setDrag("point")} className="cursor-grab"><path d={`M ${toX(point)} 40 l 6 6 l -6 6 l -6 -6 z`} className="fill-ink-strong" /></g>
            </>
          )}
          <text x={pad} y={66} className="fill-muted" style={{ fontSize: 8, fontFamily: "var(--font-mono)" }}>{fmt(est.min)}</text>
          <text x={W - pad} y={66} textAnchor="end" className="fill-muted" style={{ fontSize: 8, fontFamily: "var(--font-mono)" }}>{fmt(est.max)}</text>
        </svg>
        {!reveal && (
          <p className="mt-1 text-center font-mono text-[0.7rem] tabular-nums text-muted">estimate {fmt(point)} · 90% band [{fmt(lo)} – {fmt(hi)}]</p>
        )}
      </div>

      {/* number nudges for accessibility / precision */}
      {!reveal && (
        <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[0.65rem]">
          <NumNudge label="estimate" v={point} set={setPoint} min={est.min} max={est.max} unit={est.unit} />
          <NumNudge label="low" v={lo} set={(x) => setLo(Math.min(x, hi - span * 0.01))} min={est.min} max={est.max} unit={est.unit} />
          <NumNudge label="high" v={hi} set={(x) => setHi(Math.max(x, lo + span * 0.01))} min={est.min} max={est.max} unit={est.unit} />
        </div>
      )}

      {!reveal && (
        <button disabled={submitting} onClick={() => onSubmit({ point, lo, hi }, null)}
          className="mt-4 w-full rounded-lg bg-accent px-5 py-3 text-center font-mono text-sm font-semibold uppercase tracking-[0.14em] text-background transition-transform hover:-translate-y-px disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          Lock in the estimate →
        </button>
      )}
      {reveal && (
        <div className="verdict-card-in mt-5 rounded-lg border border-card-border bg-card px-4 py-4">
          <RevealHeader correct={reveal.correct} delta={reveal.ratingDelta} rating={reveal.liveRating} />
          <p className="mt-2 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-muted">
            {reveal.captured ? (reveal.notLazy ? "Captured the truth with a sharp band" : "Captured — but your band was lazily wide") : "The truth fell outside your interval"}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-foreground">{reveal.explanation}</p>
          <NextButton last={last} onNext={onNext} />
        </div>
      )}
    </>
  );
}
function NumNudge({ label, v, set, min, max, unit }: { label: string; v: number; set: (n: number) => void; min: number; max: number; unit: string }) {
  const step = Math.max(0.1, Math.round((max - min) / 100));
  return (
    <div className="rounded-md border border-card-border bg-card px-2 py-1.5 text-center">
      <span className="block text-muted/70 uppercase tracking-[0.1em]">{label}</span>
      <div className="mt-1 flex items-center justify-center gap-1.5">
        <button onClick={() => set(Math.max(min, v - step))} className="text-accent" aria-label={`decrease ${label}`}>−</button>
        <span className="tabular-nums text-foreground">{Math.round(v * 10) / 10}{unit}</span>
        <button onClick={() => set(Math.min(max, v + step))} className="text-accent" aria-label={`increase ${label}`}>+</button>
      </div>
    </div>
  );
}

// ---- DUEL (two designs, one constraint, You / Room / Desk) -------------------
function DuelDesignCard({ side, design, selected, reveal, submitting, onPick }: {
  side: 0 | 1; design: DuelDesign; selected: number | null; reveal: PostDto | null; submitting: boolean; onPick: (s: number) => void;
}) {
  const isSel = selected === side;
  const isBetter = reveal?.better === (side === 0 ? "A" : "B");
  let cls = "border-card-border bg-card hover:border-rule-strong";
  if (reveal) cls = isBetter ? "border-accent bg-accent/10" : reveal.pickedIndex === side ? "border-danger bg-danger/10" : "border-card-border bg-card opacity-70";
  else if (isSel) cls = "border-accent bg-accent/10";
  return (
    <button disabled={!!reveal || submitting} onClick={() => onPick(side)} aria-pressed={isSel}
      className={`flex flex-col rounded-lg border px-4 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default ${cls}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">Design {side === 0 ? "A" : "B"}</span>
        {reveal && isBetter && <span className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-accent">the fit</span>}
        {reveal && reveal.pickedIndex === side && !isBetter && <span className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-danger">your call</span>}
      </div>
      <span className="mt-1 text-sm font-semibold text-ink-strong">{design.name}</span>
      <code className="mt-1.5 block overflow-x-auto whitespace-pre rounded bg-background/60 px-2 py-1 font-mono text-[0.6rem] text-muted">{design.sketch}</code>
      <ul className="mt-2 space-y-0.5">
        {design.bullets.map((b, i) => <li key={i} className="text-xs leading-relaxed text-muted">· {b}</li>)}
      </ul>
    </button>
  );
}
function DuelCall({ item, reveal, submitting, onSubmit, onNext, last }: {
  item: ItemDto; reveal: PostDto | null; submitting: boolean;
  onSubmit: (a: { pickedIndex: number }, c: number | null) => void; onNext: () => void; last: boolean;
}) {
  const d = item.duel!;
  const [selected, setSelected] = useState<number | null>(null);
  const [conviction, setConviction] = useState(75);
  return (
    <>
      <div className="pair-in mt-5 rounded-lg border border-card-border bg-card px-4 py-3">
        <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted">The constraint</p>
        <p className="mt-1 font-mono text-[0.8rem] leading-relaxed text-accent">{d.constraint}</p>
        <p className="mt-2 text-sm leading-relaxed text-foreground">{item.scenario}</p>
      </div>
      <p className="mt-4 text-center text-base font-semibold text-ink-strong">{item.prompt}</p>
      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <DuelDesignCard side={0} design={d.designA} selected={selected} reveal={reveal} submitting={submitting} onPick={setSelected} />
        <DuelDesignCard side={1} design={d.designB} selected={selected} reveal={reveal} submitting={submitting} onPick={setSelected} />
      </div>

      {!reveal && selected != null && (
        <ConvictionBar conviction={conviction} setConviction={setConviction} submitting={submitting} onCommit={() => onSubmit({ pickedIndex: selected }, conviction)} />
      )}

      {reveal && (
        <div className="verdict-card-in mt-5 rounded-lg border border-card-border bg-card px-4 py-4">
          <RevealHeader correct={reveal.correct} delta={reveal.ratingDelta} rating={reveal.liveRating} />
          {/* three verdicts */}
          <dl className="mt-3 space-y-2">
            <VerdictRow label="You" value={`Design ${reveal.pickedIndex === 0 ? "A" : "B"}${reveal.confidence != null ? ` · ${reveal.confidence}% sure` : ""}`} tone={reveal.correct ? "accent" : "danger"} />
            {reveal.room && reveal.room.total > 0 && (
              <VerdictRow label="The Room" value={`${Math.round((reveal.room.a / reveal.room.total) * 100)}% A · ${Math.round((reveal.room.b / reveal.room.total) * 100)}% B (${reveal.room.total})`} tone="muted" />
            )}
            <VerdictRow label="The Desk" value={`Design ${reveal.better} — ${reveal.failureMode}`} tone="ink" />
          </dl>
          <p className="mt-3 border-t border-card-border pt-3 text-sm leading-relaxed text-foreground">{reveal.deskRationale}</p>
          <NextButton last={last} onNext={onNext} />
        </div>
      )}
    </>
  );
}
function VerdictRow({ label, value, tone }: { label: string; value: string; tone: "accent" | "danger" | "muted" | "ink" }) {
  const c = tone === "accent" ? "text-accent" : tone === "danger" ? "text-danger" : tone === "ink" ? "text-ink-strong" : "text-muted";
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted">{label}</dt>
      <dd className={`text-right font-mono text-xs ${c}`}>{value}</dd>
    </div>
  );
}

// ============================================================ Recap
function Recap({ track, standing, runCorrect, runAnswered, ratingDelta, leveledUp, newBadges, poolDry, onAgain, onHome }: {
  track: Track; standing: StandingDto; runCorrect: number; runAnswered: number; ratingDelta: number;
  leveledUp: LevelDto | null; newBadges: StandingDto["badges"]; poolDry: boolean; onAgain: () => void; onHome: () => void;
}) {
  return (
    <div className="rise mt-6">
      <div className="text-center">
        <p className="kicker text-muted">Run complete</p>
        <p className="mt-3 font-mono text-[clamp(1.75rem,6vw,2.5rem)] font-semibold leading-none text-ink-strong tabular-nums">{runCorrect}<span className="text-muted">/{runAnswered}</span></p>
        <p className="mt-2 font-mono text-xs uppercase tracking-[0.14em] text-muted">calls landed</p>
        <p className={`mt-3 font-mono text-sm tabular-nums ${ratingDelta >= 0 ? "text-accent" : "text-danger"}`}>{ratingDelta >= 0 ? "+" : ""}{ratingDelta} rating → {standing.liveRating} · Level {standing.level.level.roman}</p>
      </div>

      {leveledUp && (
        <div className="mt-6 rounded-lg border border-accent/50 bg-accent/10 px-4 py-4 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-accent">Level up</p>
          <p className="mt-1 text-lg font-semibold text-ink-strong">Level {leveledUp.roman} · {leveledUp.title}</p>
        </div>
      )}

      <div className="mt-6"><CalibrationCard cal={standing.calibration} /></div>

      {newBadges.length > 0 && (
        <div className="mt-6">
          <p className="kicker text-muted">Badges earned this run</p>
          <ul className="mt-3 space-y-1.5">
            {newBadges.map((b) => (
              <li key={b.code} className="rounded-md border border-accent/40 bg-accent/5 px-3 py-2">
                <span className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-accent">{b.name}</span>
                <span className="mt-0.5 block text-xs text-muted">{b.criterion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {poolDry && <p className="mt-6 text-center text-sm text-muted">You&apos;ve reached the end of the current pool for this slice — every call here is on your record.</p>}

      <div className="mt-8 space-y-2.5">
        <button onClick={onAgain} className="w-full rounded-lg bg-accent px-5 py-4 text-center font-mono text-sm font-semibold uppercase tracking-[0.14em] text-background transition-transform hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Another run →</button>
        <button onClick={onHome} className="w-full rounded-lg border border-card-border bg-card px-5 py-3 text-center font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ink-strong transition-colors hover:border-rule-strong">Back to {track.name}</button>
      </div>
    </div>
  );
}
