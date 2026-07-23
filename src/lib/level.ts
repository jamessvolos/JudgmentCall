// THE LADDER — the seniority read on every graded call, across every room.
// After each answer the reveal reads the call at a rung — ENTRY · SENIOR ·
// PRINCIPAL — with a one-line why, and shows how the next rung would answer
// the same item. Every rule here is an exact, re-derivable function of the
// graded exchange (the same species of fact as `correct`, which is also a
// grade-time derivation stored on the attempt row). No vibes, no models, no
// stored number that can't be recomputed from what's on screen.
//
// Semantics (docs/LADDER-10X.md): ENTRY is the reflex — the answer the
// scenario was built to sell. SENIOR is right. PRINCIPAL is right the way
// principals are right: precision on numeric calls (half-tolerance — computed,
// not pattern-matched), committed conviction on subtle picks (the 85 chip is
// the room's own "confident" boundary, gated to difficulty >= 2 so a gimme
// can't be farmed), band-sharpness on estimates (width IS the conviction),
// and naming the move in the drill (the active-recall beat made load-bearing).
//
// Pure module: imported by the server grader (to store the rung) and by the
// clients (to render the why and the next-rung line). Never imports Prisma.

export type Rung = 0 | 1 | 2;
export const RUNG_LABELS = ["ENTRY", "SENIOR", "PRINCIPAL"] as const;
export type Read = { rung: Rung; why: string };

const ENTRY_TRAP = "That's the first-order answer the scenario was built to sell you.";
const ENTRY_CONFIDENT = "Committed — and to the reflex. Confident-wrong is the expensive kind.";
const ENTRY_MISS = "The reflex read. Senior answers start from the mechanism, not the headline.";

// ---- pick kinds: mcq · duel · bakeoff -------------------------------------
export function levelPick(correct: boolean, confidence: number | null, difficulty: number): Read {
  if (!correct) {
    return { rung: 0, why: (confidence ?? 0) >= 85 ? ENTRY_CONFIDENT : ENTRY_MISS };
  }
  if ((confidence ?? 0) >= 85 && difficulty >= 2) {
    return { rung: 2, why: "Right, committed, on a subtle call — the full signal." };
  }
  return {
    rung: 1,
    why:
      (confidence ?? 0) >= 85
        ? "Right and committed — but conviction on a gimme isn't the principal signal."
        : "Right, hedged. A principal commits to a call they can defend.",
  };
}

// ---- numeric-with-tolerance kinds: market · redline · pool · gap · flood --
export function levelNumeric(correct: boolean, naiveTrap: boolean, err: number, tol: number): Read {
  if (!correct) return { rung: 0, why: naiveTrap ? ENTRY_TRAP : ENTRY_MISS };
  if (err <= tol / 2) return { rung: 2, why: "Half-tolerance tight — computed, not pattern-matched." };
  return { rung: 1, why: "Inside tolerance — you got the number. Principals land it tight." };
}

// ---- payback: dex-graded, with the NEVER latch ----------------------------
export function levelPaybackFinite(correct: boolean, naiveTrap: boolean, dexErr: number, tolDex: number): Read {
  if (!correct) return { rung: 0, why: naiveTrap ? ENTRY_TRAP : ENTRY_MISS };
  if (dexErr <= tolDex / 2) return { rung: 2, why: "Half-tolerance tight in log-space — the algebra, not the anchor." };
  return { rung: 1, why: "Inside the dex band — you found the marginal saving. Principals land it tight." };
}
export function levelPaybackNever(saidNever: boolean, confidence: number | null, difficulty: number): Read {
  if (!saidNever) return { rung: 0, why: "It never pays — the premium eats the saving, and the dial had no right answer." };
  if ((confidence ?? 0) >= 85 && difficulty >= 2) {
    return { rung: 2, why: "Refused the frame and meant it — the sign judgment is the principal move." };
  }
  return { rung: 1, why: "Right call — it never pays. A principal latches NEVER and stakes it." };
}

// ---- estimate: the band is the conviction ---------------------------------
export function levelEstimate(correct: boolean, captured: boolean, yourBand: number, deskBand: number): Read {
  if (!correct) {
    return {
      rung: 0,
      why: captured
        ? "Captured — but with a barn-door band. An interval that can't miss says nothing."
        : "The truth escaped your band — width is a claim too.",
    };
  }
  if (deskBand > 0 && yourBand <= deskBand) {
    return { rung: 2, why: "Captured at desk sharpness — the band is the conviction." };
  }
  return { rung: 1, why: "Captured with a working band. The desk's band was tighter still." };
}

// ---- the drill room's six modes -------------------------------------------
export function levelDrill(correct: boolean, namedRight: boolean): Read {
  if (!correct) return { rung: 0, why: ENTRY_MISS };
  if (namedRight) return { rung: 2, why: "Caught it and named it — the pattern is yours now." };
  return { rung: 1, why: "Caught it — but couldn't name the move. Principals name it before the reveal does." };
}

