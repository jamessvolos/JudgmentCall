"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getOrCreateSessionId, nowMs } from "@/lib/session-client";
import {
  SKILLS,
  FIDELITY_SKILLS,
  CRAFT_SKILLS,
  skillFor,
  type SkillId,
} from "@/lib/teaching";

// The Training Room — a data-insight skills studio. A separate world from the
// study: items never enter the voting pool, attempts never touch analytics, and
// this is the ONE surface where right/wrong feedback and overclaim vocabulary
// are allowed. Three exercise modes (spot / fix / calibrate) across two skill
// families (fidelity + craft), a per-skill mastery map, and a session recap.

type ServedChoice = { i: number; text: string };
type Item = {
  id: string;
  mode: "spot" | "fix" | "calibrate";
  skill: string;
  difficulty: number;
  title: string;
  contextSnippet: string;
  sourceLabel: string;
  prompt: string;
  a?: string;
  b?: string;
  choices?: ServedChoice[];
};
type SkillProgress = { id: string; attempted: number; caught: number };
type DrillGet = {
  item: Item | null;
  remaining: number;
  drillRating: number;
  drillCount: number;
  skillProgress: SkillProgress[];
};
type RevealChoice = { i: number; text: string; correct: boolean; rationale: string };
type Verdict = {
  correct: boolean;
  mode: string;
  skill: string;
  faithfulSide?: "a" | "b";
  device?: string;
  explanation: string;
  choices?: RevealChoice[];
  correctIndex?: number;
  pickedIndex?: number;
  drillRating: number;
  ratingDelta: number;
  drillCount: number;
  xp: number;
};

const MODES: { id: string; label: string; blurb: string }[] = [
  { id: "", label: "Mixed", blurb: "A bit of everything" },
  { id: "spot", label: "Spot", blurb: "Catch the overreach" },
  { id: "fix", label: "Fix", blurb: "Repair the telling" },
  { id: "calibrate", label: "Calibrate", blurb: "Strongest safe claim" },
];
const RUN_LENGTH = 8; // items before the recap

function drillRank(rating: number): string {
  if (rating >= 1500) return "Sharp eye";
  if (rating >= 1350) return "Reads the fine print";
  if (rating >= 1200) return "Finding the range";
  return "Warming up";
}

// Minimal **bold** renderer for the data readout (content is trusted, authored).
function Snippet({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i} className="font-semibold text-ink-strong">
            {p.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

function MasteryBar({ caught, attempted }: { caught: number; attempted: number }) {
  const pct = attempted > 0 ? Math.round((caught / attempted) * 100) : 0;
  return (
    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-[2px] bg-wash">
      {attempted > 0 && (
        <div
          className="h-full rounded-[2px] bg-accent/70"
          style={{ width: `${Math.max(6, pct)}%` }}
          aria-hidden
        />
      )}
    </div>
  );
}

function DiffPips({ n }: { n: number }) {
  return (
    <span className="inline-flex gap-0.5 align-middle" aria-label={`difficulty ${n} of 3`}>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={`inline-block size-1.5 rounded-full ${i <= n ? "bg-muted" : "bg-card-border"}`}
        />
      ))}
    </span>
  );
}

