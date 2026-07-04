import Link from "next/link";
import { notFound } from "next/navigation";
import { TastePoster, personaTitle } from "@/components/TastePoster";
import { judgeRank, levelFor } from "@/lib/progression";
import { computePersonalResults } from "@/lib/results";
import { getSessionByPublicSlug } from "@/lib/repo";

export const dynamic = "force-dynamic";

// Public taste profile — the shareable artifact. Shows the poster and
// nothing else about the session: personal results are craft-only by
// construction (fidelity votes never reach them), and individual votes
// are never listed.
export default async function ProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getSessionByPublicSlug(slug);
  if (!session) notFound();
  const results = await computePersonalResults(session.id);
  const calibrated =
    session.goldCount >= 3 && session.judgeScore !== null && session.judgeScore >= 0.8;

  return (
    <main className="flex-1 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-md">
        <TastePoster
          data={{
            segment: session.segment,
            calibrated,
            level: levelFor(session.xp),
            judgeRank: judgeRank(session.judgeAbility, session.goldCount),
            drillRating: session.drillCount > 0 ? Math.round(session.drillRating) : null,
            ...results,
          }}
        />
        <div className="print-hide mt-4">
          <Link
            href="/"
            className="block rounded-card bg-accent px-4 py-3 text-center font-mono text-sm font-semibold text-on-accent transition hover:opacity-90"
          >
            What&apos;s your insight taste? Cast ten calls →
          </Link>
          <p className="mt-2 text-center font-mono text-[10px] text-muted">
            Think you read data better? The calibration drills keep score.
          </p>
        </div>
      </div>
    </main>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getSessionByPublicSlug(slug);
  if (!session) return {};
  const results = await computePersonalResults(session.id);
  const title = personaTitle(results.preferences);
  return {
    title,
    description: `An insight-taste profile from ${results.voteCount} judgment calls. What's yours?`,
  };
}
