import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTrack } from "@/lib/train-tracks";
import { TrackRoom } from "./TrackRoom";

// A Training Room track (statistics | architecture). A separate world from the
// study and from the overclaim drill: multiple-choice calls with instant
// feedback, a level ladder, and badges — all a pure fold over the learner's
// attempt rows. The server wrapper validates the slug and hands the client the
// track id; the registry (client-safe, pure) supplies all display copy.

export async function generateStaticParams() {
  return [{ track: "statistics" }, { track: "architecture" }];
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
