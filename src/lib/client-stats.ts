// Client-safe statistics helpers. Deliberately dependency-free: client
// components must never import from lib/analytics (it drags repo/DB code and
// server-only vocabulary toward the bundle). Keep this file free of any
// attribute or fidelity language.

export type ClientInterval = { lo: number; hi: number };

/** Wilson 95% score interval — mirror of the server implementation. */
export function wilsonClient(wins: number, n: number, z = 1.96): ClientInterval | null {
  if (n === 0) return null;
  const p = wins / n;
  const d = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / d;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return { lo: Math.max(0, center - half), hi: Math.min(1, center + half) };
}
