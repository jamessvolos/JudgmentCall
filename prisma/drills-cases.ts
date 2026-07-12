// Case-file dossiers — authored + adversarially reviewed sub-questions that
// share one readout and serve in caseSeq order as their own sitting. The
// review pass hunts one hazard unique to dossiers: forward-leaks, where an
// early question's reveal pre-teaches a later question's answer.
import type { DrillSeed } from "./drills";

export const CASE_SEEDS: DrillSeed[] = [
  // ────────────────────────────────────────────────────────────────────────
  // CASE FILE · NORTHGATE — a price change, a churn spike, and a memo that
  // wants a hero.
  // ────────────────────────────────────────────────────────────────────────
  {
    caseId: "northgate",
    caseSeq: 1,
    title: "Northgate: two tellings of the churn rise",
    mode: "spot",
    skill: "cause",
    difficulty: 2,
    contextSnippet:
      "**Northgate Software — Q2 dossier:** list price **+9%** effective 1 April · monthly logo churn **2.4% → 2.9%** · exit surveys (**31% response rate**): **38%** of responders cite price · net revenue retention **103%** (was 105%, still above 100%) · a competitor's discount campaign ran April–May · the draft memo leads with \"logo count grew for the **11th straight quarter**.\"",
    sourceLabel: "Northgate Q2 pricing dossier (fictional)",
    prompt:
      "Two tellings of the churn rise, built from the same dossier. Which one exceeds the data?",
    explanation:
      "The dossier shows a sequence — price up in April, churn up after — plus an exit survey that fewer than a third of leavers answered. That is an association with a partial signal, and the dossier itself prints the alternative: a competitor discount campaign running the same April–May window. \"Because of\" asserts a mechanism the readout can't isolate, \"point straight at price\" turns a partial survey signal into a confession, and the co-timed campaign never appears at all. The faithful telling keeps every number, scopes the survey share to the people who answered, and names the campaign as the driver nothing has ruled out.",
    faithfulText:
      "Monthly logo churn rose from 2.4% to 2.9% after April's 9% price increase, and among the 31% of leavers who answered the exit survey, 38% cited price. A competitor ran a discount campaign over the same April–May window — the timing fits the increase and the campaign equally, so the driver is still an open question.",
    overclaimedText:
      "Monthly logo churn rose from 2.4% to 2.9% because of April's 9% price increase — the exit surveys point straight at price. Net revenue retention slipped to 103% but held above 100%, so the damage is contained.",
    device: "causal language on an association with a co-timed confound in plain sight",
  },
  {
    caseId: "northgate",
    caseSeq: 2,
    title: "Northgate: the exit-survey ledger",
    mode: "ledger",
    skill: "base_rate",
    difficulty: 2,
    contextSnippet:
      "**Northgate Software — Q2 dossier:** list price **+9%** effective 1 April · monthly logo churn **2.4% → 2.9%** · exit surveys (**31% response rate**): **38%** of responders cite price · net revenue retention **103%** (was 105%, still above 100%) · a competitor's discount campaign ran April–May · the draft memo leads with \"logo count grew for the **11th straight quarter**.\"",
    sourceLabel: "Northgate Q2 pricing dossier (fictional)",
    prompt: "Four claims from the draft memo — stamp each one: does it hold, or does it exceed the data?",
    explanation:
      "The trap sits between two innocent rows. Claim 2 is the tempting flag — it carries the same 38% — but it is scoped exactly right: it speaks only for the leavers who answered. Claim 3 takes the identical number and swaps the denominator: 38% of the 31% who responded puts roughly 12% of all departing customers on record citing price, and nothing in the dossier says the silent 69% leave for the same reasons as the vocal minority. Claims 1 and 4 are straight reads of the page. One number, two claims, one overreach — the denominator is the entire difference.",
    device: "swapping survey responders for all departing customers",
    choices: [
      {
        text: "Monthly logo churn rose half a point in Q2, from 2.4% to 2.9%.",
        correct: false,
        rationale:
          "HOLDS. 2.9 − 2.4 = 0.5 — the headline movement, read straight off the dossier with no verdict attached.",
      },
      {
        text: "Among leavers who answered the exit survey, 38% cited price.",
        correct: false,
        rationale:
          "HOLDS. Scoped exactly right — 'who answered' pins the 38% to the responders it came from. A survey share reported inside its own denominator is discipline, not overreach.",
      },
      {
        text: "Roughly two in five departing customers are leaving over price.",
        correct: true,
        rationale:
          "EXCEEDS. Only 31% of leavers answered, so the 38% describes responders, not departures — about 12% of all leavers are actually on record citing price. 'Two in five departing customers' assumes the silent 69% answer like the vocal 31%, which is precisely what a low-response survey cannot show.",
      },
      {
        text: "Net revenue retention held above 100% in Q2, at 103%.",
        correct: false,
        rationale:
          "HOLDS. The dossier's own figure — down two points from 105%, still net-positive, reported as a number rather than a conclusion.",
      },
    ],
  },
  {
    caseId: "northgate",
    caseSeq: 3,
    title: "Northgate: the memo's opening line",
    mode: "fix",
    skill: "buried_lede",
    difficulty: 2,
    contextSnippet:
      "**Northgate Software — Q2 dossier:** list price **+9%** effective 1 April · monthly logo churn **2.4% → 2.9%** · exit surveys (**31% response rate**): **38%** of responders cite price · net revenue retention **103%** (was 105%, still above 100%) · a competitor's discount campaign ran April–May · the draft memo leads with \"logo count grew for the **11th straight quarter**.\"",
    sourceLabel: "Northgate Q2 pricing dossier (fictional)",
    prompt:
      "The draft memo opens on the 11-quarter logo streak and leaves the price change's scorecard for later. Pick the rewrite of the summary that leads with the story a reader needs — without hiding the churn rise.",
    explanation:
      "The lede is the judgment call. This dossier's real story is the price increase's first scorecard — retention held above 100% while churn rose half a point — and the draft parks that behind an 11-quarter streak that would have been true with or without the increase. The repair is ordering plus completeness: open on the retention-and-churn scorecard, keep both numbers, and let the streak ride as context. Note the failure modes on either side of the correct rewrite: leading with the streak buries the rise, and leading with the alarm buries the hold — a well-made summary refuses both directions of burial.",
    device: "leading a pricing memo with a vanity streak while the price change's scorecard waits below",
    choices: [
      {
        text: "First quarter under the 9% April increase: net revenue retention held above 100% at 103% (down two points), while monthly churn rose from 2.4% to 2.9%. Logo count still grew — an 11th straight quarter — but the retention-and-churn scorecard is the story of this one.",
        correct: true,
        rationale:
          "Leads with the question the memo exists to answer — what does the quarter after the increase look like? — and prints both sides of it: the retention hold and the churn rise. The streak stays, demoted to context. Same facts, right order.",
      },
      {
        text: "Logo count grew for the 11th straight quarter — through a 9% price increase, no less. Churn ticked up to 2.9% and net revenue retention came in at 103%; details on both follow below.",
        correct: false,
        rationale:
          "Better prose, same buried lede. The streak still opens the memo and the increase's actual scorecard is deferred to 'below' — the ordering is the flaw, and polish doesn't fix ordering.",
      },
      {
        text: "Churn is up half a point since the price change, from 2.4% to 2.9% a month, and 38% of surveyed leavers point at price. (Elsewhere in Q2: net revenue retention 103%, an 11th straight quarter of logo growth.)",
        correct: false,
        rationale:
          "The mirror image of the original flaw: it leads with the alarm and demotes the retention hold — the one number in the dossier still reading net-positive — to a parenthetical. A lede can bury good news as easily as bad.",
      },
      {
        text: "The 9% April increase is holding: net revenue retention stayed above 100% at 103%, and logo count grew for an 11th straight quarter.",
        correct: false,
        rationale:
          "The right lede with a hole in it — the churn rise from 2.4% to 2.9% has vanished, so the quarter reads as a free win. Leading well doesn't license dropping the number that cuts the other way.",
      },
    ],
  },
  {
    caseId: "northgate",
    caseSeq: 4,
    title: "Northgate: what Q3 can be promised",
    mode: "calibrate",
    skill: "extrapolation",
    difficulty: 3,
    contextSnippet:
      "**Northgate Software — Q2 dossier:** list price **+9%** effective 1 April · monthly logo churn **2.4% → 2.9%** · exit surveys (**31% response rate**): **38%** of responders cite price · net revenue retention **103%** (was 105%, still above 100%) · a competitor's discount campaign ran April–May · the draft memo leads with \"logo count grew for the **11th straight quarter**.\"",
    sourceLabel: "Northgate Q2 pricing dossier (fictional)",
    prompt: "What is the strongest claim this dossier supports about Q3?",
    explanation:
      "The record is genuinely mixed: retention held above 100%, churn rose half a point, a competitor's campaign ran in parallel, and there is exactly one quarter of all of it. The strongest safe claim carries the Q2 reading forward on a condition — net-positive if churn stabilizes — while conceding that stabilization is exactly what a single quarter cannot establish. Everything stronger commits one of three sins on one interval: reading it as a trend, asserting the unruled-out campaign as the cause, or compounding the projection into a second price increase.",
    device: "extending one quarter's mixed result into a forecast",
    choices: [
      {
        text: "The increase will keep paying for itself: retention held above 100% in Q2, and there's no reason to expect Q3 to differ.",
        correct: false,
        rationale:
          "Over the line. One interval is not a trend — churn moved half a point within the quarter, and whether it keeps climbing, levels off, or recovers is exactly what the dossier can't say yet.",
      },
      {
        text: "If churn stabilizes near 2.9%, retention should stay net-positive into Q3 — but one quarter of post-increase data can't establish that churn has stabilized, so the monthly series is the thing to watch.",
        correct: true,
        rationale:
          "Just right. Carries the dossier's Q2 reading forward as a conditional and names the one thing — stabilization — that a single quarter cannot yet show.",
      },
      {
        text: "Churn returns to 2.4% in Q3 now that the competitor's discount campaign has ended.",
        correct: false,
        rationale:
          "Over the line. The campaign is an unruled-out alternative, not an established cause — the dossier never separates its effect from the price increase's, so its end predicts nothing about where churn settles.",
      },
      {
        text: "Pricing power is proven — Q2 shows Northgate can take a further increase in Q3 without losing ground.",
        correct: false,
        rationale:
          "Over the line twice. It settles the first increase's verdict on one quarter, then stacks a second projection on top — and churn already rose half a point, so 'without losing ground' contradicts the ground on the page.",
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  // CASE FILE · HELIOS — three changes shipped at once. One is taking the
  // credit.
  // ────────────────────────────────────────────────────────────────────────
  {
    caseId: "helios",
    caseSeq: 1,
    title: "Helios: who gets credit for the drop",
    mode: "spot",
    skill: "single_cause",
    difficulty: 2,
    contextSnippet:
      "**Helios Grid analytics — pilot quarter:** a fault-prediction model, a revised maintenance schedule, and **two senior-technician hires** all landed the same month · unplanned outages **14 → 9/month** across the **12 volunteer substations** (of 80) · non-pilot substations **15 → 13/month** over the same period · the model flagged **61%** of faults at least 24h ahead (**n = 23 faults**) · ops lead's summary: \"the model is preventing roughly **five outages a month**.\"",
    sourceLabel: "Helios Grid pilot-quarter dossier (fictional)",
    prompt:
      "Two tellings of the pilot's outage drop, same dossier. Which one exceeds the data?",
    explanation:
      "Three changes landed at the pilot sites in the same month — the model, the schedule revision, the hires — so the 14-to-9 drop belongs to the bundle until something separates them. The overclaim hands it to the model alone and adopts the ops lead's 'five outages a month prevented' framing as if attribution were done; it even uses the 15-to-13 non-pilot decline as a foil, when that decline is evidence of network-wide drift the pilot sites may have gotten for free. The faithful telling reports the same drop, holds the bundle together, and puts the baseline's own movement on the page beside it.",
    faithfulText:
      "Unplanned outages at the 12 pilot substations fell from 14 to 9 a month — but the fault-prediction model landed the same month as a revised maintenance schedule and two senior-technician hires, and non-pilot substations drifted from 15 to 13 on their own over the same period. Until something separates the three changes and nets out that background drift, the model's own share of the drop is unknown.",
    overclaimedText:
      "The fault-prediction model cut unplanned outages at the pilot substations from 14 to 9 a month — five outages a month it's now preventing. Non-pilot substations barely moved over the same period, from 15 to 13.",
    device: "handing a bundled improvement to a single co-timed driver",
  },
  {
    caseId: "helios",
    caseSeq: 2,
    title: "Helios: the engineer's note",
    mode: "ledger",
    skill: "certainty",
    difficulty: 3,
    contextSnippet:
      "**Helios Grid analytics — pilot quarter:** a fault-prediction model, a revised maintenance schedule, and **two senior-technician hires** all landed the same month · unplanned outages **14 → 9/month** across the **12 volunteer substations** (of 80) · non-pilot substations **15 → 13/month** over the same period · the model flagged **61%** of faults at least 24h ahead (**n = 23 faults**) · ops lead's summary: \"the model is preventing roughly **five outages a month**.\"",
    sourceLabel: "Helios Grid pilot-quarter dossier (fictional)",
    prompt:
      "A field engineer filed four claims on the pilot. Stamp each one: does it hold, or does it exceed the data?",
    explanation:
      "All four hold — this is what a clean filing looks like, and stamping it clean under a dossier whose own summary line overreaches is the discipline being tested. Each row also shows exactly where its overclaim would start: claim 1 tips the moment the non-pilot series is dropped and 14-to-9 poses as pure program effect; claim 2 tips if the 23 faults are left off and the 61% is asked to speak for every fault the fleet will throw next year; claim 3 tips when 'if the gap holds' becomes 'the gap will hold' — a conditional promoted to a forecast; claim 4 tips the moment the open question is closed by assertion and the whole drop is handed to one member of the bundle. Suspicion is not a verdict; the note earned its four stamps.",
    device: "clearing a disciplined filing under a dossier that primes suspicion",
    choices: [
      {
        text: "Pilot-substation outages fell from 14 to 9 a month; non-pilot substations fell from 15 to 13 over the same period.",
        correct: false,
        rationale:
          "HOLDS. Both series, side by side, read straight off the dossier — printing the comparison is what keeps the pilot number honest instead of letting it pose as pure program effect.",
      },
      {
        text: "The 61% early-flag rate rests on 23 faults — too few to treat as a stable rate yet.",
        correct: false,
        rationale:
          "HOLDS. The n is stated and the hedge is earned: at 23 faults, a handful of calls either way moves the rate by whole points. Declining to settle it is a claim about the data's resolution, and the dossier backs it.",
      },
      {
        text: "If the pilot's gap over the non-pilot sites holds at scale, that result — not this quarter's — would be the evidence the program travels.",
        correct: false,
        rationale:
          "HOLDS. A conditional, not a forecast — 'if it holds' leaves the load-bearing question open, and the consequence it claims is only what a yes would show, not a promise that the yes is coming.",
      },
      {
        text: "We cannot yet separate the model's effect from the schedule change and the new hires.",
        correct: false,
        rationale:
          "HOLDS. The dossier says all three landed the same month; naming the entanglement is a limitation stated as a limitation. A hedge grounded in the readout is discipline, not overreach — clearing it is the point.",
      },
    ],
  },
  {
    caseId: "helios",
    caseSeq: 3,
    title: "Helios: reading the 61%",
    mode: "calibrate",
    skill: "base_rate",
    difficulty: 2,
    contextSnippet:
      "**Helios Grid analytics — pilot quarter:** a fault-prediction model, a revised maintenance schedule, and **two senior-technician hires** all landed the same month · unplanned outages **14 → 9/month** across the **12 volunteer substations** (of 80) · non-pilot substations **15 → 13/month** over the same period · the model flagged **61%** of faults at least 24h ahead (**n = 23 faults**) · ops lead's summary: \"the model is preventing roughly **five outages a month**.\"",
    sourceLabel: "Helios Grid pilot-quarter dossier (fictional)",
    prompt:
      "Set the outage counts aside — what is the strongest claim the pilot supports about the model's early warning itself?",
    explanation:
      "Twenty-three faults is the entire evidence base, and every candidate claim lives or dies by how it treats that number. Flagging 14 of 23 faults a day or more ahead (61%) is a genuinely promising read — the strongest safe claim reports the rate with its n attached and holds it loosely until more faults accrue. The distractors harden it three ways: quoting the rate without its base as if settled, converting warnings into prevented outages the pilot never counted, and inventing a comparison the dossier doesn't contain.",
    device: "hardening a 23-fault rate into a settled performance number",
    choices: [
      {
        text: "The model catches 3 in 5 faults a day ahead — a settled catch rate the rollout can be planned around.",
        correct: false,
        rationale:
          "Over the line. 3 in 5 is the right arithmetic (61%) with the wrong confidence: 23 faults is far too small a base to call the rate settled, and a plan built on it inherits all the noise.",
      },
      {
        text: "The model flagged 61% of the pilot's 23 faults at least 24 hours ahead — promising, but at n = 23 the error bars are wide, so keep counting before treating the rate as real.",
        correct: true,
        rationale:
          "Just right. Reports the rate with its base, sizes the confidence to the sample, and names the next step: accumulate faults until the number can bear weight.",
      },
      {
        text: "With a day's warning on most faults, outages at the pilot sites are now largely preventable.",
        correct: false,
        rationale:
          "Over the line. A flag is a warning, not an averted outage — the dossier never counts a single fault a flag actually headed off, so 61% flagged is not 61% prevented. 'Largely preventable' is an operational result the pilot didn't measure.",
      },
      {
        text: "The model's early warning outperforms the old fault-detection process.",
        correct: false,
        rationale:
          "Over the line. The dossier contains no rate for the old process at all — there is nothing on the page for 61% to beat.",
      },
    ],
  },
  {
    caseId: "helios",
    caseSeq: 4,
    title: "Helios: the rollout recommendation",
    mode: "fix",
    skill: "absent_caveat",
    difficulty: 3,
    contextSnippet:
      "**Helios Grid analytics — pilot quarter:** a fault-prediction model, a revised maintenance schedule, and **two senior-technician hires** all landed the same month · unplanned outages **14 → 9/month** across the **12 volunteer substations** (of 80) · non-pilot substations **15 → 13/month** over the same period · the model flagged **61%** of faults at least 24h ahead (**n = 23 faults**) · ops lead's summary: \"the model is preventing roughly **five outages a month**.\"",
    sourceLabel: "Helios Grid pilot-quarter dossier (fictional)",
    prompt:
      "The draft recommendation reads: \"The pilot cut unplanned outages from 14 to 9 a month. Recommend rolling the program out to all 80 substations.\" One load-bearing caveat is missing — pick the rewrite that carries it without going soft on the recommendation.",
    explanation:
      "The recommendation's weight rests on one unstated assumption: that a result produced by 12 self-selected substations, with three changes landing at once, will reproduce across 68 sites that didn't volunteer and won't get the same bundle. That is the load-bearing caveat, and the repair carries it in a single clause while keeping the call — stage the rollout, verify the gain travels. The distractors map the three ways this craft fails: omitting the caveat behind nicer prose, drowning the recommendation under every hedge at once, and naming a true-but-upstream risk (the 23-fault catch-rate sample) while the selection-and-bundling risk that actually decides the question stays silent.",
    device: "a rollout call that omits the volunteer-site and bundled-change caveat it rides on",
    choices: [
      {
        text: "Recommend expanding the program: pilot outages fell from 14 to 9 a month. Two things could be flattering that number — the 12 sites volunteered, and the model shipped bundled with a schedule change and two hires — so stage the rollout and confirm the gain travels to non-volunteer substations before committing all 80.",
        correct: true,
        rationale:
          "Carries the caveat that actually bears the decision's weight — self-selected sites plus entangled changes — in one clause, and converts it into a staging plan rather than a retreat. The recommendation survives intact.",
      },
      {
        text: "The pilot cut unplanned outages by more than a third, from 14 to 9 a month — a result that speaks for itself. Recommend a full rollout to all 80 substations this quarter.",
        correct: false,
        rationale:
          "Confident and clean, and the load-bearing caveat is still missing — nothing here tells the reader why 12 volunteer sites with three simultaneous changes might not travel to the other 68. Better phrasing isn't the repair.",
      },
      {
        text: "Given the volunteer sites, the bundled changes, the small fault sample, and only one quarter of data, it is difficult to say what the pilot shows; a broader rollout could be revisited once considerably more evidence is in hand.",
        correct: false,
        rationale:
          "Buries the recommendation under every hedge available. The pilot earned a next step — the craft task is to carry the one caveat that matters while still making the call, not to disperse the call across four.",
      },
      {
        text: "Recommend a full rollout to all 80 substations, with one caution: the 61% early-flag rate rests on just 23 faults, so the model's catch rate may shift as more data accrues.",
        correct: false,
        rationale:
          "A real caveat aimed at the wrong joint. The catch-rate sample was already flagged upstream in the engineer's note — what this rollout decision turns on is whether volunteer sites with bundled changes generalize, and that risk goes unmentioned.",
      },
    ],
  },
];
