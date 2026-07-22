"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getOrCreateSessionId, getSessionId } from "@/lib/session-client";
import { HOUSE_VIEW_COUNT, type Segment } from "@/lib/client-constants";

// THE FORK IN THE LAMP — the landing tells the truth of what the app now is: one
// instrument that does two jobs. One masthead, one shared live heartbeat, one
// unifying question — then the deck splits into two lit lanes named by the
// OUTCOME you walk away with, not the mechanic: "I'm curious" (the study — find
// your taste, see where you diverge) and "I'm training" (the rooms — stake your
// confidence, close the gap). Both lanes are present on first paint so neither
// experience is buried; DATUM's "accent is earned" law is held by lighting only
// the study's CTA (it carries the live data), while the rooms lane keeps equal
// size and a full call to action in milled ink.
//
// Winner of the 4-firm home-page competition (docs/HOME-10X.md): Firm D "TWO
// JOBS", with the unifying-thesis graft from Firm B and the two-group surface
// index from Firm A.
//
// Blinding: craft-only throughout. No fidelity vocabulary, no hint the study
// hides an experiment; the study lane sells taste + divergence, never the
// manipulation. Only experiment-agnostic /api/crowd totals are read.

// The secondary surfaces, split by which experience they belong to — so the
// console below the fold reinforces the fork instead of flattening it.
const SURFACES: {
  n: string;
  label: string;
  href: string;
  benefit: string;
  mode: string;
  group: "study" | "rooms";
  live?: boolean;
}[] = [
  {
    n: "01",
    label: "Results",
    href: "/results",
    benefit: "See what the room values.",
    mode: "Live findings · Elo leaderboard",
    group: "study",
    live: true,
  },
  {
    n: "02",
    label: "Review",
    href: "/review",
    benefit: "See where you're contrarian.",
    mode: "Your last run vs the room & the desk",
    group: "study",
  },
  {
    n: "04",
    label: "The Desk's Calls",
    href: "/results#desk-calls",
    benefit: "Agree — or overrule the desk.",
    mode: `${HOUSE_VIEW_COUNT} preregistered calls on the record`,
    group: "study",
  },
  {
    n: "03",
    label: "The Training Rooms",
    href: "/train",
    benefit: "Sharpen your eye.",
    mode: "Statistics · economics · architecture · decisions · ML · storytelling",
    group: "rooms",
  },
  {
    n: "07",
    label: "Data Storytelling",
    href: "/drill",
    benefit: "Tell the data straight.",
    mode: "The original room — spot, fix, compose · levels & badges",
    group: "rooms",
  },
  {
    n: "06",
    label: "Methods",
    href: "/methods",
    benefit: "See how it holds up.",
    mode: "How the study works · pairing, intervals, inclusion",
    group: "study",
  },
];

