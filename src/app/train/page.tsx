import type { Metadata } from "next";
import Link from "next/link";
import { TRACK_IDS, TRACKS } from "@/lib/train-tracks";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Training Rooms · Judgment Call",
  description:
    "How well-calibrated are you? Answer, stake how sure you are, and see whether your confidence matches your accuracy — across statistics, economics, data architecture, and spotting the overreach. ~2 min.",
};

// The Training Rooms hub — the doorway to all three skills studios. Each room is
// a separate world from the study; nothing here touches the vote.
export default function TrainHub() {
  return (
    <>
      <main className="mx-auto min-h-dvh w-full max-w-2xl px-5 py-10">
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-rule-strong/40" aria-hidden />
          <p className="masthead text-ink-strong">The Training Rooms</p>
          <span className="h-px flex-1 bg-rule-strong/40" aria-hidden />
        </div>
        <div className="double-rule mt-3" aria-hidden />

        <p className="mx-auto mt-6 max-w-lg text-center text-[0.95rem] leading-relaxed text-foreground">
          <span className="font-semibold text-ink-strong">How well-calibrated are you?</span> Being right
          matters less than knowing <em>when</em> you&apos;re right. Answer a scenario, stake how sure you
          are, and each room draws the gap between your confidence and your accuracy.
        </p>
        <p className="mx-auto mt-2 max-w-md text-center text-sm leading-relaxed text-muted">
          Every rating and badge is recomputed from your calls, never granted — your calibration can go
          down if your confidence outruns your accuracy.
        </p>

        <div className="mt-8 space-y-3">
          {TRACK_IDS.map((id) => {
            const t = TRACKS[id];
            return (
              <RoomCard
                key={id}
                href={`/train/${id}`}
                kicker={t.room}
                title={t.name}
                blurb={t.blurb}
              />
            );
          })}
          <RoomCard
            href="/drill"
            kicker="THE ORIGINAL ROOM"
            title="Spot the overreach"
            blurb="Catch the telling that outruns its data — the five overclaim moves and five craft flaws. Five modes, case files, a checkpoint exam."
          />
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/"
            className="font-mono text-xs text-muted underline-offset-4 hover:text-foreground hover:underline"
          >
            ← back to Judgment Call
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function RoomCard({ href, kicker, title, blurb }: { href: string; kicker: string; title: string; blurb: string }) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-card-border bg-card px-5 py-4 transition-colors hover:border-rule-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted">{kicker}</p>
      <p className="mt-1 text-lg font-semibold text-ink-strong">{title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{blurb}</p>
      <p className="mt-2 font-mono text-xs text-accent">Enter the room →</p>
    </Link>
  );
}
