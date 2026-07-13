"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import Link from "next/link";
import { getOrCreateSessionId, nowMs } from "@/lib/session-client";
import { TRACKS, TRACK_IDS, topicOf, type TrackId, type Track } from "@/lib/train-tracks";

// The client experience for one Training Room track (10x). A three-phase
// machine: dashboard → run → recap. The run serves four interaction kinds —
// an MCQ, an Estimate-with-a-band, a Design Duel, and a Partition-Key Bake-Off —
// and pick-based calls carry a CONVICTION (floored at chance, 1/k). Conviction
// feeds the calibration track (are you as right as you feel?), the room's
// headline 10x metric. Separate world from the study.

const RUN_LENGTH = 8;

// The Descent: a push-your-luck run over the same calls. Each survived call adds
// a rising reward to the pot (depth 1 pays 1, depth 2 pays 2, …); a single miss
// busts the whole unbanked pot. Bank to lock it in — the run ends either way.
// Client-side theatre over calls that log to your record exactly as normal.
const rewardAt = (depth: number) => depth;

// ---- DTOs -------------------------------------------------------------------
type ServedChoice = { i: number; text: string };
type DuelDesign = { name: string; sketch: string; bullets: string[] };
type BakeKeyLite = { id: string; label: string };
type BakeKeyFull = { id: string; label: string; shards: number[]; note: string };
type ItemDto = {
  id: string;
  track: string;
  topic: string;
  kind: "mcq" | "estimate" | "duel" | "bakeoff" | "flood" | "market" | "redline" | "pool";
  difficulty: number;
  scenario: string;
  prompt: string;
  choices?: ServedChoice[];
  estimate?: { unit: string; min: number; max: number };
  duel?: { constraint: string; designA: DuelDesign; designB: DuelDesign };
  bakeoff?: { keys: BakeKeyLite[] };
  flood?: { sensitivity: number; specificity: number; min: number; max: number };
  market?: { unit: string; min: number; max: number; lever: "none" | "tax" | "ceiling"; target: "price" | "quantity" };
  redline?: { mu: number; slaMs: number; percentile: number; min: number; max: number };
  pool?: { arms: [string, string]; unit: string; min: number; max: number; subgroups: PoolSubgroup[] };
};
type PoolSubgroup = { label: string; T: { rate: number; n: number }; C: { rate: number; n: number } };
type LevelDto = { n: number; roman: string; title: string; floor: number | null; gate: string };
type CalBinDto = { lo: number; hi: number; meanConf: number; accuracy: number; count: number };
type CalibrationDto = {
  n: number;
  brier: number;
  ece: number;
  reliability: number;
  resolution: number;
  accuracy: number;
  meanConf: number;
  tendency: "overconfident" | "underconfident" | "sharp" | "unrated";
  score: number | null;
  gap: number;
  bins: CalBinDto[];
};
type CoverageDto = { n: number; captured: number; rate: number; nominal: number };
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
  coverage: CoverageDto;
};
type GetDto = { item: ItemDto | null; remaining: number; liveRating: number; count: number; standing: StandingDto | null };
type RevealChoice = { i: number; text: string; correct: boolean; rationale: string };
type PostDto = {
  correct: boolean;
  kind: "mcq" | "estimate" | "duel" | "bakeoff" | "flood" | "market" | "redline" | "pool";
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
  alsoFits?: string | null;
  room?: { a: number; b: number; total: number };
  // bakeoff
  keys?: BakeKeyFull[];
  best?: string;
  pickedKeyId?: string;
  // flood
  yourPrev?: number;
  sensitivity?: number;
  specificity?: number;
  // market
  naive?: number;
  yourValue?: number;
  naiveTrap?: boolean;
  target?: "price" | "quantity";
  lever?: "none" | "tax" | "ceiling";
  policy?: number;
  demand?: { a: number; b: number };
  supply?: { c: number; d: number };
  eqPrice?: number;
  eqQty?: number;
  tol?: number;
  // redline
  mu?: number;
  slaMs?: number;
  percentile?: number;
  // pool
  arms?: [string, string];
  subgroups?: PoolSubgroup[];
  pooledC?: number;
  liveRating: number;
  ratingDelta: number;
  count: number;
};

type Phase = "dashboard" | "run" | "recap" | "descent-recap";
type RunMode = "standard" | "descent";
const TIER_LABEL = (d: number) => (d >= 3 ? "SUBTLE" : d === 2 ? "MID" : "FOUNDATION");

