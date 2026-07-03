"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSessionId } from "@/lib/session-client";
import { wilsonClient } from "@/lib/client-stats";

type ReviewCall = {
  yourText: string | null;
  otherText: string;
  decided: boolean;
  excluded: boolean;
  tag: string;
  crowd: { yourPickShare: number; n: number } | null;
};

type ReviewDto = {
  runSize: number;
  calls: ReviewCall[];
  accuracy: { matched: number; total: number } | null;
  divergence: {
    attributeLabel: string;
    valueLabel: string;
    you: number;
    segment: number;
    segmentN: number;
    lesson: string;
  } | null;
  learned: { valueALabel: string; valueBLabel: string; rateA: number; n: number }[];
  minN: number;
  progression: {
    xp: number;
    level: { level: number; title: string; at: number; nextAt: number | null };
    judgeRank: string | null;
    goldCount: number;
    drillRating: number | null;
  };
};

const pct = (x: number) => `${Math.round(x * 100)}%`;
const frame = (i: number, total: number) =>
  `${String(i + 1).padStart(2, "0")}/${String(total).padStart(2, "0")}`;

// The room caliper: same grammar as /results — ticked 0–100% scale, strong
// 50% null line, Wilson bracket, point at your pick's share of the room.
// Color is legitimate here because crowd data only attaches at n≥30.
function RoomCaliper({
  share,
  n,
  bracket = true,
  caption,
}: {
  share: number;
  n: number;
  bracket?: boolean;
  caption: string;
}) {
  const interval = bracket ? wilsonClient(Math.round(share * n), n) : null;
  return (
    <>
      <div className="relative mt-2.5 h-6" aria-hidden>
        <div className="absolute left-0 right-0 top-1/2 h-px bg-card-border" />
        {[0, 25, 75, 100].map((t) => (
          <div
            key={t}
            className="absolute top-1/2 h-1.5 w-px -translate-y-1/2 bg-card-border"
            style={{ left: `${t}%` }}
          />
        ))}
        <div className="absolute left-1/2 top-1/2 h-3.5 w-px -translate-y-1/2 bg-rule-strong" />
        {interval && (
          <div
            className="absolute top-1/2 h-2 -translate-y-1/2 border-x-2 border-t-2 border-accent"
            style={{
              left: pct(interval.lo),
              width: `${Math.max(1, Math.round((interval.hi - interval.lo) * 100))}%`,
            }}
          />
        )}
        <div
          className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
          style={{ left: pct(share) }}
        />
      </div>
      <p className="mt-1 font-mono text-[0.6875rem] text-muted tabular-nums">{caption}</p>
    </>
  );
}

// Graded verdicts are stamped, matching the drill room's idiom.
function VerdictStamp({ matched }: { matched: boolean }) {
  return (
    <span
      className={`shrink-0 -rotate-3 rounded-chip border-2 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-[0.18em] ${
        matched ? "border-accent text-accent" : "border-danger text-danger"
      }`}
    >
      {matched ? "MATCHED" : "MISSED"}
    </span>
  );
}