// ---------------------------------------------------------------------------
// THE NEXT RUNG — how to scale the answer up, on THIS item. Two layers that
// don't rot: one authored template per kind (O(kinds), not O(items)) and a
// computed sensitivity line derived at render time from the same payload that
// graded the item — so it can never drift from the content.

export const KIND_TEMPLATES: Record<string, string> = {
  mcq: "Senior picks the supported claim; Principal can say what evidence would flip it — bound the alternative, don't just name it.",
  duel: "Senior picks the design the constraints call for; Principal names the constraint change that flips the winner.",
  bakeoff: "Senior picks the balanced key; Principal counts the shards a key actually buys under skew.",
  estimate: "Senior brackets the truth; Principal earns the band's width from the estimate's structure, not from comfort.",
  flood: "Senior finds the prevalence where the test breaks even; Principal knows what a second positive is worth.",
  market: "Senior computes the equilibrium; Principal names who eats the wedge — and when the split flips.",
  redline: "Senior finds the knee; Principal knows how fast it moves when the SLA tightens.",
  pool: "Senior weights the pool; Principal can say which subgroup's size is doing the reversing.",
  gap: "Senior prices the margin; Principal prices its fragility — how little probability it takes to flip.",
  payback: "Senior divides the bill by the marginal saving; Principal asks at what premium the answer becomes NEVER.",
};

const r1 = (x: number) => Math.round(x * 10) / 10;
const pct = (x: number) => Math.round(x * 100);

/**
 * The computed principal move for this item — a real number derived from the
 * reveal/item payload the learner is already looking at. Returns null when the
 * kind (or this item's variant) has no honest derivation; the template speaks.
 */
export function nextRungLine(
  kind: string,
  item: {
    payback?: { pLong: number; pShort: number; out: number; premium: number };
    redline?: { mu: number; slaMs: number; percentile: number };
    flood?: { sensitivity: number; specificity: number };
    estimate?: unknown;
  },
  reveal: {
    lever?: string;
    demand?: { a: number; b: number };
    supply?: { c: number; d: number };
    truth?: number;
    your?: { lo: number; hi: number };
    good?: { lo: number; hi: number };
    lineA?: { name: string; branches: { p: number; v: number }[] };
    lineB?: { name: string; branches: { p: number; v: number }[] };
    alsoFits?: string | null;
  }
): string | null {
  if (kind === "payback" && item.payback) {
    const p = item.payback;
    const flip = r1((p.pLong + p.out) / (p.pShort + p.out));
    return `The flip: at a serving premium of ${flip}× this finetune never pays — it runs at ${p.premium}×. The whole case lives in that gap.`;
  }
  if (kind === "market" && reveal.lever === "tax" && reveal.demand && reveal.supply) {
    const share = pct(reveal.supply.d / (reveal.demand.b + reveal.supply.d));
    return `The split: buyers eat ${share}% of this tax — set purely by relative slopes (d/(b+d)) — and it flips when supply gets steeper than demand.`;
  }
  if (kind === "redline" && item.redline) {
    const { mu, slaMs, percentile } = item.redline;
    const z = Math.log(1 / (1 - percentile / 100));
    const half = Math.max(0, (1 - z / (mu * (slaMs / 2000))) * 100);
    return `The stress test: halve the SLA to ${Math.round(slaMs / 2)}ms and the ceiling falls to ${r1(half)}% — headroom is one SLA revision from vanishing.`;
  }
  if (kind === "flood" && item.flood) {
    const r = ((100 - item.flood.specificity) / item.flood.sensitivity) ** 2;
    const p2 = (r / (1 + r)) * 100;
    return `The second opinion: even TWO independent positives stay a coin flip below ${r1(p2)}% prevalence — likelihoods square, they don't add.`;
  }
  if (kind === "estimate" && reveal.your && reveal.good) {
    const yours = reveal.your.hi - reveal.your.lo;
    const desk = reveal.good.hi - reveal.good.lo;
    if (desk > 0) {
      const k = r1(yours / desk);
      return `The sharpness ratio: your band ran ${k}× the desk's. Principal width is earned, not comfortable.`;
    }
  }
  if (kind === "gap" && reveal.lineA && reveal.lineB && typeof reveal.truth === "number") {
    const win = reveal.truth >= 0 ? reveal.lineA : reveal.lineB;
    const vs = win.branches.map((b) => b.v);
    const spread = Math.max(...vs) - Math.min(...vs);
    if (spread > 0) {
      const shift = Math.min(99, Math.max(1, pct(Math.abs(reveal.truth) / spread)));
      return `The fragility: a ~${shift}pp probability transfer across the winner's branches ties the lines. Margins this thin are forecasts, not verdicts.`;
    }
  }
  if (kind === "duel" && reveal.alsoFits) {
    return `The flip constraint: ${reveal.alsoFits}`;
  }
  return null;
}

/** The line printed when the learner is already at the top rung. */
export const AT_PRINCIPAL = "Carry the formula, not the number — the sensitivity is the part that transfers.";