// conviction word for a chip value
function convictionWord(c: number): string {
  if (c >= 93) return "Locked in";
  if (c >= 80) return "Confident";
  if (c >= 65) return "Leaning";
  if (c >= 45) return "A hunch";
  return "A guess";
}
// discrete conviction chips from the item's chance floor up to 95% — no default,
// so a rushed learner must make a real choice instead of rubber-stamping 75.
function convictionChips(floor: number): number[] {
  const ladder = [50, 70, 85, 95];
  return Array.from(new Set([floor, ...ladder.filter((c) => c > floor)])).sort((a, b) => a - b);
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
  const [runMode, setRunMode] = useState<RunMode>("standard");
  const [pot, setPot] = useState(0);
  const [busted, setBusted] = useState(false);
  const [runStart, setRunStart] = useState<{ rating: number; levelN: number; badges: Set<string>; calScore: number | null; firstEver: boolean }>({
    rating: 1200,
    levelN: 1,
    badges: new Set<string>(),
    calScore: null,
    firstEver: true,
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
    async (topic?: string, mode: RunMode = "standard") => {
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
          firstEver: (standing?.count ?? 0) === 0,
        });
        setTopicFilter(topic);
        setRunMode(mode);
        setPot(0);
        setBusted(false);
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
    async (answer: { pickedIndex?: number; point?: number; lo?: number; hi?: number; keyId?: string; prevalence?: number; value?: number }, confidence: number | null) => {
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
        if (data.correct) {
          setRunCorrect((c) => c + 1);
          if (runMode === "descent") setPot((p) => p + rewardAt(runIndex + 1));
        } else if (runMode === "descent") {
          setBusted(true);
        }
      } catch {
        setError("Couldn't record that call. Try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [item, submitting, reveal, trackId, runMode, runIndex]
  );

  const next = useCallback(async () => {
    const answered = runIndex + 1;
    setRunIndex(answered);
    if (runMode === "standard" && answered >= RUN_LENGTH) {
      await refresh();
      setPhase("recap");
      return;
    }
    try {
      const nx = await fetchItem(topicFilter);
      if (!nx) {
        setPoolDry(true);
        await refresh();
        setPhase(runMode === "descent" ? "descent-recap" : "recap");
        return;
      }
      setReveal(null);
      setItem(nx);
      servedAt.current = nowMs();
    } catch {
      setError("Couldn't load the next call. Try again.");
    }
  }, [runIndex, runMode, fetchItem, topicFilter, refresh]);

  // Bank (or surface after a bust) — end the descent and show its recap. The
  // pot is already final; the busted flag decides whether it survives.
  const bank = useCallback(async () => {
    await refresh();
    setPhase("descent-recap");
  }, [refresh]);

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
          firstEver={runStart.firstEver}
          runMode={runMode}
          pot={pot}
          onSubmit={submit}
          onNext={next}
          onBank={bank}
        />
      ) : phase === "descent-recap" && standing ? (
        <DescentRecap
          trackId={trackId}
          track={track}
          busted={busted}
          pot={pot}
          depth={runIndex + 1}
          onAgain={() => startRun(topicFilter, "descent")}
          onHome={() => setPhase("dashboard")}
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
        <p className="mt-1 font-mono text-[0.6rem] text-muted/70">your rating — everyone starts at 1200; it moves like a chess ladder</p>
      </div>
      {nextLevel && toNext ? (
        <div className="mx-auto mt-4 max-w-sm">
          <div className="h-1 w-full overflow-hidden rounded-full bg-card-border">
            <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${Math.round(pct * 100)}%` }} />
          </div>
          <p className="mt-2 font-mono text-[0.7rem] text-muted">Level {nextLevel.roman} · {nextLevel.title} — {nextLevel.gate}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 font-mono text-[0.65rem] text-muted/70">
            <GateChip label="rating" have={toNext.rating} need={toNext.floor ?? 0} />
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
function CalibrationCard({ cal, coverage }: { cal: CalibrationDto; coverage: CoverageDto }) {
  const W = 260, H = 180, pad = 28;
  const AXMIN = 0.25; // chance on a 4-option call is 25%
  const x = (conf: number) => pad + (Math.max(AXMIN, conf) - AXMIN) * ((W - 2 * pad) / (1 - AXMIN));
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
  // Cold start: a fresh room has no staked calls, so the diagram would be an
  // empty box. Show an inviting placeholder that says what will appear instead.
  if (cal.n === 0) {
    return (
      <div className="rounded-lg border border-dashed border-card-border bg-card px-4 py-5 text-center">
        <p className="kicker text-muted">Calibration — is your confidence honest?</p>
        <p className="mt-3 text-sm leading-relaxed text-foreground">
          Your reliability curve is drawn here — how sure you said vs. how often you were right — the moment you stake conviction on your first call.
        </p>
        <p className="mt-2 font-mono text-[0.65rem] text-muted/70">Most people find they lean overconfident. Start a run to find out where you land.</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-card-border bg-card px-4 py-4">
      <div className="flex items-baseline justify-between">
        <p className="kicker text-muted">Calibration — is your confidence honest?</p>
        {cal.score != null ? (
          <span className="font-mono text-xs tabular-nums text-accent">{cal.score}<span className="text-muted">/100</span></span>
        ) : (
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted/70">{cal.n >= 1 ? `${cal.n}/30 to a score` : "no calls yet"}</span>
        )}
      </div>
      <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[300px]" role="img" aria-label="Calibration reliability diagram: your confidence versus your accuracy">
          <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} className="stroke-card-border" strokeWidth={1} />
          <line x1={pad} y1={pad} x2={pad} y2={H - pad} className="stroke-card-border" strokeWidth={1} />
          {/* perfect-calibration diagonal (from the chance floor to 100%) */}
          <line x1={x(AXMIN)} y1={y(AXMIN)} x2={x(1)} y2={y(1)} className="stroke-rule-strong" strokeDasharray="3 3" strokeWidth={1} />
          {active.length > 1 && (
            <polyline points={active.map((b) => `${x(b.meanConf)},${y(b.accuracy)}`).join(" ")} className="fill-none stroke-accent" strokeWidth={1.5} />
          )}
          {active.map((b, i) => (
            <circle key={i} cx={x(b.meanConf)} cy={y(b.accuracy)} r={Math.min(7, 3 + b.count)} className="fill-accent" />
          ))}
          <text x={pad} y={H - 9} className="fill-muted" style={{ fontSize: 8, fontFamily: "var(--font-mono)" }}>25%</text>
          <text x={W - pad - 14} y={H - 9} className="fill-muted" style={{ fontSize: 8, fontFamily: "var(--font-mono)" }}>99%</text>
          <text x={4} y={pad + 4} className="fill-muted" style={{ fontSize: 8, fontFamily: "var(--font-mono)" }}>100%</text>
          <text x={W / 2} y={H - 1} textAnchor="middle" className="fill-muted/70" style={{ fontSize: 7, fontFamily: "var(--font-mono)" }}>how sure you said →</text>
        </svg>
        <div className="text-left">
          <p className="text-sm leading-relaxed text-foreground">{tendencyCopy}</p>
          <p className="mt-2 text-xs leading-relaxed text-muted">On the dashed line, your confidence matched reality. Dots below it mean you were more sure than you should have been.</p>
          {cal.n > 0 && (
            <p className="mt-2 font-mono text-[0.65rem] text-muted">{cal.n} staked · accuracy {Math.round(cal.accuracy * 100)}% · avg conviction {Math.round(cal.meanConf * 100)}%</p>
          )}
          {cal.n >= 8 && cal.resolution < 0.02 && (
            <p className="mt-1 font-mono text-[0.6rem] text-muted/70">Low sharpness — you&apos;re staking one flat number. Vary conviction: be bolder when you know, humbler when you don&apos;t.</p>
          )}
          {coverage.n >= 3 && (
            <p className="mt-2 border-t border-card-border pt-2 font-mono text-[0.65rem] text-muted">
              Your 90% bands caught the truth in {Math.round(coverage.rate * 100)}% of {coverage.n} estimates —{" "}
              <span className={Math.abs(coverage.rate - 0.9) <= 0.15 ? "text-accent" : "text-muted/70"}>aim for ~90%{coverage.rate < 0.75 ? " (draw them wider)" : coverage.rate > 0.98 ? " (you can tighten)" : ""}</span>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================ Credential share
// Publish a ledger-derived calibration credential and copy its link. Mints the
// session's public slug (mint-once, idempotent, shared with the taste poster)
// and logs a track-tagged credential event for the launch funnel. The URL is
// built client-side from the slug + this track; the page/OG fold the standing
// fresh on each view.
function CredentialShare({ trackId }: { trackId: TrackId }) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const publish = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const sid = getOrCreateSessionId();
      const res = await fetch("/api/train/credential", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid, track: trackId }),
      });
      if (!res.ok) throw new Error("publish failed");
      const data: { slug: string } = await res.json();
      const link = `${window.location.origin}/train/${trackId}/c/${data.slug}`;
      setUrl(link);
      try {
        await navigator.clipboard.writeText(link);
        setCopied(true);
      } catch {
        /* clipboard blocked — the link is shown for manual copy */
      }
    } catch {
      /* leave the button live so the reader can retry */
    } finally {
      setBusy(false);
    }
  }, [busy, trackId]);

  return (
    <div className="rounded-lg border border-card-border bg-card px-4 py-4">
      <p className="kicker text-muted">Your calibration credential</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">A shareable card — your score, your reliability curve, the honesty badges you hold. Recomputed from your record every time it&apos;s opened.</p>
      {!url ? (
        <button onClick={publish} disabled={busy} className="mt-3 w-full rounded-md border border-accent/50 bg-accent/5 px-4 py-3 text-center font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent transition-colors hover:border-accent disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          {busy ? "Publishing…" : "Publish & copy link →"}
        </button>
      ) : (
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-md border border-card-border bg-background/50 px-3 py-2 font-mono text-[0.7rem] text-foreground" aria-label="Your credential link" />
            <a href={url} target="_blank" rel="noreferrer" className="shrink-0 rounded-md border border-card-border px-3 py-2 font-mono text-[0.65rem] uppercase tracking-[0.1em] text-ink-strong transition-colors hover:border-rule-strong">View</a>
          </div>
          <p className="mt-2 font-mono text-[0.65rem] text-accent">{copied ? "Copied to your clipboard — drop it anywhere; it unfurls with a card." : "Link ready — copy it and share."}</p>
        </div>
      )}
    </div>
  );
}

// ============================================================ Dashboard
function Dashboard({ track, standing, rating, otherId, onStart }: {
  track: Track; standing: StandingDto; rating: number; otherId: TrackId; onStart: (topic?: string, mode?: RunMode) => void;
}) {
  const progressFor = (id: string) => standing.topics.find((t) => t.id === id);
  const otherTrack = TRACKS[otherId];
  return (
    <div className="rise mt-6">
      <LevelMeter track={track} standing={standing} rating={rating} />

      {/* Start is the one button that matters — keep it above the fold. */}
      <button onClick={() => onStart()} className="mt-6 w-full rounded-lg bg-accent px-5 py-4 text-center font-mono text-sm font-semibold uppercase tracking-[0.14em] text-background transition-transform hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        Start a run — {RUN_LENGTH} calls →
      </button>
      <p className="mt-2 text-center font-mono text-[0.7rem] text-muted/70">On each call you stake how sure you are; calibration checks whether your sureness matches your accuracy.</p>

      {/* The Descent — push-your-luck alt mode. Secondary so a first-timer takes
          the measured run; the daredevil path is one tap away. */}
      <button onClick={() => onStart(undefined, "descent")} className="mt-3 w-full rounded-lg border border-danger/40 bg-danger/5 px-5 py-3 text-center font-mono text-xs font-semibold uppercase tracking-[0.14em] text-danger transition-colors hover:border-danger/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger">
        ↓ The Descent — bank or push, one miss busts the pot
      </button>

      {/* calibration */}
      <div className="mt-8">
        <CalibrationCard cal={standing.calibration} coverage={standing.coverage} />
      </div>

      {/* shareable credential — only once there's a record to show */}
      {standing.count > 0 && (
        <div className="mt-4">
          <CredentialShare trackId={track.id} />
        </div>
      )}

      <p className="mx-auto mt-6 max-w-md text-center text-sm leading-relaxed text-muted">{track.blurb}</p>

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
function Run({ track, item, reveal, submitting, rating, position, total, levelRoman, firstEver, runMode, pot, onSubmit, onNext, onBank }: {
  track: Track; item: ItemDto; reveal: PostDto | null; submitting: boolean; rating: number;
  position: number; total: number; levelRoman: string; firstEver: boolean;
  runMode: RunMode; pot: number;
  onSubmit: (answer: { pickedIndex?: number; point?: number; lo?: number; hi?: number; keyId?: string; prevalence?: number; value?: number }, confidence: number | null) => void;
  onNext: () => void; onBank: () => void;
}) {
  const topic = topicOf(track, item.topic);
  const kindLabel = item.kind === "estimate" ? "ESTIMATE" : item.kind === "duel" ? "DUEL" : item.kind === "bakeoff" ? "BAKE-OFF" : item.kind === "flood" ? "BASE-RATE" : item.kind === "market" ? "MARKET" : item.kind === "redline" ? "REDLINE" : item.kind === "pool" ? "POOLED" : "CALL";
  const [hintOpen, setHintOpen] = useState(true);
  const descent = runMode === "descent";
  // the post-reveal control: descent shows Bank/Deeper (or Surface on a bust);
  // a standard run shows Next/Recap. Passed into each call so the reveal card is
  // agnostic to the mode driving it.
  const postReveal: ReactNode = reveal
    ? descent
      ? <DescentControls correct={reveal.correct} pot={pot} depth={position} nextReward={rewardAt(position + 1)} onBank={onBank} onDeeper={onNext} />
      : <NextButton last={position >= total} onNext={onNext} />
    : null;
  return (
    <div className="mt-6">
      {firstEver && hintOpen && position === 1 && !descent && (
        <div className="rise mb-4 rounded-lg border border-accent/40 bg-accent/5 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm leading-relaxed text-foreground">
              <span className="font-semibold text-ink-strong">New here?</span>{" "}
              Answer, then stake how sure you are. Being right isn&apos;t the whole game — being{" "}
              <em>calibrated</em>{" "}is. The calibration card shows whether your confidence matches how often
              you&apos;re actually right.
            </p>
            <button onClick={() => setHintOpen(false)} aria-label="dismiss" className="shrink-0 font-mono text-xs text-muted hover:text-foreground">✕</button>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted">
        <span>{topic.short} · <span className="text-muted/70">{kindLabel} · {TIER_LABEL(item.difficulty)}</span></span>
        {descent ? (
          <span className="tabular-nums text-danger">Depth {position} · pot {pot}</span>
        ) : (
          <span className="tabular-nums">Lv {levelRoman} · {rating} · {Math.min(position, total)}/{total}</span>
        )}
      </div>
      {descent ? (
        <div className="mt-2 flex items-center gap-1" aria-hidden>
          {Array.from({ length: Math.min(position, 12) }, (_, i) => (
            <span key={i} className="h-1 flex-1 rounded-full bg-danger/60" />
          ))}
        </div>
      ) : (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-card-border" aria-hidden>
          <div className="h-full rounded-full bg-rule-strong transition-[width] duration-300" style={{ width: `${(Math.min(position, total) / total) * 100}%` }} />
        </div>
      )}

      {item.kind === "mcq" && <McqCall key={item.id} item={item} reveal={reveal} submitting={submitting} onSubmit={onSubmit} postReveal={postReveal} />}
      {item.kind === "estimate" && <EstimateCall key={item.id} item={item} reveal={reveal} submitting={submitting} onSubmit={onSubmit} postReveal={postReveal} />}
      {item.kind === "duel" && <DuelCall key={item.id} item={item} reveal={reveal} submitting={submitting} onSubmit={onSubmit} postReveal={postReveal} />}
      {item.kind === "bakeoff" && <BakeoffCall key={item.id} item={item} reveal={reveal} submitting={submitting} onSubmit={onSubmit} postReveal={postReveal} />}
      {item.kind === "flood" && <FloodCall key={item.id} item={item} reveal={reveal} submitting={submitting} onSubmit={onSubmit} postReveal={postReveal} />}
      {item.kind === "market" && <MarketCall key={item.id} item={item} reveal={reveal} submitting={submitting} onSubmit={onSubmit} postReveal={postReveal} />}
      {item.kind === "redline" && <RedlineCall key={item.id} item={item} reveal={reveal} submitting={submitting} onSubmit={onSubmit} postReveal={postReveal} />}
      {item.kind === "pool" && <PoolCall key={item.id} item={item} reveal={reveal} submitting={submitting} onSubmit={onSubmit} postReveal={postReveal} />}
    </div>
  );
}

// ---- Descent controls (post-reveal): bank the pot, or risk it one deeper ----
function DescentControls({ correct, pot, depth, nextReward, onBank, onDeeper }: {
  correct: boolean; pot: number; depth: number; nextReward: number; onBank: () => void; onDeeper: () => void;
}) {
  if (!correct) {
    return (
      <div className="mt-4 rounded-lg border border-danger/50 bg-danger/10 px-4 py-4 text-center">
        <p className="font-mono text-sm font-semibold uppercase tracking-[0.14em] text-danger">Busted</p>
        <p className="mt-1 font-mono text-[0.65rem] text-muted">You fell at depth {depth}. A miss takes the whole unbanked pot — that&apos;s the wager.</p>
        <button onClick={onBank} className="mt-3 w-full rounded-md bg-foreground px-4 py-3 text-center font-mono text-xs font-semibold uppercase tracking-[0.14em] text-background transition-transform hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          Surface →
        </button>
      </div>
    );
  }
  return (
    <div className="mt-4">
      <p className="text-center font-mono text-[0.7rem] text-muted">Bank {pot} now — or risk all {pot} one call deeper (it pays +{nextReward}).</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button onClick={onBank} className="rounded-md border border-accent/50 bg-accent/5 px-4 py-3 text-center font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent transition-colors hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          Bank {pot} →
        </button>
        <button onClick={onDeeper} className="rounded-md bg-danger px-4 py-3 text-center font-mono text-xs font-semibold uppercase tracking-[0.14em] text-background transition-transform hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger">
          ↓ Deeper
        </button>
      </div>
    </div>
  );
}

// ---- conviction chips (mcq + duel) -----------------------------------------
function ConvictionBar({ floor, conviction, setConviction, onCommit, submitting }: {
  floor: number; conviction: number | null; setConviction: (n: number) => void; onCommit: () => void; submitting: boolean;
}) {
  const chips = convictionChips(floor);
  return (
    <div className="mt-5 rounded-lg border border-accent/30 bg-accent/5 px-4 py-4">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted">How sure are you?</p>
        <span className="font-mono text-sm tabular-nums text-accent">{conviction != null ? `${conviction}% · ${convictionWord(conviction)}` : "pick one"}</span>
      </div>
      <div className="mt-3 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${chips.length}, minmax(0, 1fr))` }}>
        {chips.map((c) => (
          <button key={c} aria-pressed={conviction === c} onClick={() => setConviction(c)}
            className={`rounded-md border px-1 py-2 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${conviction === c ? "border-accent bg-accent/15" : "border-card-border bg-card hover:border-rule-strong"}`}>
            <span className="block font-mono text-sm font-semibold tabular-nums text-ink-strong">{c}%</span>
            <span className="mt-0.5 block font-mono text-[0.55rem] uppercase tracking-[0.08em] text-muted">{convictionWord(c)}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 font-mono text-[0.6rem] text-muted/70">A confident miss stings your calibration more than a hedged one. Report what you actually believe — {floor}% is chance.</p>
      <button onClick={onCommit} disabled={submitting || conviction == null} className="mt-3 w-full rounded-md bg-foreground px-4 py-3 text-center font-mono text-xs font-semibold uppercase tracking-[0.14em] text-background transition-transform hover:-translate-y-px disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
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
function McqCall({ item, reveal, submitting, onSubmit, postReveal }: {
  item: ItemDto; reveal: PostDto | null; submitting: boolean;
  onSubmit: (a: { pickedIndex: number }, c: number | null) => void; postReveal: ReactNode;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [conviction, setConviction] = useState<number | null>(null);
  const floor = Math.round(100 / Math.max(2, (item.choices ?? []).length));
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
        <ConvictionBar floor={floor} conviction={conviction} setConviction={setConviction} submitting={submitting} onCommit={() => onSubmit({ pickedIndex: selected }, conviction)} />
      )}
      {reveal && (
        <div className="verdict-card-in mt-5 rounded-lg border border-card-border bg-card px-4 py-4">
          <RevealHeader correct={reveal.correct} delta={reveal.ratingDelta} rating={reveal.liveRating} />
          {reveal.confidence != null && <ConvictionEcho confidence={reveal.confidence} correct={reveal.correct} />}
          <p className="mt-2 text-sm leading-relaxed text-foreground">{reveal.explanation}</p>
          {postReveal}
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
function EstimateCall({ item, reveal, submitting, onSubmit, postReveal }: {
  item: ItemDto; reveal: PostDto | null; submitting: boolean;
  onSubmit: (a: { point: number; lo: number; hi: number }, c: number | null) => void; postReveal: ReactNode;
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
          {/* handles — big transparent hit targets (touch) + visible grips */}
          {!reveal && (
            <>
              <g onPointerDown={() => setDrag("lo")} className="cursor-ew-resize">
                <rect x={toX(lo) - 14} y={26} width={28} height={36} className="fill-transparent" />
                <rect x={toX(lo) - 5} y={30} width={10} height={28} className="fill-accent" rx={2} />
              </g>
              <g onPointerDown={() => setDrag("hi")} className="cursor-ew-resize">
                <rect x={toX(hi) - 14} y={26} width={28} height={36} className="fill-transparent" />
                <rect x={toX(hi) - 5} y={30} width={10} height={28} className="fill-accent" rx={2} />
              </g>
              <g onPointerDown={() => setDrag("point")} className="cursor-grab">
                <rect x={toX(point) - 14} y={30} width={28} height={28} className="fill-transparent" />
                <path d={`M ${toX(point)} 38 l 7 6 l -7 6 l -7 -6 z`} className="fill-ink-strong" />
              </g>
              {/* value label above the handle you're dragging (thumb won't cover it) */}
              {drag && (
                <text x={toX(drag === "lo" ? lo : drag === "hi" ? hi : point)} y={20} textAnchor="middle" className="fill-ink-strong" style={{ fontSize: 10, fontWeight: 600, fontFamily: "var(--font-mono)" }}>
                  {fmt(drag === "lo" ? lo : drag === "hi" ? hi : point)}
                </text>
              )}
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
          {postReveal}
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
function DuelCall({ item, reveal, submitting, onSubmit, postReveal }: {
  item: ItemDto; reveal: PostDto | null; submitting: boolean;
  onSubmit: (a: { pickedIndex: number }, c: number | null) => void; postReveal: ReactNode;
}) {
  const d = item.duel!;
  const [selected, setSelected] = useState<number | null>(null);
  const [conviction, setConviction] = useState<number | null>(null);
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
        <ConvictionBar floor={50} conviction={conviction} setConviction={setConviction} submitting={submitting} onCommit={() => onSubmit({ pickedIndex: selected }, conviction)} />
      )}

      {reveal && (
        <div className="verdict-card-in mt-5 rounded-lg border border-card-border bg-card px-4 py-4">
          <RevealHeader correct={reveal.correct} delta={reveal.ratingDelta} rating={reveal.liveRating} />
          {/* three verdicts */}
          <dl className="mt-3 space-y-2">
            <VerdictRow label="You" value={`Design ${reveal.pickedIndex === 0 ? "A" : "B"}${reveal.confidence != null ? ` · ${reveal.confidence}% sure` : ""}`} tone={reveal.correct ? "accent" : "danger"} />
            {reveal.room && (
              reveal.room.total >= 5 ? (
                <VerdictRow label="The Room" value={`${Math.round((reveal.room.a / reveal.room.total) * 100)}% A · ${Math.round((reveal.room.b / reveal.room.total) * 100)}% B (${reveal.room.total})`} tone="muted" />
              ) : reveal.room.total <= 1 ? (
                <VerdictRow label="The Room" value="you're the first to call this — the crowd tally opens at five" tone="accent" />
              ) : (
                <VerdictRow label="The Room" value={`vote ${reveal.room.total} of 5 — the crowd tally opens at five`} tone="muted" />
              )
            )}
            <VerdictRow label="The Desk" value={`Design ${reveal.better} — ${reveal.failureMode}`} tone="ink" />
          </dl>
          <p className="mt-3 border-t border-card-border pt-3 text-sm leading-relaxed text-foreground">{reveal.deskRationale}</p>
          {reveal.alsoFits && (
            <p className="mt-2 text-xs leading-relaxed text-muted">
              <span className="font-mono uppercase tracking-[0.12em] text-muted/70">Also defensible · </span>{reveal.alsoFits}
            </p>
          )}
          {postReveal}
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

// ---- PARTITION-KEY BAKE-OFF (pick a shard key; reveal the load histograms) ---
function ShardHisto({ shards, globalMax, tone }: { shards: number[]; globalMax: number; tone: "accent" | "danger" | "muted" }) {
  const W = 120, H = 34, n = shards.length, gap = 2;
  const bw = (W - gap * (n - 1)) / n;
  const hotIdx = shards.indexOf(Math.max(...shards));
  const barCls = tone === "accent" ? "fill-accent" : tone === "danger" ? "fill-danger" : "fill-rule-strong";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-9 w-full max-w-[160px]" role="img" aria-label="shard load histogram">
      {shards.map((s, i) => {
        const h = globalMax > 0 ? (s / globalMax) * (H - 2) : 0;
        const isHot = i === hotIdx && tone !== "accent";
        return <rect key={i} x={i * (bw + gap)} y={H - h} width={bw} height={h} className={isHot ? "fill-danger" : barCls} rx={0.5} />;
      })}
    </svg>
  );
}
function BakeoffCall({ item, reveal, submitting, onSubmit, postReveal }: {
  item: ItemDto; reveal: PostDto | null; submitting: boolean;
  onSubmit: (a: { keyId: string }, c: number | null) => void; postReveal: ReactNode;
}) {
  const keys = item.bakeoff!.keys;
  const [selected, setSelected] = useState<string | null>(null);
  const [conviction, setConviction] = useState<number | null>(null);
  const floor = Math.round(100 / Math.max(2, keys.length));
  const globalMax = reveal?.keys ? Math.max(...reveal.keys.flatMap((k) => k.shards)) : 1;
  const maxShare = (k: BakeKeyFull) => Math.round((Math.max(...k.shards) / k.shards.reduce((a, b) => a + b, 0)) * 100);
  return (
    <>
      <div className="pair-in mt-5 rounded-lg border border-card-border bg-card px-4 py-4">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted">The workload</p>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-foreground">{item.scenario}</p>
      </div>
      <p className="mt-5 text-center text-base font-semibold text-ink-strong">{item.prompt}</p>
      <p className="mt-1 text-center font-mono text-[0.65rem] text-muted/70">The key decides your hot shards. Predict which spreads load evenly — then see the histograms.</p>

      {!reveal ? (
        <ul className="mt-4 space-y-2">
          {keys.map((k) => (
            <li key={k.id}>
              <button disabled={submitting} onClick={() => setSelected(k.id)} aria-pressed={selected === k.id}
                className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left font-mono text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${selected === k.id ? "border-accent bg-accent/10 text-ink-strong" : "border-card-border bg-card text-foreground hover:border-rule-strong"}`}>
                {k.label}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="mt-4 space-y-2">
          {reveal.keys!.map((k) => {
            const isBest = k.id === reveal.best;
            const isPicked = k.id === reveal.pickedKeyId;
            const tone: "accent" | "danger" | "muted" = isBest ? "accent" : isPicked ? "danger" : "muted";
            return (
              <li key={k.id} className={`rounded-lg border px-4 py-3 ${isBest ? "border-accent bg-accent/10" : isPicked ? "border-danger bg-danger/10" : "border-card-border bg-card"}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-sm text-ink-strong">{k.label}</span>
                  <span className={`shrink-0 font-mono text-[0.6rem] uppercase tracking-[0.12em] ${isBest ? "text-accent" : isPicked ? "text-danger" : "text-muted/70"}`}>
                    {isBest ? "the fit" : isPicked ? "your call" : ""} · hot shard {maxShare(k)}%
                  </span>
                </div>
                <div className="mt-2 flex items-end gap-3">
                  <ShardHisto shards={k.shards} globalMax={globalMax} tone={tone} />
                  <span className="text-xs leading-snug text-muted">{k.note}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!reveal && selected != null && (
        <ConvictionBar floor={floor} conviction={conviction} setConviction={setConviction} submitting={submitting} onCommit={() => onSubmit({ keyId: selected }, conviction)} />
      )}
      {reveal && (
        <div className="verdict-card-in mt-5 rounded-lg border border-card-border bg-card px-4 py-4">
          <RevealHeader correct={reveal.correct} delta={reveal.ratingDelta} rating={reveal.liveRating} />
          <p className="mt-2 text-sm leading-relaxed text-foreground">{reveal.explanation}</p>
          {postReveal}
        </div>
      )}
    </>
  );
}

// ---- BASE-RATE FLOOD (scrub prevalence over 1024 people to PPV = 50%) -------
function FloodCall({ item, reveal, submitting, onSubmit, postReveal }: {
  item: ItemDto; reveal: PostDto | null; submitting: boolean;
  onSubmit: (a: { prevalence: number }, c: null) => void; postReveal: ReactNode;
}) {
  const f = item.flood!;
  const [prev, setPrev] = useState(Math.round(((f.min + f.max) / 2) * 10) / 10);
  const shownPrev = reveal ? reveal.yourPrev! : prev;
  const N = 1024, COLS = 32;
  const p = shownPrev / 100;
  const sick = Math.round(N * p);
  const healthy = N - sick;
  const tp = Math.round(sick * (f.sensitivity / 100));
  const fp = Math.round(healthy * (1 - f.specificity / 100));
  const ppv = tp + fp > 0 ? Math.round((tp / (tp + fp)) * 100) : 0;
  // color the first tp cells accent (true positives), next fp cells danger
  // (false positives), the rest faint (test-negatives) — the accent-vs-danger
  // ratio among the lit cells IS the PPV, made visible.
  const cellCls = (i: number) => (i < tp ? "fill-accent" : i < tp + fp ? "fill-danger" : "fill-card-border");
  const S = 10, GAP = 1.5;
  return (
    <>
      <div className="pair-in mt-5 rounded-lg border border-card-border bg-card px-4 py-4">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted">The screen</p>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-foreground">{item.scenario}</p>
      </div>
      <p className="mt-5 text-center text-base font-semibold text-ink-strong">{item.prompt}</p>

      <div className="mt-4 rounded-lg border border-card-border bg-card px-4 py-4">
        <svg viewBox={`0 0 ${COLS * (S + GAP)} ${COLS * (S + GAP)}`} className="mx-auto block w-full max-w-[300px]" role="img" aria-label="A grid of 1024 people: true positives, false positives, and test-negatives at the chosen prevalence">
          {Array.from({ length: N }, (_, i) => (
            <rect key={i} x={(i % COLS) * (S + GAP)} y={Math.floor(i / COLS) * (S + GAP)} width={S} height={S} rx={1} className={cellCls(i)} />
          ))}
        </svg>
        <div className="mt-3 flex items-center justify-center gap-4 font-mono text-[0.65rem]">
          <span className="text-accent">■ has it & tests + ({tp})</span>
          <span className="text-danger">■ healthy but tests + ({fp})</span>
        </div>
        <p className="mt-3 text-center font-mono text-sm tabular-nums text-ink-strong">
          P(has it | positive) = <span className={Math.abs(ppv - 50) <= 6 ? "text-accent" : "text-foreground"}>{ppv}%</span>
        </p>
      </div>

      {!reveal ? (
        <>
          <div className="mt-3">
            <div className="flex items-baseline justify-between font-mono text-[0.7rem] text-muted">
              <span>prevalence</span>
              <span className="tabular-nums text-ink-strong">{prev}%</span>
            </div>
            <input type="range" min={f.min} max={f.max} step={0.1} value={prev} onChange={(e) => setPrev(Number(e.target.value))} aria-label="prevalence" className="mt-1 w-full accent-[var(--accent)]" />
            <p className="mt-1 font-mono text-[0.6rem] text-muted/70">Drag until a positive result is a coin flip — P(has it | positive) = 50%.</p>
          </div>
          <button disabled={submitting} onClick={() => onSubmit({ prevalence: prev }, null)}
            className="mt-4 w-full rounded-lg bg-accent px-5 py-3 text-center font-mono text-sm font-semibold uppercase tracking-[0.14em] text-background transition-transform hover:-translate-y-px disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            Lock in the prevalence →
          </button>
        </>
      ) : (
        <div className="verdict-card-in mt-5 rounded-lg border border-card-border bg-card px-4 py-4">
          <RevealHeader correct={reveal.correct} delta={reveal.ratingDelta} rating={reveal.liveRating} />
          <p className="mt-2 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-muted">
            You said {reveal.yourPrev}% · PPV hits 50% at {reveal.truth}% prevalence
          </p>
          <p className="mt-2 text-sm leading-relaxed text-foreground">{reveal.explanation}</p>
          {postReveal}
        </div>
      )}
    </>
  );
}

// ---- MARKET (economics signature: predict one number, then the second-order
// consequence overruns your intuition beside where you guessed) ---------------
// The supply/demand chart is a REVEAL only — pre-commit the learner predicts
// from the written scenario, so the answer can't be back-computed and the task
// stays a calibration of intuition, not an algebra drill.
function MarketChart({ reveal }: { reveal: PostDto }) {
  const d = reveal.demand, s = reveal.supply;
  if (!d || !s || reveal.eqPrice == null || reveal.eqQty == null) return null;
  const W = 300, H = 190, pad = 26;
  const yMax = Math.max(d.a / d.b, (reveal.truth ?? 0) + (reveal.policy ?? 0)) * 1.08;
  const xMax = Math.max(d.a, reveal.eqQty * 1.3) * 1.02;
  const sx = (q: number) => pad + Math.max(0, Math.min(1, q / xMax)) * (W - 2 * pad);
  const sy = (p: number) => H - pad - Math.max(0, Math.min(1, p / yMax)) * (H - 2 * pad);
  // demand: P=a/b at Q=0 → P=0 at Q=a ; supply: Qs=c+dP over [pLow, yMax]
  const pLow = Math.max(0, -s.c / s.d);
  const isTax = reveal.lever === "tax";
  const isCeil = reveal.lever === "ceiling";
  const pc = reveal.truth ?? 0; // tax: consumer price
  const ps = isTax ? pc - (reveal.policy ?? 0) : 0;
  const ceilP = reveal.policy ?? 0;
  const qCeil = reveal.truth ?? 0; // ceiling: transacted (short side)
  const qCeilD = reveal.naive ?? 0; // ceiling: demanded (naive)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full max-w-[340px]" role="img" aria-label="Supply and demand chart with the policy outcome">
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} className="stroke-card-border" strokeWidth={1} />
      <line x1={pad} y1={pad} x2={pad} y2={H - pad} className="stroke-card-border" strokeWidth={1} />
      {/* demand + supply */}
      <line x1={sx(0)} y1={sy(d.a / d.b)} x2={sx(d.a)} y2={sy(0)} className="stroke-accent" strokeWidth={1.5} />
      <line x1={sx(s.c + s.d * pLow)} y1={sy(pLow)} x2={sx(s.c + s.d * yMax)} y2={sy(yMax)} className="stroke-foreground" strokeWidth={1.5} />
      {/* free equilibrium */}
      <circle cx={sx(reveal.eqQty)} cy={sy(reveal.eqPrice)} r={3} className="fill-muted" />
      <text x={sx(reveal.eqQty) + 4} y={sy(reveal.eqPrice) - 4} className="fill-muted" style={{ fontSize: 7, fontFamily: "var(--font-mono)" }}>eq</text>
      {isTax && (
        <>
          <line x1={pad} y1={sy(pc)} x2={sx(d.a - d.b * pc)} y2={sy(pc)} className="stroke-danger" strokeDasharray="3 2" strokeWidth={1} />
          <line x1={pad} y1={sy(ps)} x2={sx(d.a - d.b * pc)} y2={sy(ps)} className="stroke-rule-strong" strokeDasharray="3 2" strokeWidth={1} />
          <text x={pad + 2} y={sy(pc) - 3} className="fill-danger" style={{ fontSize: 7, fontFamily: "var(--font-mono)" }}>buyers pay</text>
          <text x={pad + 2} y={sy(ps) + 9} className="fill-muted" style={{ fontSize: 7, fontFamily: "var(--font-mono)" }}>sellers get</text>
        </>
      )}
      {isCeil && (
        <>
          <line x1={pad} y1={sy(ceilP)} x2={W - pad} y2={sy(ceilP)} className="stroke-danger" strokeDasharray="3 2" strokeWidth={1} />
          <line x1={sx(qCeil)} y1={sy(ceilP)} x2={sx(qCeilD)} y2={sy(ceilP)} className="stroke-danger" strokeWidth={3} />
          <text x={pad + 2} y={sy(ceilP) - 3} className="fill-danger" style={{ fontSize: 7, fontFamily: "var(--font-mono)" }}>ceiling · shortage</text>
        </>
      )}
      <text x={W - pad} y={H - pad + 9} textAnchor="end" className="fill-muted/70" style={{ fontSize: 7, fontFamily: "var(--font-mono)" }}>quantity →</text>
      <text x={pad - 4} y={pad} textAnchor="end" className="fill-muted/70" style={{ fontSize: 7, fontFamily: "var(--font-mono)" }}>price</text>
    </svg>
  );
}
function MarketCall({ item, reveal, submitting, onSubmit, postReveal }: {
  item: ItemDto; reveal: PostDto | null; submitting: boolean;
  onSubmit: (a: { value: number }, c: number | null) => void; postReveal: ReactNode;
}) {
  const m = item.market!;
  const span = m.max - m.min;
  const [value, setValue] = useState(Math.round((m.min + span / 2) * 10) / 10);
  const [conviction, setConviction] = useState<number | null>(null);
  const step = Math.max(0.1, Math.round((span / 100) * 10) / 10);
  const unit = m.unit;
  const fmt = (v: number) => `${Math.round(v * 10) / 10}${unit}`;
  // reveal caliper strip: your guess, the naive ghost, the truth, distance-shaded
  const cx = (v: number) => `${Math.max(0, Math.min(100, ((v - m.min) / span) * 100))}%`;
  const off = reveal ? Math.abs((reveal.yourValue ?? 0) - (reveal.truth ?? 0)) : 0;
  const within = reveal ? off <= (reveal.tol ?? 0) : false;
  return (
    <>
      <div className="pair-in mt-5 rounded-lg border border-card-border bg-card px-4 py-4">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted">The market</p>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-foreground">{item.scenario}</p>
      </div>
      <p className="mt-5 text-center text-base font-semibold text-ink-strong">{item.prompt}</p>
      <p className="mt-1 text-center font-mono text-[0.65rem] text-muted/70">Predict from the setup — the supply &amp; demand curves are revealed after you commit.</p>

      {!reveal ? (
        <>
          <div className="mt-4 rounded-lg border border-card-border bg-card px-4 py-4">
            <div className="flex items-baseline justify-between font-mono text-[0.7rem] text-muted">
              <span>your {m.target}</span>
              <span className="tabular-nums text-ink-strong text-sm">{fmt(value)}</span>
            </div>
            <input type="range" min={m.min} max={m.max} step={step} value={value} onChange={(e) => setValue(Number(e.target.value))} aria-label={`predicted ${m.target}`} className="mt-2 w-full accent-[var(--accent)]" />
            <div className="mt-1 flex justify-between font-mono text-[0.55rem] text-muted/70"><span>{fmt(m.min)}</span><span>{fmt(m.max)}</span></div>
            <div className="mt-3 flex items-center justify-center gap-2 font-mono text-[0.65rem]">
              <button onClick={() => setValue((v) => Math.max(m.min, Math.round((v - step) * 10) / 10))} className="rounded border border-card-border px-2 py-0.5 text-accent" aria-label="decrease">−</button>
              <span className="tabular-nums text-foreground">{fmt(value)}</span>
              <button onClick={() => setValue((v) => Math.min(m.max, Math.round((v + step) * 10) / 10))} className="rounded border border-card-border px-2 py-0.5 text-accent" aria-label="increase">+</button>
            </div>
          </div>
          <ConvictionBar floor={50} conviction={conviction} setConviction={setConviction} submitting={submitting} onCommit={() => onSubmit({ value }, conviction)} />
        </>
      ) : (
        <div className="verdict-card-in mt-5 rounded-lg border border-card-border bg-card px-4 py-4">
          <RevealHeader correct={reveal.correct} delta={reveal.ratingDelta} rating={reveal.liveRating} />
          {reveal.confidence != null && <ConvictionEcho confidence={reveal.confidence} correct={reveal.correct} />}
          <p className="mt-2 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-muted">
            You said {fmt(reveal.yourValue ?? 0)} · the market settles at {fmt(reveal.truth ?? 0)}
            {!within && <span className="text-muted/70"> · off by {fmt(off)}</span>}
          </p>
          {reveal.naiveTrap && (
            <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-danger">You landed on the intuition — the seductive first-order answer.</p>
          )}
          {/* caliper strip: your guess · the intuition · the truth, distance-shaded */}
          <div className="relative mt-4 h-9">
            <div className="absolute left-0 right-0 top-4 h-px bg-card-border" />
            {/* distance bar from guess to truth */}
            <div className={`absolute top-4 h-1 -translate-y-1/2 rounded ${within ? "bg-accent/40" : "bg-danger/40"}`}
              style={{ left: cx(Math.min(reveal.yourValue ?? 0, reveal.truth ?? 0)), width: `calc(${cx(Math.max(reveal.yourValue ?? 0, reveal.truth ?? 0))} - ${cx(Math.min(reveal.yourValue ?? 0, reveal.truth ?? 0))})` }} />
            {reveal.naive != null && Math.abs((reveal.naive ?? 0) - (reveal.truth ?? 0)) > 0.01 && (
              <div className="absolute top-4 -translate-x-1/2 -translate-y-1/2" style={{ left: cx(reveal.naive) }}>
                <span className="block h-2.5 w-px bg-muted/60" />
                <span className="mt-0.5 block whitespace-nowrap font-mono text-[0.5rem] text-muted/70">intuition</span>
              </div>
            )}
            <div className={`absolute top-4 -translate-x-1/2 -translate-y-1/2 ${within ? "text-accent" : "text-danger"}`} style={{ left: cx(reveal.yourValue ?? 0) }}>
              <span className="block h-3 w-0.5 bg-current" />
              <span className="mt-0.5 block whitespace-nowrap font-mono text-[0.5rem]">you</span>
            </div>
            <div className="absolute top-4 -translate-x-1/2 -translate-y-1/2 text-ink-strong" style={{ left: cx(reveal.truth ?? 0) }}>
              <span className="block h-3 w-0.5 bg-current" />
              <span className="mt-0.5 block whitespace-nowrap font-mono text-[0.5rem]">market</span>
            </div>
          </div>
          <div className="mt-3 flex justify-center"><MarketChart reveal={reveal} /></div>
          <p className="mt-2 text-sm leading-relaxed text-foreground">{reveal.explanation}</p>
          {postReveal}
        </div>
      )}
    </>
  );
}

// ---- REDLINE (architecture signature: predict the max utilization a queue can
// run at under an SLA; the p99 hockey-stick is a reveal) ----------------------
// Winner of the architecture 10x competition (Latency Physics), reframed to be
// calibration-native (predict a number + stake conviction + naive_trap on the
// seductive "run it hot" value), with the p99 curve rendered ONCE on the reveal
// so its λ→μ singularity is handled with the knee already known.
function RedlineChart({ reveal }: { reveal: PostDto }) {
  const mu = reveal.mu, slaMs = reveal.slaMs, p = (reveal.percentile ?? 99) / 100;
  if (mu == null || slaMs == null || reveal.truth == null) return null;
  const z = Math.log(1 / (1 - p));
  const W = 300, H = 190, pad = 26;
  const yMax = slaMs * 2.4;
  const sx = (u: number) => pad + Math.max(0, Math.min(1, u / 100)) * (W - 2 * pad);
  const sy = (ms: number) => H - pad - Math.max(0, Math.min(1, ms / yMax)) * (H - 2 * pad);
  const p99ms = (u: number) => (z / (mu * (1 - u / 100))) * 1000;
  // sample the hockey-stick from 0 to just shy of 100% utilization, clipped
  const pts: string[] = [];
  for (let u = 0; u <= 97; u += 1.5) pts.push(`${sx(u)},${sy(p99ms(u))}`);
  const your = reveal.yourValue ?? 0;
  const within = Math.abs(your - reveal.truth) <= (reveal.tol ?? 0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full max-w-[340px]" role="img" aria-label="p99 latency versus utilization, with the SLA line and the knee">
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} className="stroke-card-border" strokeWidth={1} />
      <line x1={pad} y1={pad} x2={pad} y2={H - pad} className="stroke-card-border" strokeWidth={1} />
      {/* SLA line */}
      <line x1={pad} y1={sy(slaMs)} x2={W - pad} y2={sy(slaMs)} className="stroke-rule-strong" strokeDasharray="3 2" strokeWidth={1} />
      <text x={W - pad} y={sy(slaMs) - 3} textAnchor="end" className="fill-muted" style={{ fontSize: 7, fontFamily: "var(--font-mono)" }}>SLA {slaMs}ms</text>
      {/* the p99 hockey-stick */}
      <polyline points={pts.join(" ")} className="fill-none stroke-accent" strokeWidth={1.5} />
      {/* naive ("≈ full") tick */}
      {reveal.naive != null && (
        <line x1={sx(reveal.naive)} y1={pad} x2={sx(reveal.naive)} y2={H - pad} className="stroke-muted/40" strokeDasharray="1 2" strokeWidth={1} />
      )}
      {/* the knee (truth) */}
      <line x1={sx(reveal.truth)} y1={sy(slaMs)} x2={sx(reveal.truth)} y2={H - pad} className="stroke-ink-strong" strokeWidth={1} />
      <circle cx={sx(reveal.truth)} cy={sy(slaMs)} r={2.5} className="fill-ink-strong" />
      <text x={sx(reveal.truth) + 3} y={H - pad - 3} className="fill-ink-strong" style={{ fontSize: 7, fontFamily: "var(--font-mono)" }}>knee {reveal.truth}%</text>
      {/* your guess */}
      <line x1={sx(your)} y1={pad} x2={sx(your)} y2={H - pad} className={within ? "stroke-accent" : "stroke-danger"} strokeWidth={1.5} />
      <text x={W / 2} y={H - 1} textAnchor="middle" className="fill-muted/70" style={{ fontSize: 7, fontFamily: "var(--font-mono)" }}>utilization →</text>
      <text x={pad - 4} y={pad} textAnchor="end" className="fill-muted/70" style={{ fontSize: 7, fontFamily: "var(--font-mono)" }}>p99</text>
    </svg>
  );
}
function RedlineCall({ item, reveal, submitting, onSubmit, postReveal }: {
  item: ItemDto; reveal: PostDto | null; submitting: boolean;
  onSubmit: (a: { value: number }, c: number | null) => void; postReveal: ReactNode;
}) {
  const r = item.redline!;
  const [value, setValue] = useState(Math.round((r.min + r.max) / 2));
  const [conviction, setConviction] = useState<number | null>(null);
  const pctl = r.percentile === 99.9 ? "p99.9" : r.percentile === 95 ? "p95" : "p99";
  const your = reveal?.yourValue ?? 0;
  const within = reveal ? Math.abs(your - (reveal.truth ?? 0)) <= (reveal.tol ?? 0) : false;
  const tooLow = reveal ? !within && your < (reveal.truth ?? 0) : false;
  const span = r.max - r.min;
  const cx = (v: number) => `${Math.max(0, Math.min(100, ((v - r.min) / span) * 100))}%`;
  return (
    <>
      <div className="pair-in mt-5 rounded-lg border border-card-border bg-card px-4 py-4">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted">The queue</p>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-foreground">{item.scenario}</p>
        <p className="mt-2 font-mono text-[0.65rem] text-muted/70">μ = {r.mu} req/s · SLA {pctl} &lt; {r.slaMs} ms</p>
      </div>
      <p className="mt-5 text-center text-base font-semibold text-ink-strong">{item.prompt}</p>
      <p className="mt-1 text-center font-mono text-[0.65rem] text-muted/70">Predict from the setup — the p99 curve is revealed after you commit.</p>

      {!reveal ? (
        <>
          <div className="mt-4 rounded-lg border border-card-border bg-card px-4 py-4">
            <div className="flex items-baseline justify-between font-mono text-[0.7rem] text-muted">
              <span>max utilization</span>
              <span className="tabular-nums text-ink-strong text-sm">{value}%</span>
            </div>
            <input type="range" min={r.min} max={r.max} step={1} value={value} onChange={(e) => setValue(Number(e.target.value))} aria-label="predicted max utilization" className="mt-2 w-full accent-[var(--accent)]" />
            <div className="mt-1 flex justify-between font-mono text-[0.55rem] text-muted/70"><span>{r.min}%</span><span>{r.max}%</span></div>
            <div className="mt-3 flex items-center justify-center gap-2 font-mono text-[0.65rem]">
              <button onClick={() => setValue((v) => Math.max(r.min, v - 1))} className="rounded border border-card-border px-2 py-0.5 text-accent" aria-label="decrease">−</button>
              <span className="tabular-nums text-foreground">{value}%</span>
              <button onClick={() => setValue((v) => Math.min(r.max, v + 1))} className="rounded border border-card-border px-2 py-0.5 text-accent" aria-label="increase">+</button>
            </div>
          </div>
          <ConvictionBar floor={50} conviction={conviction} setConviction={setConviction} submitting={submitting} onCommit={() => onSubmit({ value }, conviction)} />
        </>
      ) : (
        <div className="verdict-card-in mt-5 rounded-lg border border-card-border bg-card px-4 py-4">
          <RevealHeader correct={reveal.correct} delta={reveal.ratingDelta} rating={reveal.liveRating} />
          {reveal.confidence != null && <ConvictionEcho confidence={reveal.confidence} correct={reveal.correct} />}
          <p className="mt-2 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-muted">
            You said {your}% · the knee is at {reveal.truth}%
          </p>
          {reveal.naiveTrap && (
            <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-danger">You&apos;d run it near full — past the knee the p99 tail goes vertical.</p>
          )}
          {tooLow && !reveal.naiveTrap && (
            <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted/70">Safe — but well under the knee is idle capacity you&apos;re paying for. Over-provisioning is the other failure mode.</p>
          )}
          {/* caliper strip: you · ≈full · knee, distance-shaded */}
          <div className="relative mt-4 h-9">
            <div className="absolute left-0 right-0 top-4 h-px bg-card-border" />
            <div className={`absolute top-4 h-1 -translate-y-1/2 rounded ${within ? "bg-accent/40" : "bg-danger/40"}`}
              style={{ left: cx(Math.min(your, reveal.truth ?? 0)), width: `calc(${cx(Math.max(your, reveal.truth ?? 0))} - ${cx(Math.min(your, reveal.truth ?? 0))})` }} />
            {reveal.naive != null && (
              <div className="absolute top-4 -translate-x-1/2 -translate-y-1/2" style={{ left: cx(reveal.naive) }}>
                <span className="block h-2.5 w-px bg-muted/60" />
                <span className="mt-0.5 block whitespace-nowrap font-mono text-[0.5rem] text-muted/70">≈ full</span>
              </div>
            )}
            <div className={`absolute top-4 -translate-x-1/2 -translate-y-1/2 ${within ? "text-accent" : "text-danger"}`} style={{ left: cx(your) }}>
              <span className="block h-3 w-0.5 bg-current" />
              <span className="mt-0.5 block whitespace-nowrap font-mono text-[0.5rem]">you</span>
            </div>
            <div className="absolute top-4 -translate-x-1/2 -translate-y-1/2 text-ink-strong" style={{ left: cx(reveal.truth ?? 0) }}>
              <span className="block h-3 w-0.5 bg-current" />
              <span className="mt-0.5 block whitespace-nowrap font-mono text-[0.5rem]">knee</span>
            </div>
          </div>
          <div className="mt-3 flex justify-center"><RedlineChart reveal={reveal} /></div>
          <p className="mt-2 text-sm leading-relaxed text-foreground">{reveal.explanation}</p>
          {postReveal}
        </div>
      )}
    </>
  );
}

// ---- POOL (statistics signature: Simpson's paradox — the arm ahead in every
// subgroup lands behind when pooled) -----------------------------------------
// Winner of the statistics 10x competition (Rotor's "Pooling Machine"). The
// subgroup table is shown so the learner can reason; the task is to weight by
// size, not take the seductive unweighted average (the naive_trap). On reveal
// the pooled dot slides from the naive average to its true weighted position.
function PoolCall({ item, reveal, submitting, onSubmit, postReveal }: {
  item: ItemDto; reveal: PostDto | null; submitting: boolean;
  onSubmit: (a: { value: number }, c: number | null) => void; postReveal: ReactNode;
}) {
  const pl = item.pool!;
  const [tName, cName] = pl.arms;
  const span = pl.max - pl.min;
  const [value, setValue] = useState(Math.round((pl.min + span / 2) * 10) / 10);
  const [conviction, setConviction] = useState<number | null>(null);
  const unit = pl.unit;
  const fmt = (v: number) => `${Math.round(v * 10) / 10}${unit}`;
  const cx = (v: number) => `${Math.max(0, Math.min(100, ((v - pl.min) / span) * 100))}%`;
  const your = reveal?.yourValue ?? 0;
  const within = reveal ? Math.abs(your - (reveal.truth ?? 0)) <= (reveal.tol ?? 0) : false;
  // widths for the subgroup mini-bars: scale each arm's rate against the max rate shown
  const maxRate = Math.max(...pl.subgroups.flatMap((g) => [g.T.rate, g.C.rate]));
  return (
    <>
      <div className="pair-in mt-5 rounded-lg border border-card-border bg-card px-4 py-4">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted">The breakdown</p>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-foreground">{item.scenario}</p>
        {/* subgroup table — the learner needs the rates AND the sizes to weight */}
        <div className="mt-3 space-y-2.5">
          {pl.subgroups.map((g, i) => (
            <div key={i}>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted/70">{g.label}</p>
              {([["T", g.T, tName] as const, ["C", g.C, cName] as const]).map(([k, arm, name]) => (
                <div key={k} className="mt-1 flex items-center gap-2">
                  <span className="w-24 shrink-0 truncate font-mono text-[0.65rem] text-ink-strong">{name}</span>
                  <span className="h-2 rounded-sm bg-accent/50" style={{ width: `${(arm.rate / maxRate) * 45}%` }} />
                  <span className="font-mono text-[0.65rem] tabular-nums text-foreground">{arm.rate}{unit}</span>
                  <span className="font-mono text-[0.6rem] tabular-nums text-muted/70">n={arm.n.toLocaleString()}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-5 text-center text-base font-semibold text-ink-strong">{item.prompt}</p>
      <p className="mt-1 text-center font-mono text-[0.65rem] text-muted/70">{tName} leads in every subgroup — but predict the OVERALL rate across all its cases.</p>

      {!reveal ? (
        <>
          <div className="mt-4 rounded-lg border border-card-border bg-card px-4 py-4">
            <div className="flex items-baseline justify-between font-mono text-[0.7rem] text-muted">
              <span>pooled {tName}</span>
              <span className="tabular-nums text-ink-strong text-sm">{fmt(value)}</span>
            </div>
            <input type="range" min={pl.min} max={pl.max} step={0.5} value={value} onChange={(e) => setValue(Number(e.target.value))} aria-label={`predicted pooled rate for ${tName}`} className="mt-2 w-full accent-[var(--accent)]" />
            <div className="mt-1 flex justify-between font-mono text-[0.55rem] text-muted/70"><span>{fmt(pl.min)}</span><span>{fmt(pl.max)}</span></div>
            <div className="mt-3 flex items-center justify-center gap-2 font-mono text-[0.65rem]">
              <button onClick={() => setValue((v) => Math.max(pl.min, Math.round((v - 0.5) * 10) / 10))} className="rounded border border-card-border px-2 py-0.5 text-accent" aria-label="decrease">−</button>
              <span className="tabular-nums text-foreground">{fmt(value)}</span>
              <button onClick={() => setValue((v) => Math.min(pl.max, Math.round((v + 0.5) * 10) / 10))} className="rounded border border-card-border px-2 py-0.5 text-accent" aria-label="increase">+</button>
            </div>
          </div>
          <ConvictionBar floor={50} conviction={conviction} setConviction={setConviction} submitting={submitting} onCommit={() => onSubmit({ value }, conviction)} />
        </>
      ) : (
        <div className="verdict-card-in mt-5 rounded-lg border border-card-border bg-card px-4 py-4">
          <RevealHeader correct={reveal.correct} delta={reveal.ratingDelta} rating={reveal.liveRating} />
          {reveal.confidence != null && <ConvictionEcho confidence={reveal.confidence} correct={reveal.correct} />}
          <p className="mt-2 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-muted">
            You said {fmt(your)} · pooled {tName} is {fmt(reveal.truth ?? 0)} · pooled {cName} is {fmt(reveal.pooledC ?? 0)}
          </p>
          {reveal.naiveTrap && (
            <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-danger">You took the simple average — it ignores the group sizes.</p>
          )}
          {(reveal.pooledC ?? 0) > (reveal.truth ?? 0) && (
            <p className="mt-2 rounded-md border border-danger/40 bg-danger/5 px-3 py-2 text-center font-mono text-[0.65rem] uppercase tracking-[0.1em] text-danger">
              Reversal · {tName} leads every subgroup yet trails {cName} overall
            </p>
          )}
          {/* caliper strip: you · unweighted average · true pooled, with the
              pooled dot sliding from the average to the size-weighted truth */}
          <div className="relative mt-4 h-9">
            <div className="absolute left-0 right-0 top-4 h-px bg-card-border" />
            <div className={`absolute top-4 h-1 -translate-y-1/2 rounded ${within ? "bg-accent/40" : "bg-danger/40"}`}
              style={{ left: cx(Math.min(your, reveal.truth ?? 0)), width: `calc(${cx(Math.max(your, reveal.truth ?? 0))} - ${cx(Math.min(your, reveal.truth ?? 0))})` }} />
            {reveal.naive != null && (
              <div className="absolute top-4 -translate-x-1/2 -translate-y-1/2" style={{ left: cx(reveal.naive) }}>
                <span className="block h-2.5 w-px bg-muted/60" />
                <span className="mt-0.5 block whitespace-nowrap font-mono text-[0.5rem] text-muted/70">simple avg</span>
              </div>
            )}
            <div className={`absolute top-4 -translate-x-1/2 -translate-y-1/2 ${within ? "text-accent" : "text-danger"}`} style={{ left: cx(your) }}>
              <span className="block h-3 w-0.5 bg-current" />
              <span className="mt-0.5 block whitespace-nowrap font-mono text-[0.5rem]">you</span>
            </div>
            {/* the size-weighted truth: slides in from the simple-average position */}
            <div className="pool-slide absolute top-4 -translate-x-1/2 -translate-y-1/2 text-ink-strong"
              style={{ left: cx(reveal.truth ?? 0), ["--pool-from" as string]: cx(reveal.naive ?? 0), ["--pool-to" as string]: cx(reveal.truth ?? 0) } as CSSProperties}>
              <span className="block h-3 w-0.5 bg-current" />
              <span className="mt-0.5 block whitespace-nowrap font-mono text-[0.5rem]">weighted</span>
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-foreground">{reveal.explanation}</p>
          {postReveal}
        </div>
      )}
    </>
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

      <div className="mt-6"><CalibrationCard cal={standing.calibration} coverage={standing.coverage} /></div>

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

// ============================================================ Descent recap
// A run ends by banking (pot survives) or busting (pot lost). The reached depth
// and banked pot are the only score; personal best lives in localStorage per
// track — no server truth to fold, so nothing here can lie either.
function DescentRecap({ trackId, track, busted, pot, depth, onAgain, onHome }: {
  trackId: TrackId; track: Track; busted: boolean; pot: number; depth: number; onAgain: () => void; onHome: () => void;
}) {
  const finalPot = busted ? 0 : pot;
  const survived = busted ? depth - 1 : depth;
  // Read (and, if beaten, write) the personal best in a lazy initializer — this
  // recap only ever mounts client-side after a run, so localStorage is safe and
  // no effect is needed. Runs once per mounted recap.
  const [{ best, isBest }] = useState<{ best: number | null; isBest: boolean }>(() => {
    try {
      const key = `jc-descent-best-${trackId}`;
      const prev = Number(localStorage.getItem(key) ?? "0");
      if (finalPot > prev) {
        localStorage.setItem(key, String(finalPot));
        return { best: finalPot, isBest: finalPot > 0 };
      }
      return { best: prev, isBest: false };
    } catch {
      return { best: finalPot, isBest: false };
    }
  });
  return (
    <div className="rise mt-6">
      <div className="text-center">
        <p className="kicker text-muted">The Descent</p>
        <p className={`mt-3 font-mono text-sm font-semibold uppercase tracking-[0.14em] ${busted ? "text-danger" : "text-accent"}`}>{busted ? "Busted out" : "Banked"}</p>
        <p className="mt-3 font-mono text-[clamp(1.75rem,6vw,2.5rem)] font-semibold leading-none text-ink-strong tabular-nums">{finalPot}<span className="text-muted"> pts</span></p>
        <p className="mt-2 font-mono text-xs uppercase tracking-[0.14em] text-muted">{busted ? `fell at depth ${depth}` : `banked at depth ${depth}`} · {survived} call{survived === 1 ? "" : "s"} survived</p>
      </div>

      {isBest ? (
        <div className="mt-6 rounded-lg border border-accent/50 bg-accent/10 px-4 py-4 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-accent">New personal best</p>
          <p className="mt-1 text-sm text-ink-strong">Your deepest bank yet in this room — {finalPot} points.</p>
        </div>
      ) : best != null ? (
        <p className="mt-6 text-center font-mono text-[0.7rem] text-muted">your best in this room: {best} pts</p>
      ) : null}

      <p className="mx-auto mt-6 max-w-md text-center text-sm leading-relaxed text-muted">
        {busted
          ? "One miss took the pot — that's the wager. The calls still counted toward your record and calibration; only the streak was lost."
          : "You read the moment and cashed out. Every call still counted toward your record and calibration — the Descent just added stakes."}
      </p>

      <div className="mt-8 space-y-2.5">
        <button onClick={onAgain} className="w-full rounded-lg bg-danger px-5 py-4 text-center font-mono text-sm font-semibold uppercase tracking-[0.14em] text-background transition-transform hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger">↓ Descend again</button>
        <button onClick={onHome} className="w-full rounded-lg border border-card-border bg-card px-5 py-3 text-center font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ink-strong transition-colors hover:border-rule-strong">Back to {track.name}</button>
      </div>
    </div>
  );
}
