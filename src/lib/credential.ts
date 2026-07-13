// The Calibration Credential — a ledger-derived, shareable proof for one
// Training Room track. Pure view-model over a QuizStanding: nothing here is
// stored, so nothing here can lie. Kept fidelity-neutral by construction (it
// reads only calibration / level / badge folds), so it never leaks study
// vocabulary off /drill.

import type { QuizStanding } from "@/lib/repo";
import type { Track } from "@/lib/train-tracks";

const AXMIN = 0.25; // chance on a 4-option call is 25% — the reliability x floor

export type CredentialView = {
  room: string; // "THE STATS ROOM"
  name: string; // "Statistics"
  count: number;
  rating: number;
  levelRoman: string;
  levelTitle: string;
  score: number | null; // 0..100, null until n≥30
  provisional: number; // calls staked toward the n≥30 threshold (== cal.n)
  tendency: "overconfident" | "underconfident" | "sharp" | "unrated";
  tendencyLine: string;
  accuracyPct: number; // 0..100
  meanConfPct: number; // 0..100
  staked: number; // conviction-carrying calls
  coverageRate: number | null; // 0..1, null under n<3
  coverageN: number;
  badges: { code: string; name: string }[]; // held calibration badges
  // reliability dots in a normalized [0,1]×[0,1] box (x = confidence, y up = accuracy)
  points: { x: number; y: number; weight: number }[];
};

const TENDENCY_LINE: Record<CredentialView["tendency"], string> = {
  overconfident: "Leans overconfident — sureness runs ahead of accuracy.",
  underconfident: "Leans underconfident — right more often than claimed.",
  sharp: "Sharp — confidence tracks accuracy.",
  unrated: "Calibration still forming — a few more staked calls to read it.",
};

/** Map a bin's mean confidence (0..1) to a normalized x in [0,1] from the 25% floor. */
export function relX(conf: number): number {
  return (Math.max(AXMIN, conf) - AXMIN) / (1 - AXMIN);
}

export function credentialView(standing: QuizStanding, track: Track): CredentialView {
  const cal = standing.calibration;
  const active = cal.bins.filter((b) => b.count > 0);
  return {
    room: track.room,
    name: track.name,
    count: standing.count,
    rating: standing.liveRating,
    levelRoman: standing.level.level.roman,
    levelTitle: standing.level.level.title,
    score: cal.score,
    provisional: cal.n,
    tendency: cal.tendency,
    tendencyLine: TENDENCY_LINE[cal.tendency],
    accuracyPct: Math.round(cal.accuracy * 100),
    meanConfPct: Math.round(cal.meanConf * 100),
    staked: cal.n,
    coverageRate: standing.coverage.n >= 3 ? standing.coverage.rate : null,
    coverageN: standing.coverage.n,
    badges: standing.badges
      .filter((b) => b.tier === "calibration" && b.earnedAt)
      .map((b) => ({ code: b.code, name: b.name })),
    points: active.map((b) => ({ x: relX(b.meanConf), y: b.accuracy, weight: b.count })),
  };
}
