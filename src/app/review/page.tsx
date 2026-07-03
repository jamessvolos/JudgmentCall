"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSessionId } from "@/lib/session-client";

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

// Tag → tone. Taste tags are neutral ink; calibration tags may carry accent
// (they're graded); "collecting" is muted.
function tagClass(tag: string): string {
  if (tag === "CALIBRATION — MATCHED") return "border-accent text-accent";
  if (tag === "CALIBRATION — MISSED") return "border-danger text-danger";
  if (tag === "STILL COLLECTING" || tag === "PASSED" || tag === "EXCLUDED")
    return "border-card-border text-muted";
  return "border-rule-strong text-ink-strong";
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
          <div aria-hidden className="mt-6 animate-pulse space-y-3">
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

        {data && data.runSize > 0 && (
          <>
            <h1 className="mt-4 font-serif font-semibold text-ink-strong text-3xl tracking-tight">
              Your last {data.runSize === 1 ? "call" : `${data.runSize} calls`}, reviewed
            </h1>
            <p className="mt-2 text-sm text-muted">
              Taste, not test: craft calls have no right answer — tags show where the room stands
              on contrasts that have cleared n≥{data.minN}. Calibration checks are the exception:
              those pairs have a settled read.
            </p>

            {/* Run header: accuracy (if enough golds) + progression strip */}
            <div className="mt-5 flex flex-wrap gap-3">
              {data.accuracy && (
                <div className="rounded-card border border-card-border bg-card px-4 py-3">
                  <p className="kicker text-muted">Calibration</p>
                  <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
                    {data.accuracy.matched}/{data.accuracy.total}
                  </p>
                  <p className="font-mono text-[10px] text-muted">settled reads matched</p>
                </div>
              )}
              <div className="rounded-card border border-card-border bg-card px-4 py-3">
                <p className="kicker text-muted">Standing</p>
                <p className="mt-1 font-serif text-lg font-semibold text-ink-strong">
                  {data.progression.level.title}
                </p>
                <p className="font-mono text-[10px] text-muted tabular-nums">
                  {data.progression.xp} XP
                  {data.progression.level.nextAt !== null &&
                    ` · ${data.progression.level.nextAt - data.progression.xp} to next`}
                  {data.progression.judgeRank && ` · ${data.progression.judgeRank}`}
                </p>
              </div>
            </div>

            {/* Call-by-call */}
            <section className="mt-6 space-y-3">
              {data.calls.map((call, i) => (
                <div key={i} className="rounded-card border border-card-border bg-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-xs text-muted tabular-nums">CALL {i + 1}</p>
                    <span
                      className={`rounded-chip border px-1.5 py-px font-mono text-[10px] font-semibold tracking-[0.14em] ${tagClass(call.tag)}`}
                    >
                      {call.tag}
                    </span>
                  </div>
                  {call.decided ? (
                    <>
                      <p className="mt-2 font-serif text-[1.0625rem] leading-relaxed text-ink-strong">
                        {call.yourText}
                      </p>
                      <p className="mt-2 border-l-2 border-card-border pl-3 text-sm leading-relaxed text-muted">
                        {call.otherText}
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-muted">
                      You passed on this pair — passes are logged but carry no read.
                    </p>
                  )}
                  {call.crowd && (
                    <p className="mt-2 font-mono text-xs text-muted tabular-nums">
                      Your pick wins {pct(call.crowd.yourPickShare)} of the room (n=
                      {call.crowd.n})
                    </p>
                  )}
                  {call.tag === "STILL COLLECTING" && (
                    <p className="mt-2 font-mono text-xs text-muted">
                      The room hasn&apos;t published on this contrast yet.
                    </p>
                  )}
                  {call.tag === "EXCLUDED" && (
                    <p className="mt-2 font-mono text-xs text-muted">
                      Under 0.8s or a repeat pair — logged, not counted toward the study.
                    </p>
                  )}
                </div>
              ))}
            </section>

            {/* Divergence micro-lesson */}
            {data.divergence && (
              <section className="mt-6 rounded-card border-l-[3px] border-rule-strong bg-wash px-4 py-3">
                <p className="kicker text-muted">Your sharpest divergence</p>
                <p className="mt-2 text-sm">
                  You pick <strong>{data.divergence.valueLabel}</strong>{" "}
                  <span className="font-mono text-xs tabular-nums">{pct(data.divergence.you)}</span>{" "}
                  of the time; your segment goes that way{" "}
                  <span className="font-mono text-xs tabular-nums">
                    {pct(data.divergence.segment)} (n={data.divergence.segmentN})
                  </span>
                  .
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{data.divergence.lesson}</p>
              </section>
            )}

            {/* What the room has learned */}
            {data.learned.length > 0 && (
              <section className="mt-6">
                <h2 className="kicker text-muted">What the room has learned</h2>
                <div className="mt-2 rounded-card border border-card-border bg-card px-4 py-1">
                  {data.learned.map((l, i) => (
                    <p
                      key={i}
                      className="border-b border-card-border py-3 text-sm last:border-b-0"
                    >
                      <strong>{l.valueALabel}</strong> beats <strong>{l.valueBLabel}</strong>{" "}
                      <span className="font-mono text-xs text-muted tabular-nums">
                        {pct(l.rateA)} (n={l.n})
                      </span>
                    </p>
                  ))}
                </div>
              </section>
            )}

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Link
                href="/swipe"
                className="flex-1 rounded-card bg-accent px-4 py-3 text-center font-mono text-sm font-semibold text-on-accent transition hover:opacity-90"
              >
                Next run →
              </Link>
              <Link
                href="/drill"
                className="flex-1 rounded-card border border-card-border px-4 py-3 text-center font-mono text-sm font-semibold transition hover:border-rule-strong"
              >
                Train: spot the overclaim
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