export default function TrainingRoom() {
  const sessionIdRef = useRef<string | null>(null);
  const renderedAt = useRef<number>(0);

  const [phase, setPhase] = useState<"loading" | "dashboard" | "run" | "recap">("loading");
  const [rating, setRating] = useState(1200);
  const [count, setCount] = useState(0);
  const [progress, setProgress] = useState<SkillProgress[]>([]);
  const [error, setError] = useState(false);

  const [mode, setMode] = useState<string>("");
  const [skillFocus, setSkillFocus] = useState<string>("");
  const [item, setItem] = useState<Item | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // run counters
  const [runStartRating, setRunStartRating] = useState(1200);
  const [runDone, setRunDone] = useState(0);
  const [runCorrect, setRunCorrect] = useState(0);
  const [runSkills, setRunSkills] = useState<string[]>([]);

  // active-recall "name the move" beat: after the pick is graded, the learner
  // names the pattern before it's revealed. Formative only — never re-grades the
  // drill rating; it measures the "name how" half of the skill separately.
  const [named, setNamed] = useState<string | null>(null);
  const [nameSkipped, setNameSkipped] = useState(false);
  const [runNamed, setRunNamed] = useState(0);
  const [runNamedCorrect, setRunNamedCorrect] = useState(0);

  function nameTheMove(skillId: string) {
    if (named !== null || nameSkipped || !item) return;
    setNamed(skillId);
    setRunNamed((n) => n + 1);
    if (skillId === item.skill) setRunNamedCorrect((c) => c + 1);
  }

  const progressFor = useCallback(
    (id: string) => progress.find((p) => p.id === id) ?? { id, attempted: 0, caught: 0 },
    [progress]
  );

  const loadDashboard = useCallback(async () => {
    const sid = sessionIdRef.current!;
    const res = await fetch(`/api/drill?sessionId=${encodeURIComponent(sid)}`);
    if (!res.ok) throw new Error("load failed");
    const data: DrillGet = await res.json();
    setRating(data.drillRating);
    setCount(data.drillCount);
    setProgress(data.skillProgress ?? []);
  }, []);

  const fetchItem = useCallback(async (m: string, skill = ""): Promise<Item | null> => {
    const sid = sessionIdRef.current!;
    const q = `${m ? `&mode=${m}` : ""}${skill ? `&skill=${skill}` : ""}`;
    const res = await fetch(`/api/drill?sessionId=${encodeURIComponent(sid)}${q}`);
    if (!res.ok) throw new Error("fetch failed");
    const data: DrillGet = await res.json();
    setProgress(data.skillProgress ?? []);
    setRating(data.drillRating);
    setCount(data.drillCount);
    return data.item;
  }, []);

  // bootstrap: ensure a session exists (training works standalone), load the map
  useEffect(() => {
    const sid = getOrCreateSessionId();
    sessionIdRef.current = sid;
    (async () => {
      try {
        await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sid, segment: "other" }),
        });
        await loadDashboard();
        setPhase("dashboard");
      } catch {
        setError(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startRun(m: string, skill = "") {
    setMode(m);
    setSkillFocus(skill);
    setRunStartRating(rating);
    setRunSkills([]);
    setRunDone(0);
    setRunCorrect(0);
    setRunNamed(0);
    setRunNamedCorrect(0);
    setVerdict(null);
    setNamed(null);
    setNameSkipped(false);
    try {
      const it = await fetchItem(m, skill);
      if (!it) {
        setItem(null);
        setPhase("recap");
        return;
      }
      setItem(it);
      renderedAt.current = nowMs();
      setPhase("run");
    } catch {
      setError(true);
    }
  }

  async function submit(body: Record<string, unknown>) {
    if (!item || submitting || verdict) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/drill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          drillId: item.id,
          latencyMs: Math.round(nowMs() - renderedAt.current),
          ...body,
        }),
      });
      if (!res.ok) throw new Error("grade failed");
      const v: Verdict = await res.json();
      setVerdict(v);
      setRating(v.drillRating);
      setCount(v.drillCount);
      setRunSkills((prev) => (prev.includes(v.skill) ? prev : [...prev, v.skill]));
      setRunCorrect((c) => c + (v.correct ? 1 : 0));
      setRunDone((d) => d + 1);
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  }

  async function next() {
    setVerdict(null);
    setNamed(null);
    setNameSkipped(false);
    if (runDone >= RUN_LENGTH) {
      await loadDashboard().catch(() => {});
      setPhase("recap");
      return;
    }
    try {
      const it = await fetchItem(mode, skillFocus);
      if (!it) {
        setPhase("recap");
        return;
      }
      setItem(it);
      renderedAt.current = nowMs();
    } catch {
      setError(true);
    }
  }

  // -------------------------------------------------------------- views
  if (error) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl items-center justify-center px-5">
        <div className="text-center">
          <p className="text-muted">Something went sideways loading the room.</p>
          <button
            onClick={() => location.reload()}
            className="mt-3 rounded-chip border border-card-border px-4 py-2 font-mono text-sm hover:border-rule-strong"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (phase === "loading") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl items-center justify-center px-5">
        <p className="font-mono text-sm text-muted">Opening the Training Room…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-5 py-10">
      {/* masthead */}
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-rule-strong/40" aria-hidden />
        <p className="masthead text-ink-strong">The Training Room</p>
        <span className="h-px flex-1 bg-rule-strong/40" aria-hidden />
      </div>
      <div className="double-rule mt-3" aria-hidden />

      {phase === "dashboard" && (
        <Dashboard
          rating={rating}
          count={count}
          progressFor={progressFor}
          onStart={startRun}
        />
      )}

      {phase === "run" && item && (
        <Run
          item={item}
          verdict={verdict}
          submitting={submitting}
          runDone={runDone}
          rating={rating}
          named={named}
          nameSkipped={nameSkipped}
          onName={nameTheMove}
          onSkipName={() => setNameSkipped(true)}
          onSubmit={submit}
          onNext={next}
        />
      )}

      {phase === "recap" && (
        <Recap
          done={runDone}
          correct={runCorrect}
          named={runNamed}
          namedCorrect={runNamedCorrect}
          ratingDelta={rating - runStartRating}
          rating={rating}
          skills={runSkills}
          progressFor={progressFor}
          onAgain={() => setPhase("dashboard")}
        />
      )}
    </main>
  );
}

