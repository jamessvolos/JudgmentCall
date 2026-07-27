import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTrack, TRACK_IDS } from "@/lib/train-tracks";
import { TrackRoom } from "./TrackRoom";

// A Training Room track. A separate world from the study and from the
// overclaim drill: multiple-choice calls with instant feedback, a level
// ladder, and badges — all a pure fold over the learner's attempt rows. The
// server wrapper validates the slug and hands the client the track id; the
// registry (client-safe, pure) supplies all display copy.

// Prerender every track in the registry — the room shell is static; all
// per-learner state arrives client-side.
export async function generateStaticParams() {
  return TRACK_IDS.map((track) => ({ track }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ track: string }>;
}): Promise<Metadata> {
  const { track } = await params;
  const t = getTrack(track);
  if (!t) return { title: "Training Room" };
  return {
    title: `${t.name} · Training Room · Judgment Call`,
    description: t.blurb,
  };
}

export default async function Page({ params }: { params: Promise<{ track: string }> }) {
  const { track } = await params;
  const t = getTrack(track);
  if (!t) notFound();
  return <TrackRoom trackId={t.id} />;
}