export default function Landing() {
  const router = useRouter();
  const [segment, setSegment] = useState<Segment>("other");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [returning, setReturning] = useState<{ segment: Segment; voteCount: number } | null>(null);
  const [totals, setTotals] = useState<{ countedVotes: number; votingSessions: number } | null>(
    null
  );

  useEffect(() => {
    // The live readout: public totals (same numbers as /results). Loads for
    // EVERYONE — it's the first-timer's social proof, not gated on a session.
    fetch("/api/crowd")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.totals && setTotals(d.totals))
      .catch(() => {});

    // Returning visitor: offer to continue their study run, and honor their
    // prior seat silently (it feeds the /results divergence view). No chips to
    // pick — the segment rides along from last time.
    const id = getSessionId();
    if (!id) return;
    fetch(`/api/results?sessionId=${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && d.voteCount > 0) {
          setReturning({ segment: d.segment, voteCount: d.voteCount });
          setSegment(d.segment);
        }
      })
      .catch(() => {});
  }, []);

  // The study launcher — Lane A. Starts immediately with the current segment
  // (default "other", pre-set from a prior run for returners).
  async function start() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: getOrCreateSessionId(),
          segment,
          referrer: document.referrer || null,
          utmSource: new URLSearchParams(window.location.search).get("utm_source"),
        }),
      });
      if (!res.ok) throw new Error(`session failed (${res.status})`);
      router.push("/swipe");
    } catch {
      setError("Couldn't start a session. Please try again.");
      setPending(false);
    }
  }

  const live = totals && totals.countedVotes > 0;
  const studySurfaces = SURFACES.filter((s) => s.group === "study");
  const roomSurfaces = SURFACES.filter((s) => s.group === "rooms");

  return (
    <main className="flex-1 px-5 py-12 sm:px-8">
      <div className="mx-auto w-full max-w-2xl">
        {/* 1 · NAMEPLATE — hairline · wordmark · hairline, live status at the edge */}
        <div
          className="hero-line flex items-center gap-3"
          style={{ "--i": 0 } as React.CSSProperties}
        >
          <span className="h-px flex-1 bg-rule-strong/40" aria-hidden />
          <p className="masthead text-ink-strong">Judgment Call</p>
          <span className="h-px flex-1 bg-rule-strong/40" aria-hidden />
        </div>
        {live && totals.votingSessions > 0 && (
          <p
            className="hero-line mt-1.5 flex items-center justify-center gap-1.5 font-mono text-[11px] tracking-wide text-muted"
            style={{ "--i": 0 } as React.CSSProperties}
          >
            <span
              aria-hidden
              className="inline-block size-1.5 rounded-full bg-accent shadow-[var(--glow)]"
            />
            <span className="text-ink-strong">LIVE</span>
            <span>· {totals.votingSessions.toLocaleString()} in the room</span>
          </p>
        )}

        {/* 2 · THE DATUM BEAM — the reference plane both lanes hang from */}
        <div
          className="hero-line double-rule rule-draw mt-3"
          style={{ "--i": 0 } as React.CSSProperties}
          aria-hidden
        />

        {/* 3 · THE UNIFYING THESIS — one question, before the fork */}
        <div className="mt-6 text-center">
          <p
            className="hero-line kicker text-muted"
            style={{ "--i": 1 } as React.CSSProperties}
          >
            A live study · six training rooms
          </p>
          <h1
            className="hero-line mt-3 font-sans font-semibold text-ink-strong text-[clamp(2.25rem,6.4vw,3.875rem)] leading-[1.0] tracking-[-0.03em] text-balance"
            style={{ "--i": 2 } as React.CSSProperties}
          >
            How good is your judgment, really?
          </h1>
          <p
            className="hero-line mx-auto mt-5 max-w-xl font-sans text-lg leading-[1.55] text-muted"
            style={{ "--i": 3 } as React.CSSProperties}
          >
            The study reads where your taste diverges from the crowd. The rooms sharpen the calls
            you keep getting wrong. Pick a way in.
          </p>

          {/* The shared heartbeat — the study's live count, proof the whole thing runs */}
          {live ? (
            <div className="hero-line mt-6" style={{ "--i": 4 } as React.CSSProperties}>
              <span
                aria-hidden
                className="count block font-mono font-semibold leading-none text-accent tabular-nums text-[clamp(1.75rem,5vw,2.5rem)]"
                style={{ "--num": totals.countedVotes } as React.CSSProperties}
              />
              <span className="sr-only">
                {totals.countedVotes.toLocaleString()} calls logged in the study so far
              </span>
              <p className="mt-1 font-mono text-[0.7rem] text-muted">calls logged so far</p>
            </div>
          ) : (
            <p
              className="hero-line mt-6 font-mono text-[0.75rem] text-muted"
              style={{ "--i": 4 } as React.CSSProperties}
            >
              ≈90 seconds to your first result
            </p>
          )}
        </div>

        {/* 4 · THE FORK — two lit lanes, named by outcome. Curious first (it owns
             the returning path + the 90s hook); both fully present, both with a
             full CTA. Only the study glows — accent is earned by the live data. */}
        <div
          className="rise mt-9 grid grid-cols-1 gap-4 sm:grid-cols-2"
          style={{ "--i": 5 } as React.CSSProperties}
        >
          {/* LANE A — the study */}
          <section className="flex flex-col rounded-card border border-card-border bg-card p-5 shadow-[var(--shadow-card)]">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-accent">
              The study
            </p>
            <h2 className="mt-2 font-sans text-xl font-semibold leading-tight text-ink-strong tracking-[-0.01em] text-balance">
              Find out what your taste actually is.
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Same finding, told two ways, ten times over — then see exactly where your eye and the
              crowd&apos;s part ways.
            </p>
            <div className="mt-auto pt-5">
              <button
                onClick={start}
                disabled={pending}
                className="cta-glow w-full rounded-card bg-accent px-4 py-3.5 text-base font-semibold text-on-accent active:scale-[0.98] disabled:opacity-60"
              >
                {pending
                  ? "Starting…"
                  : returning
                    ? `Continue your run — ${returning.voteCount} calls so far`
                    : "Show me my taste →"}
              </button>
              <p className="mt-2 text-center font-mono text-[0.7rem] text-muted">
                {returning ? "Pick up where you left off" : "Ten calls · ~90s"}
              </p>
              {error && <p className="mt-2 text-center text-sm text-danger">{error}</p>}
            </div>
          </section>

          {/* LANE B — the training rooms (equal weight, full CTA, milled ink) */}
          <section className="flex flex-col rounded-card border border-card-border bg-card p-5 shadow-[var(--shadow-card)]">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted">
              The rooms
            </p>
            <h2 className="mt-2 font-sans text-xl font-semibold leading-tight text-ink-strong tracking-[-0.01em] text-balance">
              Get better at knowing when you&apos;re right.
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Six studios — statistics, economics, architecture, decision science, machine
              learning, data storytelling. Answer, stake how sure you are, and watch the gap between confidence
              and accuracy close.
            </p>
            <div className="mt-auto pt-5">
              <Link
                href="/train"
                className="block w-full rounded-card border border-rule-strong bg-card px-4 py-3.5 text-center text-base font-semibold text-ink-strong transition hover:-translate-y-px hover:shadow-[var(--shadow-lift)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.98]"
              >
                Enter the rooms →
              </Link>
              <p className="mt-2 text-center font-mono text-[0.7rem] text-muted">
                Six rooms · levels &amp; badges
              </p>
            </div>
          </section>
        </div>

        {/* 5 · THE CONSOLE — the other surfaces, grouped by lane so the deck
             reinforces the fork instead of flattening it */}
        <section className="mt-14">
          <SurfaceGroup title="Inside the study" surfaces={studySurfaces} />
          <div className="mt-8">
            <SurfaceGroup title="Inside the rooms" surfaces={roomSurfaces} />
          </div>
        </section>
      </div>
    </main>
  );
}

function SurfaceGroup({
  title,
  surfaces,
}: {
  title: string;
  surfaces: (typeof SURFACES)[number][];
}) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <p className="kicker text-muted">{title}</p>
        <span className="h-px flex-1 bg-card-border" aria-hidden />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {surfaces.map((s) => (
          <Link
            key={s.n}
            href={s.href}
            className="group rounded-card border border-card-border bg-card p-4 shadow-[var(--shadow-card)] transition hover:-translate-y-px hover:border-rule-strong hover:shadow-[var(--shadow-lift)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-muted tabular-nums transition group-hover:translate-x-0.5">
                {s.n}
              </span>
              <span className="font-sans font-semibold text-ink-strong">{s.label}</span>
              {s.live && (
                <span
                  aria-hidden
                  className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] text-accent"
                >
                  <span className="inline-block size-1.5 rounded-full bg-accent shadow-[var(--glow)]" />
                  LIVE
                </span>
              )}
            </div>
            <p className="mt-1.5 text-sm text-muted">{s.benefit}</p>
            <p className="mt-2 font-mono text-[0.6875rem] leading-relaxed text-muted">{s.mode}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
