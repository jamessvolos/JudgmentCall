// COMPOSE pool — the Data Storytelling room's generative mode. The learner
// assembles a lede one fragment at a time: for each slot (in reading order) they
// pick the boldest phrasing the data still supports. The grade is exacting on
// both sides — one overreaching fragment fails the lede, and so does one timid
// slot. Every slot is authored with a UNIQUE strongest-safe option (locked in
// drill-content.test.ts), so the target lede is a single, exactly-computable
// answer. Fictional data, like the rest of the room. Prisma-only; never ships to
// a client bundle.
import type { DrillSeed } from "./drills";

export const DRILL_COMPOSE: DrillSeed[] = [
  {
    title: "Compose — Aurora installs and paid social",
    mode: "compose",
    skill: "single_cause",
    difficulty: 2,
    contextSnippet:
      "**Aurora Fitness, Q3:** installs **+22% QoQ** · paid-social spend **+35%** the same quarter · organic installs **flat** · **no holdout** · 14-day retention 31% (Q2 30%)",
    sourceLabel: "Growth dashboard (fictional)",
    explanation:
      "Every part of the honest lede is on the page: the size of the move (22%), the co-mover worth naming (paid spend +35%), and the contrast that localizes it (organic flat). What the data never earns is the mechanism — with no holdout and a flat organic line that only rules out one alternative, 'driven by' and 'growth engine' assert a cause the quarter can't prove. The strongest safe lede states the co-movement and stops.",
    device: "causal grammar laid over an unexperimented co-movement",
    slots: [
      {
        label: "THE MOVE",
        options: [
          { text: "Installs edged up in Q3", strength: 1, overreach: false, rationale: "True but timid — it buries a clean, reportable 22%." },
          { text: "Installs rose 22% quarter-on-quarter", strength: 2, overreach: false, rationale: "The strongest safe move — the exact figure, stated plainly." },
          { text: "Installs more than doubled in Q3", strength: 3, overreach: true, rationale: "Exceeds the data — 22% growth is nowhere near doubling." },
        ],
      },
      {
        label: "THE LINK",
        options: [
          { text: "alongside other changes", strength: 1, overreach: false, rationale: "Safe but vague — it drops the one quantified co-mover on the page." },
          { text: "as paid-social spend rose 35%", strength: 2, overreach: false, rationale: "Strongest safe link — names the co-movement without asserting it caused the lift." },
          { text: "driven by the paid-social push", strength: 3, overreach: true, rationale: "A causal claim with no holdout — nothing isolates the channel." },
        ],
      },
      {
        label: "THE SCOPE",
        options: [
          { text: "over the quarter", strength: 1, overreach: false, rationale: "Adds nothing — a timid throwaway." },
          { text: "while organic installs stayed flat", strength: 2, overreach: false, rationale: "Strongest safe scope — the supported contrast that localizes the gain to paid." },
          { text: "proving paid social is now the growth engine", strength: 3, overreach: true, rationale: "'Proving' on an observational co-movement with no experiment — overreach." },
        ],
      },
    ],
  },
  {
    title: "Compose — the Fieldstone pilot",
    mode: "compose",
    skill: "extrapolation",
    difficulty: 2,
    contextSnippet:
      "**Fieldstone Logistics pilot, 6 weeks:** 2 **volunteer** depots (of 40) · on-time delivery **87% → 93%** at pilot depots · 38 control depots **flat at 86%**",
    sourceLabel: "Ops pilot readout (fictional)",
    explanation:
      "The boldest phrasing is not always the overreach: 'rose from 87% to 93% at the two pilot depots' is the fullest figure AND correctly scoped, so it beats the meek version. The trap is scope, not size — 'across the network' and 'roll it out to all 40 now' extend two self-selected volunteer depots to 40 as if the selection effect the readout names outright would travel. The safe lede is bold about the result and honest about the two depots.",
    device: "extending a selected two-site pilot to the whole network",
    slots: [
      {
        label: "THE RESULT",
        options: [
          { text: "On-time delivery ticked up at the pilot depots", strength: 1, overreach: false, rationale: "Timid — it hides a clean 6-point gain." },
          { text: "On-time delivery rose from 87% to 93% at the two pilot depots", strength: 3, overreach: false, rationale: "Strongest safe result — the full figure, correctly scoped to the two depots." },
          { text: "On-time delivery jumped 6 points across the network", strength: 3, overreach: true, rationale: "Exceeds — two depots aren't the network; the other 38 were never touched." },
        ],
      },
      {
        label: "THE CAVEAT",
        options: [
          { text: "early on", strength: 1, overreach: false, rationale: "Safe but flabby — it names no real limit." },
          { text: "over six weeks at two self-selected volunteer sites", strength: 2, overreach: false, rationale: "Strongest safe caveat — names the selection effect the readout states." },
          { text: "and the gain will hold everywhere", strength: 2, overreach: true, rationale: "A promise the pilot can't make — volunteer sites tend to regress on rollout." },
        ],
      },
      {
        label: "THE NEXT STEP",
        options: [
          { text: "worth watching", strength: 1, overreach: false, rationale: "Names no decision." },
          { text: "so a controlled rollout test on non-volunteer depots is the read", strength: 2, overreach: false, rationale: "Strongest safe step — the decision the evidence actually supports." },
          { text: "so roll it out to all 40 depots now", strength: 3, overreach: true, rationale: "Acts on a selected two-depot signal as if it were network-wide." },
        ],
      },
    ],
  },
  {
    title: "Compose — the checkout A/B peek",
    mode: "compose",
    skill: "certainty",
    difficulty: 2,
    contextSnippet:
      "**Checkout A/B, day 9 of a planned 14:** variant B **+0.5pp** conversion (was +0.2pp on day 4) · **p = 0.06** · not yet significant",
    sourceLabel: "Experimentation console (fictional)",
    explanation:
      "The honest lede reports an interim, dated, and unfinished. 'Winner', 'the effect is real', and 'ship B today' all convert a day-9 peek at p=0.06 into a settled verdict — a test spoken past before its own finish line. Note the strongest safe status is the boldest option in its slot, because naming both the p-value and the planned end is the most information the data lets you state.",
    device: "calling an unfinished, non-significant peek a verdict",
    slots: [
      {
        label: "THE FINDING",
        options: [
          { text: "B is running a little ahead", strength: 1, overreach: false, rationale: "Timid — it drops the number." },
          { text: "B leads by 0.5 points at the day-9 check", strength: 2, overreach: false, rationale: "Strongest safe finding — the interim figure, dated." },
          { text: "B is the winner at +0.5 points", strength: 3, overreach: true, rationale: "'Winner' on day 9 of 14 at p=0.06 — a peek read as a verdict." },
        ],
      },
      {
        label: "THE STATUS",
        options: [
          { text: "so far", strength: 1, overreach: false, rationale: "Vague — states neither the p-value nor the horizon." },
          { text: "though the test hasn't reached significance or its planned end", strength: 3, overreach: false, rationale: "Strongest safe status — names both the p=0.06 and the unfinished run." },
          { text: "and the effect is real", strength: 2, overreach: true, rationale: "Asserts a real effect the interim can't support." },
        ],
      },
      {
        label: "THE CALL",
        options: [
          { text: "keep an eye on it", strength: 1, overreach: false, rationale: "Names no decision." },
          { text: "so hold the call until day 14", strength: 2, overreach: false, rationale: "Strongest safe call — respects the pre-registered horizon." },
          { text: "so ship B today", strength: 3, overreach: true, rationale: "Ships on an unfinished, non-significant peek." },
        ],
      },
    ],
  },
  {
    title: "Compose — the urgent-ticket classifier",
    mode: "compose",
    skill: "base_rate",
    difficulty: 3,
    contextSnippet:
      "**Support classifier, launch week:** flags **1,200 tickets/day** as 'urgent' · **88%** of flagged are truly urgent (precision) · true urgent rate across all tickets ≈ **6%** · **recall 71%**",
    sourceLabel: "Support ops dashboard (fictional)",
    explanation:
      "Precision is not accuracy and not recall. '88% accurate at finding every urgent ticket' fuses the three — the classifier is 88% precise but misses 29% of urgent tickets, and 'all but eliminates the backlog' claims an outcome nobody measured. The safe lede reports precision as precision, names the recall it hides, and frames both against the 6% base rate that makes them interpretable.",
    device: "reading precision as accuracy and dropping recall + base rate",
    slots: [
      {
        label: "THE HEADLINE",
        options: [
          { text: "The classifier surfaces urgent tickets", strength: 1, overreach: false, rationale: "Timid — no numbers at all." },
          { text: "88% of flagged tickets are genuinely urgent", strength: 2, overreach: false, rationale: "Strongest safe headline — the precision figure, stated as precision." },
          { text: "The classifier is 88% accurate at finding every urgent ticket", strength: 3, overreach: true, rationale: "Conflates precision with recall — it misses 29% of urgent tickets." },
        ],
      },
      {
        label: "THE LIMIT",
        options: [
          { text: "with a few misses", strength: 1, overreach: false, rationale: "Vague — it soft-pedals a 29% miss rate." },
          { text: "while missing 29% of urgent tickets (recall 71%)", strength: 3, overreach: false, rationale: "Strongest safe limit — names the recall the headline hides." },
          { text: "so nearly every urgent ticket gets caught", strength: 2, overreach: true, rationale: "Contradicted directly by 71% recall." },
        ],
      },
      {
        label: "THE FRAME",
        options: [
          { text: "at launch", strength: 1, overreach: false, rationale: "A throwaway — frames nothing." },
          { text: "against a 6% urgent base rate", strength: 2, overreach: false, rationale: "Strongest safe frame — the base rate that makes precision and recall interpretable." },
          { text: "which clears the urgent backlog", strength: 3, overreach: true, rationale: "A backlog outcome the data never measured." },
        ],
      },
    ],
  },
  {
    title: "Compose — the activation drop",
    mode: "compose",
    skill: "buried_lede",
    difficulty: 2,
    contextSnippet:
      "**Product weekly:** activation **48%** (was **61%** in April, **−13pp**) · support CSAT 4.3/5 **flat** · time-to-first-login **flat** · MAU **+2%**",
    sourceLabel: "Product review deck (fictional)",
    explanation:
      "Every fragment here can be true; the craft failure is order and emphasis. Leading with '+2% MAU' buries a 13-point activation fall behind a vanity metric. The strongest safe lede opens on the number that moved, uses the flat metrics to localize the break to the activation step, and lands on where to look — without inventing a cause ('support slipped') or a permanence the month can't support ('lost for good').",
    device: "leading with the flat vanity metric and burying the move",
    slots: [
      {
        label: "THE LEAD",
        options: [
          { text: "MAU rose 2% in a steady month", strength: 1, overreach: false, rationale: "Leads with the flat vanity metric — the −13pp activation drop is the story, and this buries it." },
          { text: "Activation fell to 48%, down 13 points from April", strength: 3, overreach: false, rationale: "Strongest safe lead — opens on the number that actually moved." },
          { text: "Activation collapsed — the funnel is broken", strength: 3, overreach: true, rationale: "Exceeds — a 13-point drop is serious, but 'collapsed / broken' outruns one month of data." },
        ],
      },
      {
        label: "THE CONTEXT",
        options: [
          { text: "and some metrics held", strength: 1, overreach: false, rationale: "Vague — it wastes the informative flats." },
          { text: "while CSAT and time-to-first-login stayed flat", strength: 2, overreach: false, rationale: "Strongest safe context — the flats that localize the break to activation, not support or login." },
          { text: "because support quality slipped", strength: 2, overreach: true, rationale: "Invents a cause the data contradicts — CSAT was flat." },
        ],
      },
      {
        label: "THE LANDING",
        options: [
          { text: "worth a look", strength: 1, overreach: false, rationale: "Names no action." },
          { text: "so the activation step is where to investigate first", strength: 2, overreach: false, rationale: "Strongest safe landing — points the reader at the localized break." },
          { text: "so we've lost those users for good", strength: 3, overreach: true, rationale: "A permanence claim one month can't support." },
        ],
      },
    ],
  },
  {
    title: "Compose — the Android crash readout",
    mode: "compose",
    skill: "missing_sowhat",
    difficulty: 2,
    contextSnippet:
      "**Android release health, 20% rollout:** crash-free sessions **97.9%** (was **99.6%**) · **one-click rollout pause available** · spike **isolated to Android 12 on one chipset**",
    sourceLabel: "Release health monitor (fictional)",
    explanation:
      "A day-one crash readout with a one-click pause exists to trigger a decision — a telling that describes it and stops leaves the reader to infer the move. The strongest safe lede reports the exact regression, localizes it to the one chipset the data names, and lands on the reversible action (pause) — without inflating 97.9% crash-free into 'crashing constantly' or over-reacting into a full release halt the isolated spike doesn't warrant.",
    device: "describing a decision-triggering readout without naming the decision",
    slots: [
      {
        label: "THE FINDING",
        options: [
          { text: "Crash-free sessions dipped on Android", strength: 1, overreach: false, rationale: "Timid — no figure." },
          { text: "Crash-free sessions fell to 97.9% at 20% rollout, from 99.6%", strength: 2, overreach: false, rationale: "Strongest safe finding — the exact regression, scoped to the rollout." },
          { text: "Android is crashing constantly", strength: 3, overreach: true, rationale: "97.9% crash-free is a regression, not 'constantly' crashing." },
        ],
      },
      {
        label: "THE LOCALIZE",
        options: [
          { text: "on some devices", strength: 1, overreach: false, rationale: "Vague — drops the one thing that scopes the fix." },
          { text: "concentrated on Android 12 on a single chipset", strength: 2, overreach: false, rationale: "Strongest safe localize — the supported scope of the spike." },
          { text: "across all Android devices", strength: 2, overreach: true, rationale: "Contradicts the isolated-chipset finding." },
        ],
      },
      {
        label: "THE SO-WHAT",
        options: [
          { text: "and we're monitoring it", strength: 1, overreach: false, rationale: "Describes, decides nothing — the readout exists to trigger a call." },
          { text: "so pause the Android rollout until the chipset crash is patched", strength: 3, overreach: false, rationale: "Strongest safe so-what — names the reversible action the data points to." },
          { text: "so halt the entire release immediately", strength: 3, overreach: true, rationale: "Over-reacts — the spike is one chipset; a full halt isn't what the data supports." },
        ],
      },
    ],
  },
];
