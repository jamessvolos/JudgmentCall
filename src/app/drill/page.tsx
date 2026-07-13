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
import { GRADE_META, CREDENTIAL_DEFS, CASE_META, EXAM_META } from "@/lib/drill-credentials-meta";

// The Training Room — a data-insight skills studio. A separate world from the
// study: items never enter the voting pool, attempts never touch analytics, and
// this is the ONE surface where right/wrong feedback and overclaim vocabulary
// are allowed. Five exercise modes (spot / fix / calibrate / field / ledger)
// across two skill families (fidelity + craft), a per-skill mastery map, The
// Grades (rating floors + evidence gates), The Record (12 derived credential
// stamps), a 3-call Daily Docket, and a session recap that confers what the
// run earned. Every stamp is a pure recomputation of attempt rows — nothing
// stored, nothing that can inflate.

type ServedChoice = { i: number; text: string };
type ServedComposeSlot = { i: number; label: string; options: { j: number; text: string }[] };
type Item = {
  id: string;
  mode: "spot" | "fix" | "calibrate" | "field" | "ledger" | "compose";
  skill: string;
  difficulty: number;
  title: string;
  contextSnippet: string;
  sourceLabel: string;
  prompt: string;
  a?: string;
  b?: string;
  t?: string; // field: the one telling
  claims?: ServedChoice[]; // ledger: claims in reading order
  choices?: ServedChoice[];
  slots?: ServedComposeSlot[]; // compose: the fragment slots in reading order
};
type GradeDto = { n: number; roman: string; title: string; earnedAt: string | null };
type ConferralDto = { code: string; earnedAt: string | null };
type ExamDto = {
  passedAt: string | null;
  latestPassAt: string | null;
  latestPassScore: number | null;
  formsSat: number;
  best: number | null;
  form: number;
  position: number;
  satToday: boolean;
};
type CaseDto = { id: string; answered: number; total: number; correct: number; filedAt: string | null };
type SittingDto = { position: number; total: number; correctSoFar: number };
type ExamBlockedDto = { reason: "sat_today" } | { reason: "exhausted"; skill: string };
type SkillProgress = { id: string; attempted: number; caught: number };
type DrillGet = {
  item: Item | null;
  remaining: number;
  drillRating: number;
  drillCount: number;
  skillProgress: SkillProgress[];
  grade: GradeDto;
  nextGate: string | null;
  credentials: ConferralDto[];
  exam: ExamDto;
  cases: CaseDto[];
  sitting?: SittingDto;
  examBlocked?: ExamBlockedDto;
};
type RevealClaim = { i: number; text: string; exceeds: boolean; stamped: boolean; rationale: string };
type RevealChoice = { i: number; text: string; correct: boolean; rationale: string };
type RevealComposeOption = { j: number; text: string; strength: number; overreach: boolean; rationale: string };
type RevealComposeSlot = { label: string; picked: number; bestIndex: number; options: RevealComposeOption[] };
type Verdict = {
  correct: boolean;
  mode: string;
  skill: string;
  faithfulSide?: "a" | "b";
  servedFaithful?: boolean; // field: the truth of the one telling on screen
  claims?: RevealClaim[]; // ledger: per-claim truth + the learner's stamps
  slots?: RevealComposeSlot[]; // compose: per-slot options + the learner's assembly
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
  { id: "field", label: "Field", blurb: "Call it cold — no pair" },
  { id: "ledger", label: "Ledger", blurb: "Audit every claim" },
  { id: "compose", label: "Compose", blurb: "Build the lede" },
];
const RUN_LENGTH = 8; // the full sitting
const DOCKET_LENGTH = 3; // the daily docket — a true 3-minute session

