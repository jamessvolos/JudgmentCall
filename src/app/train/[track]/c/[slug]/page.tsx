import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionByPublicSlug, getQuizStanding } from "@/lib/repo";
import { getTrack, isTrackId } from "@/lib/train-tracks";
import { credentialView, type CredentialView } from "@/lib/credential";

export const dynamic = "force-dynamic";

// The Calibration Credential — the shareable, ledger-derived proof for one
// Training Room track. Read-only twin of the dashboard's calibration card:
// score, reliability curve, level, and the honesty badges. Craft-only by
// construction — it reads calibration folds, never the study.
export default async function CredentialPage({ params }: { params: Promise<{ track: string; slug: string }> }) {
  const { track, slug } = await params;
  if (!isTrackId(track)) notFound();
  const t = getTrack(track)!;
  const session = await getSessionByPublicSlug(slug);
  if (!session) notFound();
  const standing = await getQuizStanding(session.id, track);
  if (!standing || standing.count === 0) notFound();
  const v = credentialView(standing, t);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg px-5 py-10">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-rule-strong/40" aria-hidden />
        <p className="masthead text-ink-strong">Judgment Call</p>
        <span className="h-px flex-1 bg-rule-strong/40" aria-hidden />
      </div>
      <div className="double-rule mt-3" aria-hidden />

      <div className="rise mt-8 rounded-lg border border-card-border bg-card px-5 py-6">
        <div className="flex items-baseline justify-between">
          <p className="kicker text-muted">Calibration Credential</p>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted/70">{v.room}</p>
        </div>

        {/* headline score */}
        <div className="mt-6 text-center">
          {v.score != null ? (
            <>
              <span className="block font-mono text-[clamp(3rem,12vw,4.5rem)] font-semibold leading-none text-accent tabular-nums">
                {v.score}<span className="text-2xl text-muted">/100</span>
              </span>
              <p className="mt-2 font-mono text-xs uppercase tracking-[0.16em] text-ink-strong">Calibration score</p>
            </>
          ) : (
            <>
              <span className="block font-mono text-[clamp(2.25rem,9vw,3.25rem)] font-semibold leading-none text-muted tabular-nums">
                {v.provisional}<span className="text-xl text-muted/70">/30</span>
              </span>
              <p className="mt-2 font-mono text-xs uppercase tracking-[0.16em] text-muted">staked calls toward a score</p>
            </>
          )}
          <p className="mt-3 text-sm leading-relaxed text-foreground">{v.tendencyLine}</p>
        </div>

        <ReliabilityCurve points={v.points} />

        {/* stat line */}
        <div className="mt-5 grid grid-cols-3 gap-2 text-center font-mono">
          <Stat label="accuracy" value={`${v.accuracyPct}%`} />
          <Stat label="avg conviction" value={`${v.meanConfPct}%`} />
          <Stat label="staked" value={`${v.staked}`} />
        </div>

        {/* level */}
        <div className="mt-5 flex items-center justify-between rounded-md border border-card-border bg-background/40 px-4 py-3">
          <span className="font-mono text-xs uppercase tracking-[0.12em] text-ink-strong">Level {v.levelRoman} · {v.levelTitle}</span>
          <span className="font-mono text-xs tabular-nums text-accent">{v.rating}</span>
        </div>

        {/* honesty badges */}
        {v.badges.length > 0 && (
          <div className="mt-4">
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted/70">Honesty held</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {v.badges.map((b) => (
                <span key={b.code} className="rounded-md border border-accent/40 bg-accent/5 px-2.5 py-1 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-accent">
                  {b.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {v.coverageRate != null && (
          <p className="mt-4 border-t border-card-border pt-3 font-mono text-[0.65rem] text-muted">
            90% intervals caught the truth {Math.round(v.coverageRate * 100)}% of {v.coverageN} times.
          </p>
        )}
      </div>

      <div className="mt-6">
        <Link href={`/train/${track}`} className="cta-glow block rounded-lg bg-accent px-4 py-3 text-center font-mono text-sm font-semibold uppercase tracking-[0.14em] text-background">
          Measure your calibration →
        </Link>
        <p className="mt-2 text-center font-mono text-[0.7rem] text-muted/70">
          Answer, stake how sure you are, and see whether your confidence is honest. ~2 min.
        </p>
      </div>

      <div className="mt-10 text-center">
        <Link href="/train" className="font-mono text-xs text-muted underline-offset-4 hover:text-foreground hover:underline">
          ← the Training Rooms
        </Link>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-card-border bg-background/40 px-2 py-2">
      <span className="block text-sm font-semibold tabular-nums text-ink-strong">{value}</span>
      <span className="mt-0.5 block text-[0.55rem] uppercase tracking-[0.1em] text-muted">{label}</span>
    </div>
  );
}

// A compact reliability diagram: confidence (x, from the 25% floor) vs. how
// often you were right (y). The dashed diagonal is perfect calibration; dots
// below it are overconfidence. Points arrive normalized in [0,1].
function ReliabilityCurve({ points }: { points: CredentialView["points"] }) {
  const W = 300, H = 190, pad = 26;
  const px = (x: number) => pad + x * (W - 2 * pad);
  const py = (y: number) => H - pad - y * (H - 2 * pad);
  const sorted = [...points].sort((a, b) => a.x - b.x);
  return (
    <div className="mt-6 flex justify-center">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[320px]" role="img" aria-label="Reliability diagram: confidence versus accuracy">
        <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} className="stroke-card-border" strokeWidth={1} />
        <line x1={pad} y1={pad} x2={pad} y2={H - pad} className="stroke-card-border" strokeWidth={1} />
        <line x1={px(0)} y1={py(0.25)} x2={px(1)} y2={py(1)} className="stroke-rule-strong" strokeDasharray="3 3" strokeWidth={1} />
        {sorted.length > 1 && (
          <polyline points={sorted.map((p) => `${px(p.x)},${py(p.y)}`).join(" ")} className="fill-none stroke-accent" strokeWidth={1.5} />
        )}
        {sorted.map((p, i) => (
          <circle key={i} cx={px(p.x)} cy={py(p.y)} r={Math.min(7, 3 + p.weight)} className="fill-accent" />
        ))}
        <text x={pad} y={H - 8} className="fill-muted" style={{ fontSize: 8, fontFamily: "var(--font-mono)" }}>25%</text>
        <text x={W - pad - 14} y={H - 8} className="fill-muted" style={{ fontSize: 8, fontFamily: "var(--font-mono)" }}>99%</text>
        <text x={4} y={pad + 4} className="fill-muted" style={{ fontSize: 8, fontFamily: "var(--font-mono)" }}>100%</text>
        <text x={W / 2} y={H - 1} textAnchor="middle" className="fill-muted/70" style={{ fontSize: 7, fontFamily: "var(--font-mono)" }}>how sure you said →</text>
      </svg>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ track: string; slug: string }> }) {
  const { track, slug } = await params;
  if (!isTrackId(track)) return {};
  const t = getTrack(track)!;
  const session = await getSessionByPublicSlug(slug);
  if (!session) return {};
  const standing = await getQuizStanding(session.id, track);
  if (!standing || standing.count === 0) return {};
  const v = credentialView(standing, t);
  const headline = v.score != null ? `Calibration ${v.score}/100` : `Calibration forming (${v.provisional}/30)`;
  return {
    title: `${headline} · ${t.name}`,
    description: `A calibration credential from the ${t.name} Training Room — ${v.tendencyLine} How honest is your confidence?`,
  };
}
