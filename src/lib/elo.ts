// Standard Elo with K=32. Both variants start at 1200 (schema default).
// "Can't decide" votes never reach this module: they are logged with
// winnerId=null and cause no rating change (spec §9).

export const K = 32;

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/** Returns the new ratings after `winner` beats `loser`. */
export function eloUpdate(winner: number, loser: number): { winner: number; loser: number } {
  const expectedWinner = expectedScore(winner, loser);
  return {
    winner: winner + K * (1 - expectedWinner),
    loser: loser - K * (1 - expectedWinner),
  };
}