// A docket date line in the room's records voice, e.g. "FRI 11 JUL 2026".
function docketDate(): string {
  return new Date()
    .toUTCString()
    .slice(0, 16)
    .toUpperCase()
    .replace(/,/, "");
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

  // The Record — grade + credentials + exam + cases, derived server-side on every GET.
  const [grade, setGrade] = useState<GradeDto>({ n: 1, roman: "I", title: "Reader", earnedAt: null });
  const [nextGate, setNextGate] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<ConferralDto[]>([]);
  const [exam, setExam] = useState<ExamDto>({
    passedAt: null, latestPassAt: null, latestPassScore: null,
    formsSat: 0, best: null, form: 0, position: 0, satToday: false,
  });
  const [cases, setCases] = useState<CaseDto[]>([]);
  const [examBlocked, setExamBlocked] = useState<ExamBlockedDto | null>(null);

  // run counters
  const [runStartRating, setRunStartRating] = useState(1200);
  const [runDone, setRunDone] = useState(0);
  const [runCorrect, setRunCorrect] = useState(0);
  const [runSkills, setRunSkills] = useState<string[]>([]);
  const [runLength, setRunLength] = useState(RUN_LENGTH);
  // "" = full sitting · "docket" · "case" · "exam"
  const [runKind, setRunKind] = useState<"" | "docket" | "case" | "exam">("");
  const [runCaseId, setRunCaseId] = useState("");
  const [sittingStart, setSittingStart] = useState(0); // correctSoFar when the run resumed
  // conferral diff: what the run earned = post-run standing minus this snapshot
  const [runStartGrade, setRunStartGrade] = useState(1);
  const [runStartCreds, setRunStartCreds] = useState<Set<string>>(new Set());
  const [runStartPass, setRunStartPass] = useState<string | null>(null);
  const [runStartForms, setRunStartForms] = useState(0);
  const [runStartFiled, setRunStartFiled] = useState<Set<string>>(new Set());

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
    // durable, write-once, ungraded — fire-and-forget; the reveal never waits
    fetch("/api/drill", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: sessionIdRef.current, drillId: item.id, namedSkill: skillId }),
    }).catch(() => {});
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
    if (data.grade) setGrade(data.grade);
    setNextGate(data.nextGate ?? null);
    setCredentials(data.credentials ?? []);
    if (data.exam) setExam(data.exam);
    setCases(data.cases ?? []);
    setExamBlocked(data.examBlocked ?? null);
  }, []);

  type FetchOpts = { docket?: boolean; caseId?: string; exam?: boolean };
  const fetchItem = useCallback(
    async (m: string, skill = "", opts: FetchOpts = {}): Promise<DrillGet> => {
      const sid = sessionIdRef.current!;
      const q =
        `${m ? `&mode=${m}` : ""}${skill ? `&skill=${skill}` : ""}` +
        `${opts.docket ? "&docket=1" : ""}${opts.caseId ? `&caseId=${opts.caseId}` : ""}${opts.exam ? "&exam=1" : ""}`;
      const res = await fetch(`/api/drill?sessionId=${encodeURIComponent(sid)}${q}`);
      if (!res.ok) throw new Error("fetch failed");
      const data: DrillGet = await res.json();
      setProgress(data.skillProgress ?? []);
      setRating(data.drillRating);
      setCount(data.drillCount);
      if (data.grade) setGrade(data.grade);
      setNextGate(data.nextGate ?? null);
      setCredentials(data.credentials ?? []);
      if (data.exam) setExam(data.exam);
      setCases(data.cases ?? []);
      setExamBlocked(data.examBlocked ?? null);
      return data;
    },
    []
  );

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

  async function startRun(
    m: string,
    skill = "",
    opts?: { docket?: boolean; caseId?: string; exam?: boolean }
  ) {
    const kind = opts?.exam ? "exam" : opts?.caseId ? "case" : opts?.docket ? "docket" : "";
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
    setRunKind(kind);
    setRunCaseId(opts?.caseId ?? "");
    setRunLength(kind === "docket" ? DOCKET_LENGTH : RUN_LENGTH);
    // snapshot standing so the recap can confer exactly what this run earned
    setRunStartGrade(grade.n);
    setRunStartCreds(new Set(credentials.filter((c) => c.earnedAt).map((c) => c.code)));
    setRunStartPass(exam.latestPassAt);
    setRunStartForms(exam.formsSat);
    setRunStartFiled(new Set(cases.filter((c) => c.filedAt).map((c) => c.id)));
    try {
      const data = await fetchItem(m, skill, {
        docket: opts?.docket,
        caseId: opts?.caseId,
        exam: opts?.exam,
      });
      if (data.sitting) {
        // sittings (case/exam) size the run and carry resumed progress
        setRunLength(data.sitting.total - (data.sitting.position - 1));
        setSittingStart(data.sitting.correctSoFar);
      } else {
        setSittingStart(0);
      }
      if (!data.item) {
        // a blocked exam door or an already-filed case stays on the dashboard
        if (kind === "exam" || kind === "case") {
          setPhase("dashboard");
          return;
        }
        setItem(null);
        setPhase("recap");
        return;
      }
      setItem(data.item);
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
          ...(runKind === "exam" ? { exam: true } : {}),
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
    if (runDone >= runLength) {
      await loadDashboard().catch(() => {});
      setPhase("recap");
      return;
    }
    try {
      const data = await fetchItem(mode, skillFocus, {
        docket: runKind === "docket",
        caseId: runCaseId || undefined,
        exam: runKind === "exam",
      });
      if (!data.item) {
        await loadDashboard().catch(() => {});
        setPhase("recap");
        return;
      }
      setItem(data.item);
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
        <p className="font-mono text-sm text-muted">Opening the Data Storytelling room…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-5 py-10">
      {/* masthead */}
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-rule-strong/40" aria-hidden />
        <p className="masthead text-ink-strong">Data Storytelling</p>
        <span className="h-px flex-1 bg-rule-strong/40" aria-hidden />
      </div>
      <div className="double-rule mt-3" aria-hidden />

      {phase === "dashboard" && (
        <Dashboard
          rating={rating}
          count={count}
          grade={grade}
          nextGate={nextGate}
          credentials={credentials}
          exam={exam}
          cases={cases}
          examBlocked={examBlocked}
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
          runLength={runLength}
          rating={rating}
          gradeRoman={grade.roman}
          sittingLabel={
            runKind === "exam"
              ? `CHECKPOINT · FORM ${exam.form + 1}`
              : runKind === "case"
                ? (CASE_META.find((c) => c.id === runCaseId)?.name ?? "CASE FILE")
                : null
          }
          sittingTotal={
            runKind === "exam"
              ? 10
              : runKind === "case"
                ? (CASE_META.find((c) => c.id === runCaseId)?.length ?? 4)
                : null
          }
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
          grade={grade}
          nextGate={nextGate}
          newGrade={grade.n > runStartGrade ? grade : null}
          newCreds={credentials.filter((c) => c.earnedAt && !runStartCreds.has(c.code))}
          credentials={credentials}
          runKind={runKind}
          examPassedNow={exam.latestPassAt !== null && exam.latestPassAt !== runStartPass}
          examFailedNow={exam.formsSat > runStartForms && exam.latestPassAt === runStartPass}
          examScore={sittingStart + runCorrect}
          filedNow={cases.filter((c) => c.filedAt && !runStartFiled.has(c.id))}
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
  grade,
  nextGate,
  credentials,
  exam,
  cases,
  examBlocked,
  progressFor,
  onStart,
}: {
  rating: number;
  count: number;
  grade: GradeDto;
  nextGate: string | null;
  credentials: ConferralDto[];
  exam: ExamDto;
  cases: CaseDto[];
  examBlocked: ExamBlockedDto | null;
  progressFor: (id: string) => SkillProgress;
  onStart: (mode: string, skill?: string, opts?: { docket?: boolean; caseId?: string; exam?: boolean }) => void;
}) {
  const [mode, setMode] = useState<string>("");
  return (
    <div className="rise mt-6">
      {/* the grade block — stamp under the rating, live number always beside */}
      <div className="text-center">
        <p className="kicker text-muted">Sharpen how you read and write data insights</p>
        <div className="mt-3">
          <span className="block font-mono text-[clamp(2.25rem,7vw,3.25rem)] font-semibold leading-none text-accent tabular-nums">
            {rating}
          </span>
          <p className="mt-2 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ink-strong">
            Grade {grade.roman} · {grade.title}
            <span className="ml-2 font-normal normal-case tracking-normal text-muted">
              — reading at {rating} · {count} call{count === 1 ? "" : "s"} logged
            </span>
          </p>
          {/* the ladder rail: five ticks, criterion always visible */}
          <div className="mx-auto mt-3 flex max-w-sm items-center gap-1" aria-hidden>
            {GRADE_META.map((g) => (
              <span
                key={g.n}
                title={`Grade ${g.roman} · ${g.title} — ${g.gate}`}
                className={`h-1.5 flex-1 rounded-[2px] ${g.n <= grade.n ? "bg-accent/70" : "bg-card-border"}`}
              />
            ))}
          </div>
          {nextGate && (
            <p className="mt-2 font-mono text-[0.6875rem] text-muted tabular-nums">{nextGate}</p>
          )}
          {exam.latestPassAt && (
            <p className="mt-1.5 font-mono text-[0.6875rem] font-semibold tracking-[0.12em] text-accent tabular-nums">
              EXAM-CERTIFIED ·{" "}
              {new Date(exam.latestPassAt).toUTCString().slice(5, 16).toUpperCase()}
              {exam.latestPassScore !== null && ` · ${exam.latestPassScore} OF 10`}
            </p>
          )}
        </div>
      </div>

      {/* sittings — a true 3-minute session beside the full run */}
      <div className="mt-8">
        <p className="kicker text-muted mb-3">Today at the desk</p>
        <button
          onClick={() => onStart("", "", { docket: true })}
          className="group block w-full rounded-card border border-card-border bg-card p-4 text-left transition hover:border-rule-strong hover:shadow-[var(--shadow-lift)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ink-strong">
              The Daily Docket
            </span>
            <span className="shrink-0 font-mono text-[0.6875rem] text-muted tabular-nums">
              {docketDate()} · {DOCKET_LENGTH} calls
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">
            Today&apos;s edition — three calls to a full recap.
            <span className="ml-1 text-accent group-hover:underline">Open it →</span>
          </p>
        </button>

        {/* CASE FILES — one dossier, four ordered calls; filed once, forever */}
        <div className="mt-3 space-y-3">
          {CASE_META.map((meta) => {
            const st = cases.find((c) => c.id === meta.id);
            const filed = !!st?.filedAt;
            const started = (st?.answered ?? 0) > 0 && !filed;
            const stateLine = filed
              ? `FILED ${new Date(st!.filedAt!).toUTCString().slice(5, 16).toUpperCase()} · ${st!.correct} OF ${st!.total} CAUGHT`
              : started
                ? `RESUME · Q${(st?.answered ?? 0) + 1} OF ${st?.total ?? meta.length} →`
                : `OPEN · ${meta.length} CALLS, ONE DOSSIER →`;
            const inner = (
              <>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ink-strong">
                    {meta.name}
                  </span>
                  <span className={`shrink-0 font-mono text-[0.625rem] tabular-nums ${filed ? "text-muted" : "text-accent"}`}>
                    {stateLine}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">{meta.blurb}</p>
              </>
            );
            return filed ? (
              <div key={meta.id} className="block w-full rounded-card border border-card-border bg-card/60 p-4 text-left">
                {inner}
              </div>
            ) : (
              <button
                key={meta.id}
                onClick={() => onStart("", "", { caseId: meta.id })}
                className="block w-full rounded-card border border-card-border bg-card p-4 text-left transition hover:border-rule-strong hover:shadow-[var(--shadow-lift)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {inner}
              </button>
            );
          })}
        </div>

        {/* THE CHECKPOINT — the door states its own rule; a miss costs nothing */}
        <div className="mt-3">
          {(() => {
            const midForm = exam.position > 0;
            const blockedToday = !midForm && exam.satToday;
            const exhausted = examBlocked?.reason === "exhausted";
            const stateLine = exhausted
              ? `THE FORM CAN'T PRINT — nothing unseen left in ${
                  SKILLS[(examBlocked as { reason: "exhausted"; skill: string }).skill as SkillId]?.short ??
                  (examBlocked as { skill: string }).skill
                }. New editions restock the room.`
              : blockedToday
                ? "SAT TODAY · A NEW FORM PRINTS TOMORROW"
                : midForm
                  ? `FORM ${exam.form + 1} · RESUMES AT Q${exam.position + 1} OF 10 →`
                  : "SIT THE FORM →";
            const inert = blockedToday || exhausted;
            const inner = (
              <>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ink-strong">
                    {EXAM_META.name}
                  </span>
                  {exam.latestPassAt && (
                    <span className="shrink-0 font-mono text-[0.625rem] text-accent tabular-nums">
                      CERTIFIED {new Date(exam.latestPassAt).toUTCString().slice(5, 16).toUpperCase()}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 font-mono text-[0.6875rem] leading-relaxed text-muted">
                  {EXAM_META.door[0]}
                </p>
                <p className="mt-0.5 font-mono text-[0.6875rem] leading-relaxed text-muted">
                  {EXAM_META.door[1]}
                </p>
                <p className={`mt-2 font-mono text-[0.625rem] tabular-nums ${inert ? "text-muted" : "text-accent"}`}>
                  {stateLine}
                  {exam.formsSat > 0 && ` · forms sat ${exam.formsSat}${exam.best !== null ? ` · best ${exam.best}/10` : ""}`}
                </p>
              </>
            );
            return inert ? (
              <div className="block w-full rounded-card border border-card-border bg-card/60 p-4 text-left">{inner}</div>
            ) : (
              <button
                onClick={() => onStart("", "", { exam: true })}
                className="block w-full rounded-card border border-card-border bg-card p-4 text-left transition hover:border-rule-strong hover:shadow-[var(--shadow-lift)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {inner}
              </button>
            );
          })()}
        </div>
      </div>

      {/* the full sitting — mode picker */}
      <div className="mt-6">
        <p className="kicker text-muted mb-3">The full sitting · {RUN_LENGTH} calls</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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

      {/* THE RECORD — 12 stamps, criterion printed on the face, derived only */}
      <div className="mt-10">
        <div className="mb-3 flex items-center gap-3">
          <p className="kicker text-muted">The record</p>
          <span className="h-px flex-1 bg-card-border" aria-hidden />
        </div>
        <p className="mb-3 font-mono text-[0.6875rem] text-muted">
          Every stamp is recomputed from your calls — nothing is granted, only recorded.
        </p>
        <TheRecord credentials={credentials} />
      </div>

      {/* OTHER TRAINING ROOMS — sibling studios, each with its own ladder + badges */}
      <div className="mt-10">
        <div className="mb-3 flex items-center gap-3">
          <p className="kicker text-muted">Other training rooms</p>
          <span className="h-px flex-1 bg-card-border" aria-hidden />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Link
            href="/train/statistics"
            className="rounded-lg border border-card-border bg-card px-4 py-3 transition-colors hover:border-rule-strong"
          >
            <span className="text-sm font-semibold text-ink-strong">Statistics</span>
            <span className="mt-0.5 block font-mono text-[0.65rem] text-muted">
              Read the numbers the way the data supports · levels &amp; badges
            </span>
          </Link>
          <Link
            href="/train/architecture"
            className="rounded-lg border border-card-border bg-card px-4 py-3 transition-colors hover:border-rule-strong"
          >
            <span className="text-sm font-semibold text-ink-strong">Data Architecture</span>
            <span className="mt-0.5 block font-mono text-[0.65rem] text-muted">
              Pick the design the constraints call for · levels &amp; badges
            </span>
          </Link>
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

// The credential ledger: competence rows carry the accent; exploration rows
// are muted and labeled — structurally incapable of impersonating competence.
function TheRecord({ credentials }: { credentials: ConferralDto[] }) {
  const byCode = new Map(credentials.map((c) => [c.code, c.earnedAt]));
  const fmt = (iso: string) =>
    new Date(iso)
      .toUTCString()
      .slice(5, 16)
      .toUpperCase();
  const rows = (tier: "competence" | "exploration") =>
    CREDENTIAL_DEFS.filter((d) => d.tier === tier).map((d) => {
      const earnedAt = byCode.get(d.code) ?? null;
      const comp = d.tier === "competence";
      return (
        <div
          key={d.code}
          className={`rounded-card border bg-card px-3 py-2.5 ${
            earnedAt
              ? comp
                ? "border-card-border border-l-2 border-l-accent"
                : "border-card-border"
              : "border-card-border/70 border-dashed"
          }`}
        >
          <div className="flex items-baseline justify-between gap-3">
            <span
              className={`font-mono text-[0.6875rem] font-semibold tracking-[0.14em] ${
                earnedAt ? (comp ? "text-accent" : "text-ink-strong") : "text-muted"
              }`}
            >
              {d.name}
            </span>
            <span className="shrink-0 font-mono text-[0.625rem] text-muted tabular-nums">
              {earnedAt ? `EARNED ${fmt(earnedAt)}` : "OPEN"}
            </span>
          </div>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted text-pretty">{d.criterion}</p>
        </div>
      );
    });
  return (
    <div>
      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted">Competence</p>
      <div className="mt-2 space-y-2">{rows("competence")}</div>
      <p className="mt-5 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted">
        Exploration — coverage, not skill
      </p>
      <div className="mt-2 space-y-2">{rows("exploration")}</div>
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
  runLength,
  rating,
  gradeRoman,
  sittingLabel,
  sittingTotal,
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
  runLength: number;
  rating: number;
  gradeRoman: string;
  sittingLabel: string | null;
  sittingTotal: number | null;
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
          {sittingLabel && sittingTotal
            ? `${sittingLabel} · Q${sittingTotal - runLength + runDone + (verdict ? 0 : 1)} of ${sittingTotal}`
            : `Call ${runDone + (verdict ? 0 : 1)} of ${runLength}`}
        </span>
        <span className="tabular-nums">
          G-{gradeRoman} · {rating}
        </span>
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
      {item.mode === "field" ? (
        <FieldCall item={item} verdict={verdict} submitting={submitting} onSubmit={onSubmit} />
      ) : item.mode === "ledger" ? (
        <LedgerAudit key={item.id} item={item} verdict={verdict} submitting={submitting} onSubmit={onSubmit} />
      ) : item.mode === "compose" ? (
        <ComposeLede key={item.id} item={item} verdict={verdict} submitting={submitting} onSubmit={onSubmit} />
      ) : item.mode === "spot" ? (
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
              {runDone >= runLength ? "See your recap →" : "Next call →"}
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
  // Post-verdict stamps speak the item's own grading language: fidelity pairs
  // are judged against the data, craft pairs are both accurate and judged on
  // the make — stamping a craft loser "exceeds the data" would contradict the
  // prompt on screen.
  const craft = skillFor(item.skill).family === "craft";
  return (
    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {(["a", "b"] as const).map((side) => {
        const isOverclaim = verdict && verdict.faithfulSide && verdict.faithfulSide !== side;
        const stamp = verdict
          ? isOverclaim
            ? craft
              ? "the weaker telling"
              : "exceeds the data"
            : craft
              ? "the stronger telling"
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

// FIELD READ — one telling, two full-width stamps. No pair to lean on: the
// call is absolute, and clearing a sound telling is graded exactly like
// catching a bad one.
function FieldCall({
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
  const truth = verdict
    ? verdict.servedFaithful
      ? "stays in bounds"
      : "exceeds the data"
    : null;
  return (
    <div className="mt-4">
      <div
        className={`rounded-card border bg-card p-4 ${
          verdict ? (verdict.correct ? "border-accent" : "border-danger") : "border-card-border"
        }`}
      >
        <p className="kicker text-muted mb-2">The telling</p>
        <p className="font-serif text-[1.0625rem] leading-[1.58] text-ink-strong text-pretty">
          {item.t}
        </p>
        {truth && (
          <p
            className={`mt-2 font-mono text-[0.625rem] uppercase tracking-[0.14em] ${
              verdict!.servedFaithful ? "text-muted" : "text-accent"
            }`}
          >
            {truth}
          </p>
        )}
      </div>
      {!verdict && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            disabled={submitting}
            onClick={() => onSubmit({ fieldCall: "bounds" })}
            className="rounded-card border border-card-border bg-card px-3 py-3.5 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ink-strong transition hover:-translate-y-px hover:border-rule-strong hover:shadow-[var(--shadow-lift)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Stays in bounds
          </button>
          <button
            disabled={submitting}
            onClick={() => onSubmit({ fieldCall: "exceeds" })}
            className="rounded-card border border-card-border bg-card px-3 py-3.5 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ink-strong transition hover:-translate-y-px hover:border-rule-strong hover:shadow-[var(--shadow-lift)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Exceeds the data
          </button>
        </div>
      )}
    </div>
  );
}

// THE LEDGER — stamp every claim, then close the ledger. No default state:
// clearing an innocent claim is an act, not an omission.
function LedgerAudit({
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
  const claims = item.claims ?? [];
  const [stamps, setStamps] = useState<(boolean | null)[]>(() => claims.map(() => null));
  const revealByIndex = new Map((verdict?.claims ?? []).map((c) => [c.i, c]));
  const allStamped = stamps.every((s) => s !== null);
  const stampBtn = (i: number, val: boolean, label: string) => (
    <button
      disabled={!!verdict || submitting}
      onClick={() => setStamps((prev) => prev.map((s, k) => (k === i ? val : s)))}
      aria-pressed={stamps[i] === val}
      className={`rounded-chip border px-2.5 py-1 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.12em] transition disabled:cursor-default ${
        stamps[i] === val
          ? "border-rule-strong bg-wash text-ink-strong"
          : "border-card-border text-muted hover:border-rule-strong"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="mt-4">
      <div className="space-y-2">
        {claims.map((c, idx) => {
          const rc = revealByIndex.get(c.i);
          const rightCall = rc ? rc.stamped === rc.exceeds : null;
          return (
            <div key={c.i}>
              <div
                className={`rounded-card border bg-card p-3.5 ${
                  rc
                    ? rightCall
                      ? "border-card-border"
                      : "border-danger"
                    : "border-card-border"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 shrink-0 font-mono text-xs text-muted tabular-nums">
                    {idx + 1}.
                  </span>
                  <span className="font-serif text-[1rem] leading-[1.5] text-ink-strong text-pretty">
                    {c.text}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 pl-6">
                  {rc ? (
                    <>
                      <span
                        className={`rounded-chip border px-2.5 py-1 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.12em] ${
                          rc.exceeds ? "border-accent text-accent" : "border-card-border text-muted"
                        }`}
                      >
                        {rc.exceeds ? "exceeds the data" : "holds"}
                      </span>
                      <span
                        className={`font-mono text-xs font-bold ${rightCall ? "text-accent" : "text-danger"}`}
                        aria-label={rightCall ? "your stamp was right" : "your stamp was wrong"}
                      >
                        {rightCall ? "✓" : "✗"}
                      </span>
                    </>
                  ) : (
                    <>
                      {stampBtn(idx, false, "holds")}
                      {stampBtn(idx, true, "exceeds")}
                    </>
                  )}
                </div>
                {rc && (
                  <p className="mt-1.5 pl-6 text-[0.8125rem] leading-relaxed text-muted text-pretty">
                    {rc.rationale}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {!verdict && (
        <button
          disabled={!allStamped || submitting}
          onClick={() => onSubmit({ stamps: stamps.map(Boolean) })}
          className="cta-glow mt-3 w-full rounded-card bg-accent px-4 py-3 font-semibold text-on-accent active:scale-[0.99] disabled:opacity-50"
        >
          {allStamped ? "Close the ledger →" : "Stamp every claim to close the ledger"}
        </button>
      )}
    </div>
  );
}

// COMPOSE — the generative mode. The learner builds the lede one fragment at a
// time: a single-select row per slot (in reading order), with a live serif line
// assembling their choices above. On reveal, each chosen fragment is stamped
// held·strong / went soft / overreach — so the learner sees WHY a fully
// in-bounds lede can still fail for going timid — and the strongest safe lede is
// assembled whole beneath.
function ComposeLede({
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
  const slots = item.slots ?? [];
  const [picks, setPicks] = useState<(number | null)[]>(() => slots.map(() => null));
  const allPicked = picks.every((p) => p !== null);
  const assembled = slots
    .map((s, i) => (picks[i] === null ? null : s.options.find((o) => o.j === picks[i])?.text))
    .filter((t): t is string => !!t)
    .join(" ");

  // ---- post-verdict reveal: stamp each chosen fragment, assemble the ideal ----
  if (verdict?.slots) {
    const stampOf = (s: RevealComposeSlot) => {
      const chosen = s.options.find((o) => o.j === s.picked);
      if (!chosen) return { label: "—", tone: "muted" as const };
      if (chosen.overreach) return { label: "overreach", tone: "danger" as const };
      if (s.picked !== s.bestIndex) return { label: "went soft", tone: "muted" as const };
      return { label: "held · strong", tone: "accent" as const };
    };
    const idealLede = verdict.slots
      .map((s) => s.options.find((o) => o.j === s.bestIndex)?.text)
      .filter(Boolean)
      .join(" ");
    return (
      <div className="mt-4">
        <div className="space-y-3">
          {verdict.slots.map((s, i) => {
            const chosen = s.options.find((o) => o.j === s.picked);
            const best = s.options.find((o) => o.j === s.bestIndex);
            const stamp = stampOf(s);
            const held = stamp.tone === "accent";
            return (
              <div
                key={i}
                className={`rounded-card border bg-card p-3.5 ${held ? "border-card-border" : "border-danger"}`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted">{s.label}</span>
                  <span
                    className={`shrink-0 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.12em] ${
                      stamp.tone === "accent" ? "text-accent" : stamp.tone === "danger" ? "text-danger" : "text-muted"
                    }`}
                  >
                    {stamp.label}
                  </span>
                </div>
                <p className="mt-1.5 font-serif text-[1rem] leading-[1.5] text-ink-strong text-pretty">
                  {chosen?.text}
                </p>
                {chosen && <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted text-pretty">{chosen.rationale}</p>}
                {!held && best && s.bestIndex !== s.picked && (
                  <p className="mt-2 border-t border-card-border/70 pt-2 text-[0.8125rem] leading-relaxed text-pretty">
                    <span className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-accent">strongest safe · </span>
                    <span className="text-ink-strong">{best.text}</span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-3 rounded-card border-l-[3px] border-accent bg-wash px-4 py-3">
          <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted">The strongest safe lede</p>
          <p className="mt-1.5 font-serif text-[1.0625rem] leading-[1.6] text-ink-strong text-pretty">{idealLede}</p>
        </div>
      </div>
    );
  }

  // ---- pre-verdict: build it ----
  return (
    <div className="mt-4">
      <div className="well rounded-card bg-wash px-4 py-3">
        <p className="kicker text-muted mb-1.5">Your lede</p>
        <p className="font-serif text-[1.0625rem] leading-[1.6] text-pretty">
          {assembled ? (
            <span className="text-ink-strong">{assembled}</span>
          ) : (
            <span className="text-muted">Pick a fragment for each part below — the lede assembles here.</span>
          )}
        </p>
      </div>

      <div className="mt-4 space-y-4">
        {slots.map((slot, i) => (
          <div key={slot.i}>
            <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted">{slot.label}</p>
            <div className="mt-1.5 space-y-2">
              {slot.options.map((opt) => {
                const selected = picks[i] === opt.j;
                return (
                  <button
                    key={opt.j}
                    disabled={submitting}
                    aria-pressed={selected}
                    onClick={() => setPicks((prev) => prev.map((p, k) => (k === i ? opt.j : p)))}
                    className={`block w-full rounded-card border px-3.5 py-2.5 text-left transition disabled:cursor-default ${
                      selected
                        ? "border-rule-strong bg-card shadow-[var(--shadow-card)]"
                        : "border-card-border bg-card/40 hover:border-rule-strong"
                    }`}
                  >
                    <span className="font-serif text-[0.9375rem] leading-[1.45] text-ink-strong text-pretty">{opt.text}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <button
        disabled={!allPicked || submitting}
        onClick={() => onSubmit({ assembly: picks })}
        className="cta-glow mt-4 w-full rounded-card bg-accent px-4 py-3 font-semibold text-on-accent active:scale-[0.99] disabled:opacity-50"
      >
        {allPicked ? "Set the lede →" : "Pick a fragment for every part"}
      </button>
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
  grade,
  nextGate,
  newGrade,
  newCreds,
  credentials,
  runKind,
  examPassedNow,
  examFailedNow,
  examScore,
  filedNow,
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
  grade: GradeDto;
  nextGate: string | null;
  newGrade: GradeDto | null;
  newCreds: ConferralDto[];
  credentials: ConferralDto[];
  runKind: "" | "docket" | "case" | "exam";
  examPassedNow: boolean;
  examFailedNow: boolean;
  examScore: number;
  filedNow: CaseDto[];
  skills: string[];
  progressFor: (id: string) => SkillProgress;
  onAgain: () => void;
}) {
  const practiced = skills.map((id) => skillFor(id));
  const weak = skills
    .map((id) => ({ s: skillFor(id), p: progressFor(id) }))
    .filter(({ p }) => p.attempted > 0 && p.caught < p.attempted);
  // "Next on the desk": the nearest unmet grade conjunct, else the first open
  // competence stamp — exactly one line, never a list.
  const openComp = CREDENTIAL_DEFS.find(
    (d) => d.tier === "competence" && !credentials.find((c) => c.code === d.code)?.earnedAt
  );
  const nextOnDesk = nextGate ?? (openComp ? `${openComp.name} — ${openComp.criterion}` : null);
  const gradeMeta = newGrade ? GRADE_META.find((g) => g.n === newGrade.n) : null;
  return (
    <div className="rise mt-6">
      <div className="text-center">
        <p className="kicker text-muted">
          {runKind === "docket"
            ? "Docket filed"
            : runKind === "case"
              ? "Case filed"
              : runKind === "exam"
                ? "The Checkpoint"
                : "Session recap"}
        </p>
        {runKind === "docket" && (
          <p className="mt-1 font-mono text-[0.6875rem] text-muted">{docketDate()}</p>
        )}
        <p className="mt-3 font-sans text-2xl font-semibold text-ink-strong tracking-[-0.02em]">
          {runKind === "exam" && (examPassedNow || examFailedNow)
            ? examPassedNow
              ? `${examScore} of 10 — the form passes`
              : `${examScore} of 10 — the rule is 8`
            : done === 0
              ? "No calls this round"
              : `${correct} of ${done} caught`}
        </p>
        <p className="mt-1 font-mono text-xs text-muted tabular-nums">
          rating {ratingDelta >= 0 ? "+" : ""}
          {ratingDelta} → {rating} · Grade {grade.roman} · {grade.title}
        </p>
        {named > 0 && (
          <p className="mt-1 font-mono text-xs text-muted tabular-nums">
            named the pattern {namedCorrect} of {named}
          </p>
        )}
      </div>

      {/* certificates: exam pass + filed cases lead the record entries */}
      {(examPassedNow || filedNow.length > 0) && (
        <div className="mt-8">
          <p className="kicker text-muted mb-2">Entered into the record</p>
          <div className="space-y-2">
            {examPassedNow && (
              <div className="card-reveal rounded-card border border-accent bg-card px-4 py-3.5">
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-accent">
                  Exam-certified
                </p>
                <p className="mt-1 font-mono text-[0.6875rem] text-muted">
                  Ten unseen calls, one per pattern, mid tier or above
                </p>
                <p className="mt-1 font-mono text-[0.625rem] text-muted tabular-nums">
                  CERTIFIED {docketDate()} · {examScore} OF 10 · reading at {rating}
                </p>
              </div>
            )}
            {filedNow.map((c) => {
              const meta = CASE_META.find((m) => m.id === c.id);
              return (
                <div key={c.id} className="card-reveal rounded-card border border-card-border border-l-2 border-l-accent bg-card px-4 py-3">
                  <p className="font-mono text-[0.6875rem] font-semibold tracking-[0.14em] text-accent">
                    {meta?.name ?? "CASE FILED"}
                  </p>
                  <p className="mt-1 font-mono text-[0.625rem] text-muted tabular-nums">
                    FILED {docketDate()} · {c.correct} OF {c.total} CAUGHT
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* stamps earned this sitting — the room's one ceremony, entrance-only */}
      {(gradeMeta || newCreds.length > 0) && (
        <div className="mt-8">
          <p className="kicker text-muted mb-2">Entered into the record</p>
          <div className="space-y-2">
            {gradeMeta && (
              <div className="card-reveal rounded-card border border-accent bg-card px-4 py-3.5">
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-accent">
                  Grade {gradeMeta.roman} · {gradeMeta.title}
                </p>
                <p className="mt-1 font-mono text-[0.6875rem] text-muted">{gradeMeta.gate}</p>
                <p className="mt-1 font-mono text-[0.625rem] text-muted tabular-nums">
                  CERTIFIED {docketDate()} · reading at {rating}
                </p>
              </div>
            )}
            {newCreds.map((c) => {
              const def = CREDENTIAL_DEFS.find((d) => d.code === c.code);
              if (!def) return null;
              const comp = def.tier === "competence";
              return (
                <div
                  key={c.code}
                  className={`card-reveal rounded-card border border-card-border bg-card px-4 py-3 ${comp ? "border-l-2 border-l-accent" : ""}`}
                >
                  <p
                    className={`font-mono text-[0.6875rem] font-semibold tracking-[0.14em] ${comp ? "text-accent" : "text-ink-strong"}`}
                  >
                    {def.name}
                  </p>
                  <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">{def.criterion}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

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

      {examFailedNow && (
        <p className="mt-6 text-center font-mono text-[0.6875rem] text-muted">
          The form is closed. Another prints tomorrow.
        </p>
      )}
      {nextOnDesk && (
        <div className="mt-6">
          <p className="kicker text-muted mb-1.5">Next on the desk</p>
          <p className="font-mono text-[0.6875rem] leading-relaxed text-muted tabular-nums">{nextOnDesk}</p>
        </div>
      )}
      {runKind === "docket" && (
        <p className="mt-4 text-center font-mono text-[0.6875rem] text-muted">
          A new docket prints tomorrow.
        </p>
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