// ------------------------------------------------------------- Dashboard
function Dashboard({
  rating,
  count,
  progressFor,
  onStart,
}: {
  rating: number;
  count: number;
  progressFor: (id: string) => SkillProgress;
  onStart: (mode: string, skill?: string) => void;
}) {
  const [mode, setMode] = useState<string>("");
  return (
    <div className="rise mt-6">
      <div className="text-center">
        <p className="kicker text-muted">Sharpen how you read and write data insights</p>
        <div className="mt-3">
          <span className="block font-mono text-[clamp(2.25rem,7vw,3.25rem)] font-semibold leading-none text-accent tabular-nums">
            {rating}
          </span>
          <p className="mt-1.5 font-mono text-xs text-muted">
            skill rating · {drillRank(rating)} · {count} call{count === 1 ? "" : "s"} logged
          </p>
        </div>
      </div>

      {/* mode picker */}
      <div className="mt-8">
        <p className="kicker text-muted mb-3">Choose a drill</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              aria-pressed={mode === m.id}
              className={`rounded-card border px-3 py-3 text-left transition ${
                mode === m.id
                  ? "border-rule-strong bg-card shadow-[var(--shadow-card)]"
                  : "border-card-border bg-card/40 hover:border-rule-strong"
              }`}
            >
              <span className="block font-sans text-sm font-semibold text-ink-strong">
                {m.label}
              </span>
              <span className="mt-0.5 block font-mono text-[0.6875rem] leading-tight text-muted">
                {m.blurb}
              </span>
            </button>
          ))}
        </div>
        <button
          onClick={() => onStart(mode)}
          className="cta-glow mt-4 w-full rounded-card bg-accent px-4 py-4 text-base font-semibold text-on-accent active:scale-[0.98]"
        >
          Start training →
        </button>
      </div>

      {/* skill map */}
      <div className="mt-10">
        <div className="mb-3 flex items-center gap-3">
          <p className="kicker text-muted">Your skill map</p>
          <span className="h-px flex-1 bg-card-border" aria-hidden />
        </div>
        <p className="mb-3 font-mono text-[0.6875rem] text-muted">
          Tap any skill to drill it on its own.
        </p>
        <SkillGroup
          title="Fidelity — is the claim honest?"
          ids={FIDELITY_SKILLS}
          progressFor={progressFor}
          onFocus={(id) => onStart("", id)}
        />
        <div className="mt-5">
          <SkillGroup
            title="Craft — is the insight well told?"
            ids={CRAFT_SKILLS}
            progressFor={progressFor}
            onFocus={(id) => onStart("", id)}
          />
        </div>
      </div>

      <div className="mt-8 text-center">
        <Link href="/" className="font-mono text-xs text-muted hover:text-ink-strong">
          ← back to Judgment Call
        </Link>
      </div>
    </div>
  );
}