export default function ReviewPage() {
  const router = useRouter();
  const [data, setData] = useState<ReviewDto | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const id = getSessionId();
    if (!id) {
      router.replace("/");
      return;
    }
    fetch(`/api/review?sessionId=${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true));
  }, [router]);

  // Contact-sheet triage: keepers carry the information; collecting frames
  // are demoted; passes/exclusions collapse into one ledger.
  const keepers: { call: ReviewCall; i: number }[] = [];
  const collecting: { call: ReviewCall; i: number }[] = [];
  const ledger: { call: ReviewCall; i: number }[] = [];
  (data?.calls ?? []).forEach((call, i) => {
    if (call.tag === "PASSED" || call.tag === "EXCLUDED") ledger.push({ call, i });
    else if (call.tag === "STILL COLLECTING") collecting.push({ call, i });
    else keepers.push({ call, i });
  });

  const p = data?.progression;
  const levelProgress =
    p && p.level.nextAt !== null
      ? (p.xp - p.level.at) / (p.level.nextAt - p.level.at)
      : 1;
  // Calibration tally: matched squares first — per-call order isn't in the
  // DTO for golds, but run order among keepers preserves it.
  const goldCalls = keepers.filter(({ call }) => call.tag.startsWith("CALIBRATION"));

  return (
    <main className="flex-1 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-end justify-between pb-2">
          <p className="masthead text-ink-strong">Judgment Call</p>
          <p className="kicker text-muted">Run review</p>
        </div>
        <div className="double-rule" aria-hidden />

        {error && (
          <p className="mt-6 text-sm text-danger">
            Couldn&apos;t load your review.{" "}
            <Link href="/swipe" className="text-accent hover:underline">
              Back to voting →
            </Link>
          </p>
        )}
        {!data && !error && (
          <div aria-hidden className="mt-6 animate-pulse motion-reduce:animate-none space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-card bg-card-border/50 h-24" />
            ))}
          </div>
        )}

        {data && data.runSize === 0 && (
          <p className="mt-6 text-sm text-muted">
            No calls to review yet.{" "}
            <Link href="/swipe" className="font-semibold text-accent hover:underline">
              Cast your first ten →
            </Link>
          </p>
        )}

        {data && p && data.runSize > 0 && (
          <>
            <div className="rise" style={{ "--i": 0 } as React.CSSProperties}>
              <h1 className="mt-4 font-serif font-semibold text-ink-strong text-3xl tracking-tight text-balance">
                Your last {data.runSize === 1 ? "call" : `${data.runSize} calls`}, reviewed
              </h1>
              <p className="mt-2 text-sm text-muted">
                Taste, not test — craft calls have no right answer. Calibration checks are the
                exception: those pairs have a settled read.
              </p>
            </div>

            {/* The instrument bar: calibration tally + standing. */}
            <div
              className="rise mt-5 rounded-card border border-card-border bg-card grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0 divide-card-border"
              style={{ "--i": 1 } as React.CSSProperties}
            >
              <div className="px-4 py-3">
                <p className="kicker text-muted">Calibration</p>
                {data.accuracy ? (
                  <>
                    <div className="mt-1.5 flex items-center gap-3">
                      <p className="font-mono text-2xl font-semibold tabular-nums">
                        {data.accuracy.matched}/{data.accuracy.total}
                      </p>
                      <div className="flex gap-1.5" aria-hidden>
                        {goldCalls.map(({ call, i }) => (
                          <span
                            key={i}
                            className={`size-2.5 rounded-[2px] ${
                              call.tag === "CALIBRATION — MATCHED"
                                ? "bg-accent"
                                : "border border-danger"
                            }`}
                            style={
                              call.tag === "CALIBRATION — MATCHED"
                                ? undefined
                                : {
                                    background:
                                      "linear-gradient(to top right, transparent calc(50% - .5px), var(--danger) calc(50% - .5px) calc(50% + .5px), transparent calc(50% + .5px))",
                                  }
                            }
                          />
                        ))}
                      </div>
                    </div>
                    <p className="mt-1 font-mono text-[0.6875rem] text-muted">
                      settled reads matched{p.judgeRank && ` · ${p.judgeRank}`}
                    </p>
                  </>
                ) : (
                  <p className="mt-1.5 font-mono text-[0.6875rem] text-muted">
                    Fewer than 3 settled reads this run — no grade yet
                    {p.judgeRank && ` · ${p.judgeRank}`}.
                  </p>
                )}
              </div>
              {/* Standing stays ink on purpose: XP rewards volume and coverage,
                  never judgment — press blue is reserved for graded surfaces. */}
              <div className="px-4 py-3">
                <p className="kicker text-muted">Standing</p>
                <p className="mt-1 font-serif text-lg font-semibold text-ink-strong">
                  {p.level.title}
                </p>
                <div className="mt-1.5 h-[3px] rounded-[2px] bg-card-border overflow-hidden" aria-hidden>
                  <div
                    className="h-full bg-rule-strong"
                    style={{ width: `${Math.min(100, Math.round(levelProgress * 100))}%` }}
                  />
                </div>
                <p className="mt-1 font-mono text-[0.6875rem] text-muted tabular-nums">
                  {p.level.nextAt !== null
                    ? `${p.xp} XP · ${p.level.nextAt - p.xp} to next title`
                    : `${p.xp} XP · top of the masthead`}
                </p>
              </div>
            </div>
            <p
              className="rise mt-2 font-mono text-[0.6875rem] text-muted"
              style={{ "--i": 2 } as React.CSSProperties}
            >
              dot = your pick&apos;s share of the room · 50% line = split · hatched = still
              collecting · stamps are graded
            </p>

            {/* Keepers: the calls that carry information. */}
            <section className="mt-5 space-y-3">
              {keepers.map(({ call, i }, idx) => (
                <div
                  key={i}
                  className={`${idx < 3 ? "rise" : "card-reveal"} rounded-card border border-card-border bg-card p-4 ${
                    call.tag.startsWith("CALIBRATION")
                      ? `border-l-[3px] ${call.tag.endsWith("MATCHED") ? "border-l-accent" : "border-l-danger"}`
                      : ""
                  }`}
                  style={idx < 3 ? ({ "--i": 3 + idx } as React.CSSProperties) : undefined}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-xs text-muted tabular-nums">
                      {frame(i, data.runSize)}
                    </p>
                    {call.tag.startsWith("CALIBRATION") ? (
                      <VerdictStamp matched={call.tag.endsWith("MATCHED")} />
                    ) : (
                      <span className="rounded-chip border border-rule-strong px-1.5 py-px font-mono text-[10px] font-semibold tracking-[0.14em] text-ink-strong">
                        {call.tag}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 font-serif text-[1.0625rem] leading-relaxed text-ink-strong text-pretty">
                    {call.yourText}
                  </p>
                  <p className="mt-2 border-l-2 border-card-border pl-3 text-sm leading-relaxed text-muted text-pretty">
                    {call.otherText}
                  </p>
                  {call.crowd && (
                    <RoomCaliper
                      share={call.crowd.yourPickShare}
                      n={call.crowd.n}
                      bracket={!call.tag.startsWith("CALIBRATION")}
                      caption={`your pick · ${pct(call.crowd.yourPickShare)} of room · ${"n="}${call.crowd.n}`}
                    />
                  )}
                </div>
              ))}

              {/* Collecting: demoted frames — your telling only, uniform hatch.
                  Deliberately no per-card count: publishing progress only where
                  it exists would carve this state into distinguishable classes. */}
              {collecting.map(({ call, i }) => (
                <div key={i} className="card-reveal rounded-card border border-card-border bg-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-xs text-muted tabular-nums">
                      {frame(i, data.runSize)}
                    </p>
                    <span className="rounded-chip border border-card-border px-1.5 py-px font-mono text-[10px] font-semibold tracking-[0.14em] text-muted">
                      STILL COLLECTING
                    </span>
                  </div>
                  <p className="mt-2 font-serif text-[0.9375rem] leading-relaxed text-ink-strong line-clamp-2 text-pretty">
                    {call.yourText}
                  </p>
                  <div
                    className="mt-2.5 h-1.5 rounded-[2px]"
                    style={{
                      background:
                        "repeating-linear-gradient(-45deg, var(--card-border), var(--card-border) 3px, transparent 3px, transparent 7px)",
                    }}
                    aria-hidden
                  />
                </div>
              ))}

              {/* Not counted: one ledger, not cards. */}
              {ledger.length > 0 && (
                <div className="card-reveal rounded-card border border-card-border bg-card px-4 py-1 divide-y divide-card-border">
                  {ledger.map(({ call, i }) => (
                    <p key={i} className="py-2.5 font-mono text-xs text-muted tabular-nums">
                      {String(i + 1).padStart(2, "0")} ·{" "}
                      {call.tag === "PASSED"
                        ? "PASSED — logged, no read"
                        : "EXCLUDED — under 0.8s or a repeat"}
                    </p>
                  ))}
                </div>
              )}
            </section>

            {/* Divergence micro-lesson */}
            {data.divergence && (
              <section className="card-reveal mt-6 rounded-card border-l-[3px] border-rule-strong bg-wash px-4 py-3">
                <p className="kicker text-muted">Your sharpest divergence</p>
                <p className="mt-2 text-sm">
                  You pick <strong>{data.divergence.valueLabel}</strong>{" "}
                  <span className="font-mono text-xs tabular-nums">{pct(data.divergence.you)}</span>{" "}
                  of the time; your segment goes that way{" "}
                  <span className="font-mono text-xs tabular-nums whitespace-nowrap">
                    {pct(data.divergence.segment)} (n={data.divergence.segmentN})
                  </span>
                  .
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted text-pretty">
                  {data.divergence.lesson}
                </p>
              </section>
            )}

            {/* What the room has learned — same caliper grammar. */}
            {data.learned.length > 0 && (
              <section className="card-reveal mt-6">
                <h2 className="kicker text-muted">What the room has learned</h2>
                <div className="mt-2 rounded-card border border-card-border bg-card px-4 py-1">
                  {data.learned.map((l, i) => (
                    <div key={i} className="border-b border-card-border py-3 last:border-b-0">
                      <p className="text-sm">
                        <strong>{l.valueALabel}</strong> beats <strong>{l.valueBLabel}</strong>
                      </p>
                      <RoomCaliper
                        share={l.rateA}
                        n={l.n}
                        caption={`${pct(l.rateA)} · n=${l.n}`}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div className="card-reveal mt-6">
              <Link
                href="/swipe"
                className="block w-full rounded-card bg-accent px-4 py-3 text-center font-mono text-sm font-semibold text-on-accent transition hover:opacity-90"
              >
                Next run →
              </Link>
              <p className="mt-3 text-center font-mono text-xs">
                <Link href="/drill" className="text-accent hover:underline">
                  Train: spot the overclaim
                  {p.drillRating !== null && (
                    <span className="text-muted"> · rating {p.drillRating}</span>
                  )}
                </Link>
              </p>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
