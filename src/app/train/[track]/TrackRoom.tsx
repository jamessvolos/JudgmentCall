"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getOrCreateSessionId, nowMs } from "@/lib/session-client";
import {
  TRACKS,
  TRACK_IDS,
  topicOf,
  type TrackId,
  type Track,
} from "@/lib/train-tracks";

// The client experience for one Training Room track. A three-phase machine:
//   dashboard — the level meter, the topic map, and The Record (badges)
//   run       — a short sequence of multiple-choice calls with instant reveal
//   recap     — what the run moved: rating, a new level, freshly-earned badges
// The room is a separate world from the study; nothing here touches the vote.

const RUN_LENGTH = 8;

// ---- DTOs (earnedAt is a Date on the server, a string over the wire) --------
type ServedChoice = { i: number; text: string };
type ItemDto = {
  id: string;
  track: string;
  topic: string;
  difficulty: number;
  scenario: string;
  prompt: string;
  choices: ServedChoice[];
};
type LevelDto = {
  n: number;
  roman: string;
  title: string;
  floor: number | null;
  gate: string;
};
type StandingDto = {
  liveRating: number;
  count: number;
  level: {
    level: LevelDto;
    earnedAt: string | null;
    nextGate: { level: LevelDto; gate: string } | null;
    toNext: {
      rating: number;
      floor: number | null;
      calls: number;
      minCalls: number;
      topics: number;
      minTopics: number;
      hard: number;
      minHard: number;
    } | null;
  };
  badges: { code: string; name: string; tier: "competence" | "exploration"; criterion: string; earnedAt: string | null }[];
  topics: { id: string; faced: number; correct: number; hardFaced: number; hardCorrect: number }[];
};
type GetDto = {
  item: ItemDto | null;
  remaining: number;
  liveRating: number;
  count: number;
  standing: StandingDto | null;
};
type RevealChoice = { i: number; text: string; correct: boolean; rationale: string };
type PostDto = {
  correct: boolean;
  choices: RevealChoice[];
  correctIndex: number;
  pickedIndex: number;
  explanation: string;
  topic: string;
  liveRating: number;
  ratingDelta: number;
  count: number;
};

type Phase = "dashboard" | "run" | "recap";

const TIER_LABEL = (d: number) => (d >= 3 ? "SUBTLE" : d === 2 ? "MID" : "FOUNDATION");