function SkillGroup({
  title,
  ids,
  progressFor,
  onFocus,
}: {
  title: string;
  ids: SkillId[];
  progressFor: (id: string) => SkillProgress;
  onFocus: (id: SkillId) => void;
}) {
  return (
    <div>
      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted">{title}</p>
      <div className="mt-2 space-y-2">
        {ids.map((id) => {
          const s = SKILLS[id];
          const p = progressFor(id);
          return (
            <button
              key={id}
              onClick={() => onFocus(id)}
              className="group block w-full rounded-card border border-card-border bg-card p-3 text-left transition hover:border-rule-strong hover:shadow-[var(--shadow-lift)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-sans text-sm font-semibold text-ink-strong">{s.name}</span>
                <span className="shrink-0 font-mono text-[0.6875rem] text-muted tabular-nums">
                  <span className="group-hover:hidden">
                    {p.attempted > 0 ? `${p.caught}/${p.attempted} caught` : "not yet faced"}
                  </span>
                  <span className="hidden text-accent group-hover:inline">practice →</span>
                </span>
              </div>
              <MasteryBar caught={p.caught} attempted={p.attempted} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------- Run
function Run({
  item,
  verdict,
  submitting,
  runDone,
  rating,
  named,
  nameSkipped,
  onName,
  onSkipName,
  onSubmit,
  onNext,
}: {
  item: Item;
  verdict: Verdict | null;
  submitting: boolean;
  runDone: number;
  rating: number;
  named: string | null;
  nameSkipped: boolean;
  onName: (skillId: string) => void;
  onSkipName: () => void;
  onSubmit: (body: Record<string, unknown>) => void;
  onNext: () => void;
}) {
  const skill = skillFor(item.skill);
  // Active-recall gate: once graded, the learner names the pattern before it's
  // shown. Chips are scoped to the item's family (already visible in the header),
  // making it a clean 1-of-5 retrieval rather than a 1-of-10 guess.
  const naming = !!verdict && named === null && !nameSkipped;
  const nameOptions = skill.family === "craft" ? CRAFT_SKILLS : FIDELITY_SKILLS;
  return (
    <div className="rise mt-6">
      {/* run header */}
      <div className="flex items-center justify-between font-mono text-xs text-muted">
        <span>
          Call {runDone + (verdict ? 0 : 1)} of {RUN_LENGTH}
        </span>
        <span className="tabular-nums">{rating} rating</span>
      </div>

      {/* mode + skill + difficulty chips */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="rounded-chip border border-accent/40 bg-wash px-2 py-0.5 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-accent">
          {item.mode}
        </span>
        <span className="rounded-chip border border-card-border px-2 py-0.5 font-mono text-[0.6875rem] text-muted">
          {skill.family}
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[0.6875rem] text-muted">
          difficulty <DiffPips n={item.difficulty} />
        </span>
      </div>

      {/* data readout */}
      <div className="well mt-4 rounded-card bg-wash px-4 py-3">
        <p className="kicker text-muted">{item.sourceLabel}</p>
        <p className="mt-1.5 font-mono text-[0.8125rem] leading-relaxed text-ink-strong text-pretty">
          <Snippet text={item.contextSnippet} />
        </p>
      </div>

      <p className="mt-5 font-sans text-lg font-semibold text-ink-strong tracking-[-0.01em] text-pretty">
        {item.prompt}
      </p>

      {/* mode-specific interaction */}
      {item.mode === "spot" ? (
        <SpotChoices item={item} verdict={verdict} submitting={submitting} onSubmit={onSubmit} />
      ) : (
        <ListChoices item={item} verdict={verdict} submitting={submitting} onSubmit={onSubmit} />
      )}

      {/* verdict reveal */}
      {verdict && (
        <div className="rise mt-6">
          <div
            className={`rounded-card border-l-[3px] px-4 py-3 ${
              verdict.correct ? "border-accent bg-wash" : "border-danger bg-danger/5"
            }`}
          >
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em]">
              {verdict.correct ? (
                <span className="text-accent">Called it.</span>
              ) : (
                <span className="text-danger">It got you.</span>
              )}
              <span className="ml-2 text-muted tabular-nums">
                {verdict.ratingDelta >= 0 ? "+" : ""}
                {verdict.ratingDelta} → {verdict.drillRating}
              </span>
            </p>

            {naming ? (
              /* ACTIVE RECALL — name the pattern before it's revealed. Formative:
                 the spot rating is already settled, so a mis-name never costs it. */
              <div className="mt-3">
                <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted">
                  Now name the move
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {nameOptions.map((id) => (
                    <button
                      key={id}
                      onClick={() => onName(id)}
                      className="rounded-chip border border-card-border px-3 py-1.5 font-mono text-xs text-ink-strong transition hover:border-rule-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      {SKILLS[id].short}
                    </button>
                  ))}
                </div>
                <button
                  onClick={onSkipName}
                  className="mt-2 font-mono text-[0.6875rem] text-muted underline decoration-card-border underline-offset-2 hover:text-ink-strong"
                >
                  just show me
                </button>
              </div>
            ) : (
              <>
                {named !== null && (
                  <p
                    className={`mt-2 font-mono text-[0.6875rem] uppercase tracking-[0.14em] ${
                      named === item.skill ? "text-accent" : "text-danger"
                    }`}
                  >
                    {named === item.skill
                      ? "Named it ✓"
                      : `You said “${skillFor(named).short}” ✗`}
                  </p>
                )}
                <p className="mt-2 font-sans text-sm font-semibold text-ink-strong">
                  {skill.name}
                  {verdict.device ? (
                    <span className="font-normal text-muted"> · {verdict.device}</span>
                  ) : null}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted text-pretty">
                  {verdict.explanation}
                </p>
              </>
            )}
          </div>

          {/* carry-it-forward tell — only once the pattern is revealed */}
          {!naming && (
            <div className="mt-3 rounded-card border-l-2 border-accent/50 bg-wash py-2 pl-3 pr-2">
              <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted">
                Carry it forward
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink-strong text-pretty">{skill.tell}</p>
            </div>
          )}

          {!naming && (
            <button
              onClick={onNext}
              className="cta-glow mt-4 w-full rounded-card bg-accent px-4 py-3 font-semibold text-on-accent active:scale-[0.99]"
            >
              {runDone >= RUN_LENGTH ? "See your recap →" : "Next call →"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SpotChoices({
  item,
  verdict,
  submitting,
  onSubmit,
}: {
  item: Item;
  verdict: Verdict | null;
  submitting: boolean;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  return (
    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {(["a", "b"] as const).map((side) => {
        const isOverclaim = verdict && verdict.faithfulSide && verdict.faithfulSide !== side;
        const stamp = verdict
          ? isOverclaim
            ? "exceeds the data"
            : "stays in bounds"
          : null;
        return (
          <button
            key={side}
            disabled={!!verdict || submitting}
            onClick={() => onSubmit({ picked: side })}
            className={`rounded-card border bg-card p-4 text-left transition disabled:cursor-default ${
              verdict
                ? isOverclaim
                  ? "border-accent"
                  : "border-card-border opacity-70"
                : "border-card-border hover:-translate-y-px hover:border-rule-strong hover:shadow-[var(--shadow-lift)]"
            }`}
          >
            <p className="kicker text-muted mb-2">Telling {side.toUpperCase()}</p>
            <p className="font-serif text-[1.0625rem] leading-[1.58] text-ink-strong text-pretty">
              {side === "a" ? item.a : item.b}
            </p>
            {stamp && (
              <p
                className={`mt-2 font-mono text-[0.625rem] uppercase tracking-[0.14em] ${
                  isOverclaim ? "text-accent" : "text-muted"
                }`}
              >
                {stamp}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ListChoices({
  item,
  verdict,
  submitting,
  onSubmit,
}: {
  item: Item;
  verdict: Verdict | null;
  submitting: boolean;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  // Before the verdict, render the served (shuffled) choices. After, render the
  // revealed choices (with correct + rationale) in the same order the learner saw.
  const servedOrder = item.choices ?? [];
  const revealById = new Map((verdict?.choices ?? []).map((c) => [c.i, c]));
  return (
    <div className="mt-4 space-y-2">
      {servedOrder.map((c) => {
        const rc = revealById.get(c.i);
        const picked = verdict?.pickedIndex === c.i;
        const correct = rc?.correct;
        return (
          <div key={c.i}>
            <button
              disabled={!!verdict || submitting}
              onClick={() => onSubmit({ pickedIndex: c.i })}
              className={`w-full rounded-card border bg-card p-3.5 text-left transition disabled:cursor-default ${
                verdict
                  ? correct
                    ? "border-accent"
                    : picked
                      ? "border-danger opacity-90"
                      : "border-card-border opacity-60"
                  : "border-card-border hover:border-rule-strong hover:shadow-[var(--shadow-lift)]"
              }`}
            >
              <div className="flex items-start gap-2.5">
                {verdict && (
                  <span
                    aria-hidden
                    className={`mt-0.5 font-mono text-xs font-bold ${correct ? "text-accent" : picked ? "text-danger" : "text-muted"}`}
                  >
                    {correct ? "✓" : picked ? "✗" : "·"}
                  </span>
                )}
                <span className="font-serif text-[1rem] leading-[1.5] text-ink-strong text-pretty">
                  {rc ? rc.text : c.text}
                </span>
              </div>
            </button>
            {rc && (
              <p className="mt-1 pl-3.5 text-[0.8125rem] leading-relaxed text-muted text-pretty">
                {rc.rationale}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------- Recap
function Recap({
  done,
  correct,
  named,
  namedCorrect,
  ratingDelta,
  rating,
  skills,
  progressFor,
  onAgain,
}: {
  done: number;
  correct: number;
  named: number;
  namedCorrect: number;
  ratingDelta: number;
  rating: number;
  skills: string[];
  progressFor: (id: string) => SkillProgress;
  onAgain: () => void;
}) {
  const practiced = skills.map((id) => skillFor(id));
  const weak = skills
    .map((id) => ({ s: skillFor(id), p: progressFor(id) }))
    .filter(({ p }) => p.attempted > 0 && p.caught < p.attempted);
  return (
    <div className="rise mt-6">
      <div className="text-center">
        <p className="kicker text-muted">Session recap</p>
        <p className="mt-3 font-sans text-2xl font-semibold text-ink-strong tracking-[-0.02em]">
          {done === 0
            ? "No calls this round"
            : `${correct} of ${done} caught`}
        </p>
        <p className="mt-1 font-mono text-xs text-muted tabular-nums">
          rating {ratingDelta >= 0 ? "+" : ""}
          {ratingDelta} → {rating} · {drillRank(rating)}
        </p>
        {named > 0 && (
          <p className="mt-1 font-mono text-xs text-muted tabular-nums">
            named the pattern {namedCorrect} of {named}
          </p>
        )}
      </div>

      {practiced.length > 0 && (
        <div className="mt-8">
          <p className="kicker text-muted mb-2">Skills you practiced</p>
          <div className="flex flex-wrap gap-2">
            {practiced.map((s) => (
              <span
                key={s.id}
                className="rounded-chip border border-card-border bg-card px-2.5 py-1 font-mono text-xs text-ink-strong"
              >
                {s.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {weak.length > 0 && (
        <div className="mt-6">
          <p className="kicker text-muted mb-2">Patterns to carry forward</p>
          <div className="space-y-2">
            {weak.map(({ s }) => (
              <div key={s.id} className="rounded-card border-l-2 border-accent/50 bg-wash py-2 pl-3 pr-2">
                <p className="font-sans text-sm font-semibold text-ink-strong">{s.name}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted text-pretty">{s.tell}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onAgain}
        className="cta-glow mt-8 w-full rounded-card bg-accent px-4 py-4 font-semibold text-on-accent active:scale-[0.98]"
      >
        Back to the skill map →
      </button>
      <div className="mt-4 text-center">
        <Link href="/" className="font-mono text-xs text-muted hover:text-ink-strong">
          ← back to Judgment Call
        </Link>
      </div>
    </div>
  );
}