export function TrackRoom({ trackId }: { trackId: TrackId }) {
  const track: Track = TRACKS[trackId];
  const other = TRACK_IDS.find((t) => t !== trackId)!;

  const [phase, setPhase] = useState<Phase>("dashboard");
  const [standing, setStanding] = useState<StandingDto | null>(null);
  const [rating, setRating] = useState<number>(1200);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // run state
  const [item, setItem] = useState<ItemDto | null>(null);
  const [reveal, setReveal] = useState<PostDto | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [topicFilter, setTopicFilter] = useState<string | undefined>(undefined);
  const servedAt = useRef<number>(0);

  // run bookkeeping (for the recap)
  const [runIndex, setRunIndex] = useState(0); // items answered this run
  const [runCorrect, setRunCorrect] = useState(0);
  const [runStart, setRunStart] = useState<{ rating: number; levelN: number; badges: Set<string> }>({
    rating: 1200,
    levelN: 1,
    badges: new Set<string>(),
  });
  const [poolDry, setPoolDry] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sid = getOrCreateSessionId();
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
  }, [trackId]);

  useEffect(() => {
    (async () => {
      try {
        const sid = getOrCreateSessionId();
        // Register the session (idempotent) so the API's session guard passes
        // even for a first-timer who lands straight on a room.
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

  const startRun = useCallback(
    async (topic?: string) => {
      setError(null);
      try {
        const next = await fetchItem(topic);
        if (!next) {
          // nothing left in this slice — surface it, stay on the dashboard
          setError(topic ? "You've cleared every call in that topic." : "You've cleared every call in this room — check back after the next edition.");
          return;
        }
        setRunStart({
          rating: standing?.liveRating ?? rating,
          levelN: standing?.level.level.n ?? 1,
          badges: new Set((standing?.badges ?? []).filter((b) => b.earnedAt).map((b) => b.code)),
        });
        setTopicFilter(topic);
        setRunIndex(0);
        setRunCorrect(0);
        setPoolDry(false);
        setReveal(null);
        setPicked(null);
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
    async (choiceIndex: number) => {
      if (!item || submitting || reveal) return;
      setSubmitting(true);
      setPicked(choiceIndex);
      try {
        const sid = getOrCreateSessionId();
        const res = await fetch("/api/train", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sid,
            track: trackId,
            quizId: item.id,
            pickedIndex: choiceIndex,
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
        setPicked(null);
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
      await load();
      setPhase("recap");
      return;
    }
    try {
      const nx = await fetchItem(topicFilter);
      if (!nx) {
        setPoolDry(true);
        await load();
        setPhase("recap");
        return;
      }
      setReveal(null);
      setPicked(null);
      setItem(nx);
      servedAt.current = nowMs();
    } catch {
      setError("Couldn't load the next call. Try again.");
    }
  }, [runIndex, fetchItem, topicFilter, load]);

  // keyboard: 1..4 to pick, Enter/→ to advance after a reveal
  useEffect(() => {
    if (phase !== "run") return;
    function onKey(e: KeyboardEvent) {
      if (reveal) {
        if (e.key === "Enter" || e.key === "ArrowRight") next();
        return;
      }
      if (!item || submitting) return;
      const pos = Number(e.key);
      // Map the pressed number to the choice DISPLAYED at that position, then
      // submit its ORIGINAL index (choices are shuffled per serve, so the
      // display position is not the stored index the grader checks).
      if (pos >= 1 && pos <= item.choices.length) submit(item.choices[pos - 1].i);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, reveal, item, submitting, submit, next]);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-5 py-10">
      {/* masthead */}
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-rule-strong/40" aria-hidden />
        <p className="masthead text-ink-strong">{track.room}</p>
        <span className="h-px flex-1 bg-rule-strong/40" aria-hidden />
      </div>
      <div className="double-rule mt-3" aria-hidden />

      {error && (
        <p className="mt-6 rounded-md border border-danger/40 bg-danger/5 px-4 py-3 text-center text-sm text-danger">
          {error}
        </p>
      )}

      {loading && !standing ? (
        <p className="mt-16 text-center font-mono text-sm text-muted">Opening the room…</p>
      ) : phase === "dashboard" && standing ? (
        <Dashboard
          track={track}
          standing={standing}
          rating={rating}
          otherId={other}
          onStart={startRun}
        />
      ) : phase === "run" && item ? (
        <Run
          track={track}
          item={item}
          reveal={reveal}
          picked={picked}
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

// ------------------------------------------------------------- Level meter
function LevelMeter({ track, standing, rating }: { track: Track; standing: StandingDto; rating: number }) {
  const cur = standing.level.level;
  const toNext = standing.level.toNext;
  const nextLevel = standing.level.nextGate?.level ?? null;
  // rating bar between the current floor and the next floor
  const fromFloor = cur.floor ?? 1200;
  const toFloor = nextLevel?.floor ?? fromFloor + 120;
  const pct = Math.max(0, Math.min(1, (rating - fromFloor) / Math.max(1, toFloor - fromFloor)));
  return (
    <div className="text-center">
      <p className="kicker text-muted">{track.tagline}</p>
      <div className="mt-3">
        <span className="block font-mono text-[clamp(2.25rem,7vw,3.25rem)] font-semibold leading-none text-accent tabular-nums">
          {rating}
        </span>
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
          <p className="mt-2 font-mono text-[0.7rem] text-muted">
            Level {nextLevel.roman} · {nextLevel.title} — {nextLevel.gate}
          </p>
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
  return (
    <span className={met ? "text-accent" : "text-muted/70"}>
      {label} {Math.min(have, need)}/{need}
      {met ? " ✓" : ""}
    </span>
  );
}

// ------------------------------------------------------------- Dashboard
function Dashboard({
  track,
  standing,
  rating,
  otherId,
  onStart,
}: {
  track: Track;
  standing: StandingDto;
  rating: number;
  otherId: TrackId;
  onStart: (topic?: string) => void;
}) {
  const progressFor = (id: string) => standing.topics.find((t) => t.id === id);
  const otherTrack = TRACKS[otherId];
  return (
    <div className="rise mt-6">
      <LevelMeter track={track} standing={standing} rating={rating} />

      <p className="mx-auto mt-6 max-w-md text-center text-sm leading-relaxed text-muted">{track.blurb}</p>

      <button
        onClick={() => onStart()}
        className="mt-6 w-full rounded-lg bg-accent px-5 py-4 text-center font-mono text-sm font-semibold uppercase tracking-[0.14em] text-background transition-transform hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Start a run — {RUN_LENGTH} calls →
      </button>
      <p className="mt-2 text-center font-mono text-[0.7rem] text-muted/70">{track.accentNote}</p>

      {/* topic map */}
      <div className="mt-10">
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
              <button
                key={topic.id}
                onClick={() => onStart(topic.id)}
                className="group rounded-lg border border-card-border bg-card px-4 py-3 text-left transition-colors hover:border-rule-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-ink-strong">{topic.name}</span>
                  <span className="shrink-0 font-mono text-[0.65rem] text-muted tabular-nums">
                    {faced === 0 ? "not yet faced" : `${correct}/${faced}`}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted">{topic.concept}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* The Record — badges */}
      <div className="mt-10">
        <div className="flex items-center gap-3">
          <p className="kicker text-muted">The Record</p>
          <span className="h-px flex-1 bg-rule-strong/25" aria-hidden />
        </div>
        <p className="mt-2 font-mono text-[0.7rem] text-muted/70">
          Every badge is recomputed from your calls — nothing is granted, only recorded.
        </p>
        <BadgeLedger badges={standing.badges} />
      </div>

      {/* cross-links */}
      <div className="mt-10 rounded-lg border border-card-border bg-card px-4 py-4">
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
  return (
    <div className="mt-3">
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted/70">{label}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((b) => {
          const earned = !!b.earnedAt;
          return (
            <li
              key={b.code}
              className={`flex items-start justify-between gap-3 rounded-md border px-3 py-2 ${
                earned ? "border-accent/40 bg-accent/5" : "border-card-border bg-card"
              }`}
            >
              <span>
                <span className={`font-mono text-xs font-semibold uppercase tracking-[0.1em] ${earned ? "text-accent" : "text-muted"}`}>
                  {b.name}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted">{b.criterion}</span>
              </span>
              <span className={`shrink-0 font-mono text-[0.6rem] uppercase tracking-[0.14em] ${earned ? "text-accent" : "text-muted/70"}`}>
                {earned ? "held" : "open"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function BadgeLedger({ badges }: { badges: StandingDto["badges"] }) {
  const competence = badges.filter((b) => b.tier === "competence");
  const exploration = badges.filter((b) => b.tier === "exploration");
  return (
    <>
      <BadgeGroup label="Competence" items={competence} />
      <BadgeGroup label="Exploration — coverage, not skill" items={exploration} />
    </>
  );
}

// ------------------------------------------------------------- Run
function Run({
  track,
  item,
  reveal,
  picked,
  submitting,
  rating,
  position,
  total,
  levelRoman,
  onSubmit,
  onNext,
}: {
  track: Track;
  item: ItemDto;
  reveal: PostDto | null;
  picked: number | null;
  submitting: boolean;
  rating: number;
  position: number;
  total: number;
  levelRoman: string;
  onSubmit: (i: number) => void;
  onNext: () => void;
}) {
  const topic = topicOf(track, item.topic);
  return (
    <div className="mt-6">
      {/* run header */}
      <div className="flex items-center justify-between font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted">
        <span>
          {topic.short} · <span className="text-muted/70">{TIER_LABEL(item.difficulty)}</span>
        </span>
        <span className="tabular-nums">
          Lv {levelRoman} · {rating} · {Math.min(position, total)}/{total}
        </span>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-card-border" aria-hidden>
        <div className="h-full rounded-full bg-rule-strong transition-[width] duration-300" style={{ width: `${(Math.min(position, total) / total) * 100}%` }} />
      </div>

      {/* scenario */}
      <div className="pair-in mt-5 rounded-lg border border-card-border bg-card px-4 py-4">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted">The scenario</p>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-foreground">{item.scenario}</p>
      </div>

      {/* prompt */}
      <p className="mt-5 text-center text-base font-semibold text-ink-strong">{item.prompt}</p>

      {/* choices */}
      <ul className="mt-4 space-y-2.5">
        {item.choices.map((c, idx) => {
          const rc = reveal?.choices.find((x) => x.i === c.i);
          const isPicked = picked === c.i;
          const isCorrect = rc?.correct;
          let cls = "border-card-border bg-card hover:border-rule-strong";
          if (reveal) {
            if (isCorrect) cls = "border-accent bg-accent/10";
            else if (isPicked) cls = "border-danger bg-danger/10";
            else cls = "border-card-border bg-card opacity-70";
          }
          return (
            <li key={c.i}>
              <button
                disabled={!!reveal || submitting}
                onClick={() => onSubmit(c.i)}
                className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default ${cls}`}
                aria-pressed={isPicked}
              >
                <span className="mt-px shrink-0 font-mono text-xs text-muted tabular-nums">{idx + 1}</span>
                <span className="text-sm leading-relaxed text-foreground">{c.text}</span>
                {reveal && isCorrect && <span className="ml-auto shrink-0 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-accent">correct</span>}
                {reveal && isPicked && !isCorrect && <span className="ml-auto shrink-0 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-danger">your call</span>}
              </button>
            </li>
          );
        })}
      </ul>

      {/* reveal */}
      {reveal && (
        <div className="verdict-card-in mt-5 rounded-lg border border-card-border bg-card px-4 py-4">
          <div className="flex items-center justify-between">
            <p className={`font-mono text-sm font-semibold uppercase tracking-[0.12em] ${reveal.correct ? "text-accent" : "text-danger"}`}>
              {reveal.correct ? "Landed it" : "Not this time"}
            </p>
            <span className={`font-mono text-xs tabular-nums ${reveal.ratingDelta >= 0 ? "text-accent" : "text-danger"}`}>
              {reveal.ratingDelta >= 0 ? "+" : ""}
              {reveal.ratingDelta} → {reveal.liveRating}
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-foreground">{reveal.explanation}</p>
          {/* the rationale on the choice they picked, if they missed */}
          {!reveal.correct && (() => {
            const mine = reveal.choices.find((x) => x.i === reveal.pickedIndex);
            return mine ? (
              <p className="mt-3 border-t border-card-border pt-3 text-xs leading-relaxed text-muted">
                <span className="font-mono uppercase tracking-[0.12em] text-muted/70">Why not your pick · </span>
                {mine.rationale}
              </p>
            ) : null;
          })()}
          <button
            onClick={onNext}
            className="mt-4 w-full rounded-md bg-foreground px-4 py-3 text-center font-mono text-xs font-semibold uppercase tracking-[0.14em] text-background transition-transform hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {position >= total ? "See the recap →" : "Next call →"}
          </button>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------- Recap
function Recap({
  track,
  standing,
  runCorrect,
  runAnswered,
  ratingDelta,
  leveledUp,
  newBadges,
  poolDry,
  onAgain,
  onHome,
}: {
  track: Track;
  standing: StandingDto;
  runCorrect: number;
  runAnswered: number;
  ratingDelta: number;
  leveledUp: LevelDto | null;
  newBadges: StandingDto["badges"];
  poolDry: boolean;
  onAgain: () => void;
  onHome: () => void;
}) {
  return (
    <div className="rise mt-6">
      <div className="text-center">
        <p className="kicker text-muted">Run complete</p>
        <p className="mt-3 font-mono text-[clamp(1.75rem,6vw,2.5rem)] font-semibold leading-none text-ink-strong tabular-nums">
          {runCorrect}<span className="text-muted">/{runAnswered}</span>
        </p>
        <p className="mt-2 font-mono text-xs uppercase tracking-[0.14em] text-muted">calls landed</p>
        <p className={`mt-3 font-mono text-sm tabular-nums ${ratingDelta >= 0 ? "text-accent" : "text-danger"}`}>
          {ratingDelta >= 0 ? "+" : ""}
          {ratingDelta} rating → {standing.liveRating} · Level {standing.level.level.roman}
        </p>
      </div>

      {leveledUp && (
        <div className="mt-6 rounded-lg border border-accent/50 bg-accent/10 px-4 py-4 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-accent">Level up</p>
          <p className="mt-1 text-lg font-semibold text-ink-strong">
            Level {leveledUp.roman} · {leveledUp.title}
          </p>
        </div>
      )}

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

      {poolDry && (
        <p className="mt-6 text-center text-sm text-muted">
          You&apos;ve reached the end of the current pool for this slice — every call here is on your record.
        </p>
      )}

      <div className="mt-8 space-y-2.5">
        <button
          onClick={onAgain}
          className="w-full rounded-lg bg-accent px-5 py-4 text-center font-mono text-sm font-semibold uppercase tracking-[0.14em] text-background transition-transform hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Another run →
        </button>
        <button
          onClick={onHome}
          className="w-full rounded-lg border border-card-border bg-card px-5 py-3 text-center font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ink-strong transition-colors hover:border-rule-strong"
        >
          Back to {track.name}
        </button>
      </div>
    </div>
  );
}
