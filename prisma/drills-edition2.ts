// Edition 2 — the BELLWETHER dossier + eight pool items restocking the
// thinnest skill/difficulty/mode cells (authored + adversarially reviewed;
// the reviewer fixed 6 of 12, incl. a craft-spot contract violation and a
// Q3-to-Q4 forward-leak neutralized by reframing the later question).
import type { DrillSeed } from "./drills";

export const EDITION2: DrillSeed[] = [
  // ────────────────────────────────────────────────────────────────────────
  // CASE FILE · BELLWETHER — the reading scores went up. Everyone is taking
  // a bow.
  // ────────────────────────────────────────────────────────────────────────
  {
    caseId: "bellwether",
    caseSeq: 1,
    title: "Bellwether: who owns the seven points",
    mode: "spot",
    skill: "single_cause",
    difficulty: 2,
    contextSnippet:
      "**Bellwether Unified (fictional school district) — year-end literacy review:** a **new reading curriculum**, **14 volunteer tutors**, and an **attendance-recovery push** all launched the same fall · grade-4 reading proficiency **46% → 53%** across the **9 pilot schools** (of 31) · non-pilot schools **44% → 47%** over the same year · pilot schools volunteered and carry the district's **highest parent-engagement scores** · the state test was **re-normed** this year (all districts shifted up **~2pts**) · district enrollment **30,400** across all 31 schools; grade-4 cohort **~2,200**, with **~640** at pilot schools · superintendent's draft: \"the new curriculum delivered a **seven-point gain**.\"",
    sourceLabel: "Bellwether Unified year-end literacy dossier (fictional)",
    prompt:
      "Two tellings of the pilot-year results, built from the same dossier. Which one exceeds the data?",
    explanation:
      "Three programs launched at the pilot schools the same fall — the curriculum, the fourteen tutors, the attendance push — so the seven points belong to that bundle until something separates them, and the superintendent's draft hands the whole gain to one member of it. It also spends the seven points as if every point were program: non-pilot schools rose three with none of the interventions, and the re-normed test lifted every district about two, so the baseline itself was moving under the pilot's feet. The faithful telling keeps all the numbers, holds the bundle together, and leaves the curriculum's share where the dossier leaves it: unassigned.",
    faithfulText:
      "Grade-4 proficiency at the nine pilot schools rose from 46% to 53% in a year when the new curriculum, the fourteen tutors, and the attendance push all launched together — and in which non-pilot schools rose from 44% to 47% and a statewide re-norm shifted all districts up about two points. The pilot gain is real; how much of it belongs to the curriculum is unassigned.",
    overclaimedText:
      "The new reading curriculum delivered a seven-point gain: grade-4 proficiency at the pilot schools rose from 46% to 53%, more than double the drift at non-pilot schools. The curriculum investment is paying off.",
    device: "handing a three-program bundle's gain to one program while the baseline moves",
  },
  {
    caseId: "bellwether",
    caseSeq: 2,
    title: "Bellwether: the board packet ledger",
    mode: "ledger",
    skill: "base_rate",
    difficulty: 3,
    contextSnippet:
      "**Bellwether Unified (fictional school district) — year-end literacy review:** a **new reading curriculum**, **14 volunteer tutors**, and an **attendance-recovery push** all launched the same fall · grade-4 reading proficiency **46% → 53%** across the **9 pilot schools** (of 31) · non-pilot schools **44% → 47%** over the same year · pilot schools volunteered and carry the district's **highest parent-engagement scores** · the state test was **re-normed** this year (all districts shifted up **~2pts**) · district enrollment **30,400** across all 31 schools; grade-4 cohort **~2,200**, with **~640** at pilot schools · superintendent's draft: \"the new curriculum delivered a **seven-point gain**.\"",
    sourceLabel: "Bellwether Unified year-end literacy dossier (fictional)",
    prompt:
      "Four claims from the board packet — stamp each one: does it hold, or does it exceed the data?",
    explanation:
      "Three straight reads and one translation error. The pilot rise, the non-pilot comparison, and the hedged re-norm note all report the page at the page's own scope. The flag is the row that turns points into people: 'roughly 2,100' multiplies the pilot schools' seven-point grade-4 gain by all 30,400 students in the district — every grade, including the 22 schools that never ran the programs. The same gain over its honest denominator is about 45 fourth-graders at the pilot schools. When a rate becomes a count, the first question is whose denominator it was multiplied by.",
    device: "multiplying a pilot-school grade-4 gain by the whole district's enrollment",
    choices: [
      {
        text: "Grade-4 proficiency at the nine pilot schools rose seven points this year, from 46% to 53%.",
        correct: false,
        rationale:
          "HOLDS. Scoped to the pilot schools and the year measured — the headline figure read straight off the dossier.",
      },
      {
        text: "Non-pilot schools rose three points over the same year, from 44% to 47%.",
        correct: false,
        rationale:
          "HOLDS. The comparison series reported as the comparison series — printing it beside the pilot number is what keeps the seven points honest.",
      },
      {
        text: "Some of this year's rise — at pilot and non-pilot schools alike — likely reflects the state's re-norm, which shifted all districts up about two points.",
        correct: false,
        rationale:
          "HOLDS. A hedged caveat grounded in the dossier's own note: 'some' and 'likely' size the claim to what a statewide two-point shift can support. A caveat that fits the data is discipline, not overreach.",
      },
      {
        text: "The gain works out to roughly 2,100 more proficient readers across the district.",
        correct: true,
        rationale:
          "EXCEEDS. 2,100 is 7% of 30,400 — the district's entire enrollment, every grade, all 31 schools. The seven points were measured on grade-4 students at the nine pilot schools: about 640 children, where the gain is roughly 45 more proficient readers. Even across all ~2,200 fourth-graders it would be ~154 — and 22 of those schools never ran the programs. A pilot-grade rate was multiplied by a district-wide denominator.",
      },
    ],
  },
  {
    caseId: "bellwether",
    caseSeq: 3,
    title: "Bellwether: what next fall supports",
    mode: "calibrate",
    skill: "extrapolation",
    difficulty: 2,
    contextSnippet:
      "**Bellwether Unified (fictional school district) — year-end literacy review:** a **new reading curriculum**, **14 volunteer tutors**, and an **attendance-recovery push** all launched the same fall · grade-4 reading proficiency **46% → 53%** across the **9 pilot schools** (of 31) · non-pilot schools **44% → 47%** over the same year · pilot schools volunteered and carry the district's **highest parent-engagement scores** · the state test was **re-normed** this year (all districts shifted up **~2pts**) · district enrollment **30,400** across all 31 schools; grade-4 cohort **~2,200**, with **~640** at pilot schools · superintendent's draft: \"the new curriculum delivered a **seven-point gain**.\"",
    sourceLabel: "Bellwether Unified year-end literacy dossier (fictional)",
    prompt: "What is the strongest claim this dossier supports about next year and expansion?",
    explanation:
      "One year of data, three bundled programs, self-selected sites, and a test that changed its own scale mid-story — the dossier supports a conditional about expansion, not a forecast. The strongest claim carries the selection effect forward as a condition and concedes that a single re-normed interval can't establish a trend. The overreaches run in three directions: extending one interval as a slope, mandating district-wide what volunteer sites produced, and over-correcting the whole gain away to the re-norm — which moved all districts alike, and so can't explain the pilot's edge over its own district's baseline.",
    device: "reading one re-normed volunteer-pilot year as a district-wide forecast",
    choices: [
      {
        text: "The pilot schools should add another seven points next year — the first year's slope is established.",
        correct: false,
        rationale:
          "Over the line. One year-over-year change — part of it the re-norm's two points — is a single interval, not a slope. Nothing in the dossier says the second year resembles the first.",
      },
      {
        text: "Expansion to schools with comparable parent-engagement profiles might reproduce part of the gain if the selection effect is accounted for — but one year on a re-normed test can't establish a trend, so next year's series at both pilot and non-pilot schools has to come first.",
        correct: true,
        rationale:
          "Just right. A conditional expansion claim scoped to the selection effect the dossier names, plus the honest concession: one re-normed year is not a trend, and next year's series is the evidence that doesn't exist yet.",
      },
      {
        text: "The curriculum works — mandate it across all 31 schools and expect pilot-level results next year.",
        correct: false,
        rationale:
          "Over the line. The nine pilot schools volunteered and carry the district's highest parent-engagement scores — the 22 schools a mandate would add are precisely the ones the pilot's selection excluded. 'Pilot-level results' assumes away the difference the dossier states.",
      },
      {
        text: "The re-norm produced the pilot gain; expanding any of the programs next year would buy nothing.",
        correct: false,
        rationale:
          "Over the line in reverse. The re-norm lifted all districts about two points — it can't account for the pilot's rise past its own district's non-pilot baseline. Writing the programs off entirely is as much an overclaim as crediting the curriculum alone; over-correction is still mis-assignment.",
      },
    ],
  },
  {
    caseId: "bellwether",
    caseSeq: 4,
    title: "Bellwether: the review that stops short",
    mode: "fix",
    skill: "missing_sowhat",
    difficulty: 3,
    contextSnippet:
      "**Bellwether Unified (fictional school district) — year-end literacy review:** a **new reading curriculum**, **14 volunteer tutors**, and an **attendance-recovery push** all launched the same fall · grade-4 reading proficiency **46% → 53%** across the **9 pilot schools** (of 31) · non-pilot schools **44% → 47%** over the same year · pilot schools volunteered and carry the district's **highest parent-engagement scores** · the state test was **re-normed** this year (all districts shifted up **~2pts**) · district enrollment **30,400** across all 31 schools; grade-4 cohort **~2,200**, with **~640** at pilot schools · superintendent's draft: \"the new curriculum delivered a **seven-point gain**.\"",
    sourceLabel: "Bellwether Unified year-end literacy dossier (fictional)",
    prompt:
      "The review's closing summary reads: \"Grade-4 proficiency at the nine pilot schools rose from 46% to 53%, versus 44% to 47% at non-pilot schools. Three programs launched together, the pilot sites volunteered with the district's highest parent engagement, and this year's state re-norm lifted all districts about two points, so the curriculum's own contribution cannot be isolated.\" Accurate and fully caveated — and it names no decision. Pick the rewrite that adds the so-what without overreaching.",
    explanation:
      "Every fact in the draft is true and every caveat is present; the craft failure is that it ends where the reader's job begins. A year-end review exists to shape next year's plan, and this dossier's caveats aren't just warnings — each is an instruction wearing a disclaimer: 'sites self-selected' asks for a matched hold-out, 'engagement scores' asks to be measured alongside outcomes, and 'programs bundled' means next year tests the bundle where no school chose it — separating its parts can wait until the bundle proves it travels. The correct rewrite converts the caveats into next year's funding and measurement plan without widening a single claim. The distractors are the three ways a so-what goes wrong: absent, oversized, or deferred until the decision makes itself.",
    device: "a fully caveated year-end review that names nothing to fund or measure next year",
    choices: [
      {
        text: "Pilot schools rose seven points against three at non-pilot schools — with three programs bundled, sites self-selected, and a re-normed test in the mix. For next year: fund the bundle in a set of matched non-volunteer schools with a held-out comparison group, and track parent engagement alongside scores, so the programs' effect can be separated from the schools that chose them.",
        correct: true,
        rationale:
          "Adds the decision the review exists to inform — what to fund and what to measure — and sizes it to the caveats already on the page: the hold-out answers the selection problem, the engagement covariate makes next year's comparison readable. The honesty survives; the summary just stops stopping short.",
      },
      {
        text: "The plainest way to put it: pilot schools gained seven points, non-pilot schools three, and between the bundled programs, the self-selected sites, and the re-normed test, the curriculum's own share of the gain cannot be isolated.",
        correct: false,
        rationale:
          "Cleaner prose, same flaw — it describes the year perfectly and names nothing to do about it. The reader closes the review no better equipped to plan the next one.",
      },
      {
        text: "The results speak clearly enough to act: adopt the new curriculum at all 31 schools in next year's budget — a seven-point gain is too large to leave sitting in nine buildings.",
        correct: false,
        rationale:
          "It names a decision, but one bigger than the summary's own caveats can carry — the sentence before it concedes the curriculum's share can't be isolated. A so-what has to fit inside the caveats it travels with.",
      },
      {
        text: "Withhold any recommendation for now: next year's scores at pilot and non-pilot schools will show whether the gain travels, so the responsible move is to reconvene the question when they arrive and decide funding then.",
        correct: false,
        rationale:
          "A so-what-shaped deferral. Next year's scores only answer the question if next year is built to answer it — funded comparison sites, a hold-out, engagement measured. Left to run by default, next fall reproduces this fall's confounds, and the budget gets decided in the meantime anyway. Naming the wait is not naming the plan.",
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  // POOL — eight ordinary items (no caseId)
  // ────────────────────────────────────────────────────────────────────────
  {
    title: "The bounce-rate all-clear",
    mode: "spot",
    skill: "padding",
    difficulty: 2,
    contextSnippet:
      "**Tanager (newsletter platform), deliverability incident — week 3:** bounce rate **9.1% → 1.8%** after the DNS-records fix · delivery confirmed restored at all **four major inbox providers** — send logs reconciled against provider postmaster dashboards, the deliverability vendor confirmed independently, and the checks were re-run after a **48-hour** observation window · open rate back at **41%**, its pre-incident level.",
    sourceLabel: "Deliverability incident postmortem (fictional)",
    prompt:
      "Both tellings are accurate and reach the same all-clear. Which one drowns it in rigor-theater?",
    explanation:
      "Both tellings are faithful — the audit trail the weaker one recites really happened, and it is all in the record. But it narrates that trail — log exports, postmaster reconciliation, vendor confirmation, an observation window — before the reader learns a single number, and the numbers then arrive swaddled in 'we can report that.' Verification belongs in the work; the readout owes the reader the finding. Process narration at this length isn't rigor, it's costume — the stronger telling compresses the whole trail into 'confirmed' and closes the incident in two sentences without losing a fact.",
    faithfulText:
      "The DNS fix landed: bounces fell from 9.1% to 1.8%, delivery is confirmed restored at all four major inbox providers, and opens are back at their pre-incident 41%. Incident closed.",
    overclaimedText:
      "To validate the remediation, we exported the full send logs, reconciled them against provider-side postmaster dashboards, engaged our deliverability vendor for independent confirmation, and re-ran the checks after a 48-hour observation window. Following this multi-source verification exercise, we can report that the bounce rate, previously 9.1%, now stands at 1.8%, that delivery is restored at all four major providers, and that the open rate has returned to its pre-incident level of 41%.",
    device: "the all-clear buried under a recitation of its own verification process",
  },
  {
    title: "The shrink report, region by region",
    mode: "fix",
    skill: "padding",
    difficulty: 3,
    contextSnippet:
      "**Ashgrove Grocers, inventory shrink:** shrink **1.9% → 1.4%** of sales in the first full quarter after the new receiving process · consistent across all **6 regions** (range **1.36%–1.45%**) · quarterly sales ~**$420M**, so the half-point is worth ~**$2.1M/quarter** · audit methodology unchanged.\n\n*Flawed telling:* \"Shrink improved this quarter. By region: Northeast came in at 1.42%, Southeast at 1.38%, Midwest at 1.44%, Mountain at 1.36%, Pacific at 1.45%, and South-Central at 1.41% — every one of the six improved on the prior quarter. Expressed in basis points, the company-wide move is 50bps, from 190bps to 140bps; in dollar terms, at roughly $420M of quarterly sales, the improvement is approximately $2.1M per quarter, or $8.4M annualized. We note that the audit methodology, count cadence, and shrink definition were all unchanged, so the figures are comparable on a like-for-like basis across every region and both periods.\"",
    sourceLabel: "Retail loss-prevention quarterly (fictional)",
    prompt:
      "Every number is real and the method notes are true — but the report performs thoroughness instead of informing. Pick the rewrite that says it tight without dropping anything real.",
    explanation:
      "This is padding at its most defensible: six regional decimals whose entire information content is 'consistent, 1.36–1.45,' the same move restated in percent, basis points, and dollars, and the comparability note delivered three ways. Detail that adds no discriminating information is length, not rigor. The repair keeps every fact that changes what a reader knows — the move, the range, the dollar weight, the unchanged method — and cuts everything that merely re-performs those facts.",
    device: "regional roll-calls and unit restatements performing a thoroughness one range already delivers",
    choices: [
      {
        text: "Shrink fell from 1.9% to 1.4% of sales in the first full quarter after the new receiving process — consistent across all six regions (1.36%–1.45%) and worth about $2.1M a quarter at current volume, measured on an unchanged audit methodology.",
        correct: true,
        rationale:
          "One sentence carries every load-bearing fact: the move, its consistency, its dollar weight, and the like-for-like note. The six regional decimals collapse into the range that was their actual information content.",
      },
      {
        text: "Shrink improved meaningfully on a like-for-like basis: company-wide it moved 50 basis points, from 1.9% to 1.4%, and we verified the improvement region by region — Northeast, Southeast, Midwest, Mountain, Pacific, and South-Central each landed between 1.36% and 1.45%, each better than the prior quarter, with methodology unchanged in every case.",
        correct: false,
        rationale:
          "Trims the worst of it but keeps the region-by-region roll call and the twice-stated comparability note. The enumeration is the padding, and it survives the edit.",
      },
      {
        text: "Shrink fell to 1.4% this quarter.",
        correct: false,
        rationale:
          "Over-trimmed — the baseline, the six-region consistency, and the $2.1M sizing are all real content, and all gone. Tight isn't the same as empty.",
      },
      {
        text: "Shrink fell from 1.9% to 1.4%, saving $2.1M a quarter — the new receiving process has fixed our loss problem chain-wide.",
        correct: false,
        rationale:
          "Tight, but it swaps filler for a new flaw: one quarter of consistent numbers becomes a settled verdict ('fixed'). Cutting padding doesn't license adding conclusions.",
      },
    ],
  },
  {
    title: "More claims, more units",
    mode: "ledger",
    skill: "base_rate",
    difficulty: 2,
    contextSnippet:
      "**Foxglove Outdoor Gear — quarterly quality digest:** warranty claims **210 → 340** quarter over quarter · units sold **52,000 → 91,000** over the same quarter (a holiday-season jump) · claim rate per unit sold **~0.40% → ~0.37%**.",
    sourceLabel: "Product quality quarterly digest (fictional)",
    prompt: "Four claims from the quality digest — stamp each one: does it hold, or does it exceed the data?",
    explanation:
      "Three rows are the discipline and one is the trap. The count did jump 62% — but units sold jumped 75%, so the rate at which a unit comes back actually fell, 0.40% to 0.37%. A raw count can rise while the thing it's supposed to measure improves; 'quality is slipping' reads the numerator alone and lands on the wrong side of the truth. The clean rows show the honest sequence: count, denominator, rate.",
    device: "a quality verdict hung on a claim count while the denominator grew faster",
    choices: [
      {
        text: "Warranty claims rose from 210 to 340 this quarter.",
        correct: false,
        rationale: "HOLDS. The raw count, reported as a raw count — 210 to 340 is the digest verbatim.",
      },
      {
        text: "Units sold rose from 52,000 to 91,000 over the same period.",
        correct: false,
        rationale:
          "HOLDS. The denominator's own movement, read straight — and the fact the verdict row needed and ignored.",
      },
      {
        text: "Per unit sold, the claim rate edged down — from about 0.40% to about 0.37%.",
        correct: false,
        rationale:
          "HOLDS. 210 / 52,000 ≈ 0.40% and 340 / 91,000 ≈ 0.37% — the denominator restored. This row is the discipline the digest exists to teach.",
      },
      {
        text: "Quality is slipping: claims jumped 62% quarter over quarter.",
        correct: true,
        rationale:
          "EXCEEDS. The 62% is real arithmetic (340 / 210), but sales grew 75% — the per-unit rate fell. The count-only read points the opposite direction from the rate, and 'slipping' hangs a quality verdict on the dropped denominator.",
      },
    ],
  },
  {
    title: "The intro-session gap",
    mode: "ledger",
    skill: "cause",
    difficulty: 2,
    contextSnippet:
      "**Rivermoor Gyms — renewal analysis:** members who booked the **free intro session** in month one renewed at **78%** vs **54%** for those who didn't (**24pt** gap) · booking is **member-initiated** — no assignment, no experiment · bookers also averaged **2.3×** more visits in month one.",
    sourceLabel: "Membership renewal memo (fictional)",
    prompt: "Four claims from the renewal memo — stamp each one: does it hold, or does it exceed the data?",
    explanation:
      "One verdict row among three honest ones. The gap, the self-selection caveat, and the conditional are all within the page; the overreach is the row that converts the gap into a mechanism. With member-initiated booking and bookers visiting 2.3× more, the session marks the motivated members at least as plausibly as it makes them — 'drives' and 'makes' are causal grammar on a split no experiment isolates. Note the near-miss: the conditional row uses the same causal vocabulary and holds, because 'if' keeps the question open. The grammar, not the topic, is what tips a row over.",
    device: "causal grammar on a self-selected booking split — beside a conditional that stays honest",
    choices: [
      {
        text: "Members who booked the intro session renewed at 78%, versus 54% for members who didn't.",
        correct: false,
        rationale: "HOLDS. The association stated as an association — both rates, both groups, no verdict attached.",
      },
      {
        text: "If the session itself drives renewal, pushing bookings of a free session would be a cheap retention lever — worth testing.",
        correct: false,
        rationale:
          "HOLDS. The tempting flag — it says 'drives' — but the 'if' is doing real work: a conditional that leaves the causal question open is not a causal claim, and the session's zero price is on the page. Flagging honest hypotheticals would ban thinking out loud.",
      },
      {
        text: "The intro session drives renewal: booking it makes a member 24 points more likely to stay.",
        correct: true,
        rationale:
          "EXCEEDS. Booking is member-initiated and bookers logged 2.3× more visits in month one — the motivated members selected themselves into the session. 'Drives' and 'makes' assert a mechanism nothing in the memo isolates.",
      },
      {
        text: "Because booking was member-initiated, the 24-point gap may reflect who books rather than what the session does.",
        correct: false,
        rationale:
          "HOLDS. A caveat is a claim too, and this one is grounded — the memo states there was no assignment. A hedge that fits the data is discipline, not overreach.",
      },
    ],
  },
  {
    title: "Satisfaction to four decimals",
    mode: "spot",
    skill: "false_precision",
    difficulty: 2,
    contextSnippet:
      "**Glasswing Hotels, post-stay guest survey (Q3):** overall satisfaction **8.44** on the platform's 10-point scale (platform export shows **8.4371**) · **142 responses** from **9,800 stays** (**1.4%** response rate, opt-in) · prior quarter **8.2175**.",
    sourceLabel: "Guest experience survey export (fictional)",
    prompt: "Same survey, same export. Which telling manufactures precision the sample cannot support?",
    explanation:
      "142 self-selected respondents out of 9,800 stays can support tenths, not ten-thousandths — a handful of different guests choosing to answer moves the mean by more than the entire reported 'gain.' The four-decimal figures are real platform output, and that is the disguise: the export's resolution is not the measurement's. Quoting 8.4371 and a 0.2196-point improvement dresses sampling noise as an instrument reading; the faithful telling rounds to what the sample can carry and says why the two-tenths move can't yet be banked.",
    faithfulText:
      "Guest satisfaction came in around 8.4 this quarter, versus roughly 8.2 last quarter — but with 142 opt-in responses from 9,800 stays, a two-tenths move is within the noise of who chose to answer. Directional at best.",
    overclaimedText:
      "Guest satisfaction reached 8.4371 this quarter, an improvement of 0.2196 points over Q2's 8.2175, drawn from the platform's full export of the quarter's 142 survey responses.",
    device: "quoting a 1.4%-response opt-in survey at the export's four-decimal resolution",
  },
  {
    title: "The click rate that matters",
    mode: "fix",
    skill: "buried_lede",
    difficulty: 3,
    contextSnippet:
      "**Corvid Systems, Q3 phishing simulation (1,150 employees):** company-wide click rate **7%**, down from **12%** a year ago · finance — the team that holds payment approval — clicked at **31%** (**11 of 36** staff), including **2 of the 4** wire-authorizers · security-training completion **96%**.\n\n*Flawed telling:* \"The phishing program continues to mature. Company-wide click rates have fallen from 12% to 7% year over year, and training completion stands at 96% — both consistent with a strengthening security culture. Results naturally vary by department, and this quarter's simulation gives us useful visibility into those differences: finance, which holds payment approval, clicked at 31%, including two of the four wire-authorizers.\"",
    sourceLabel: "Security awareness quarterly report (fictional)",
    prompt:
      "Every figure is accurate, and the improving trend is real context. Pick the rewrite that leads with the finding a reader needs — without going soft on it.",
    explanation:
      "This is burial in its most respectable costume: open with the program's trajectory, frame the danger as 'departmental variation,' and let the one number that demands action arrive last, pre-cushioned. The reader's takeaway forms in the first sentence — 'maturing program' — before they ever meet the 31% in the payments team. The repair is ordering: the finance exposure first with its sharpest details attached, and the genuine good news demoted to the context it is. Nothing dropped, nothing added; the lede just stops hiding.",
    device: "a payments-team failure delivered last, dressed as routine departmental variation",
    choices: [
      {
        text: "Finance — the team that approves payments — clicked at 31% in this quarter's phishing simulation (11 of 36 staff), including two of the four wire-authorizers. That's the exposure to act on, and it sits inside an otherwise improving picture: company-wide clicks fell from 12% to 7%, and training completion is 96%.",
        correct: true,
        rationale:
          "Leads with the number that carries the risk, keeps its two most alarming details attached, and uses the good news as the frame it actually is. Same facts, right order.",
      },
      {
        text: "Departmental variation was the theme of this quarter's simulation: results ranged widely, with finance at the high end at 31% against a company-wide 7%, itself down from 12% a year ago.",
        correct: false,
        rationale:
          "The 31% arrives dressed as one end of a 'range' — variation-as-theme is the same burial in a new costume, and the wire-authorizer detail has vanished entirely.",
      },
      {
        text: "Finance clicked at 31% because its security training has clearly failed; suspend the team's payment authority until the entire department is retrained.",
        correct: false,
        rationale:
          "Leads correctly, then asserts a cause the data doesn't establish — 96% completion says the training was taken, not that it failed or why finance clicked — and escalates to an unsized suspension of payment authority. Fixing the order doesn't license new claims.",
      },
      {
        text: "This quarter's simulation showed mixed results across the company, and some departments may warrant follow-up attention in the months ahead.",
        correct: false,
        rationale:
          "Buries the finding so deep it disappears — no 31%, no finance, no wire-authorizers. Softness is not the fix for burial.",
      },
    ],
  },
  {
    title: "Where the tutorial leaks",
    mode: "calibrate",
    skill: "missing_sowhat",
    difficulty: 2,
    contextSnippet:
      "**Harrow & Finch (genealogy app), onboarding funnel:** 5-step tutorial completion — steps 1–2 pass at ~**92%**, step 3 (the **records-access permissions screen**) passes **54%**, steps 4–5 pass at ~**88%** of those who clear step 3 · tutorial finishers activate at **61%** vs **29%** for non-finishers (finishing is self-selected) · step 3 accounts for **41%** of week-one support tickets.",
    sourceLabel: "Onboarding analytics review (fictional)",
    prompt: "What is the strongest claim this data supports about what to do next?",
    explanation:
      "The readout localizes a problem (a 54% pass rate on one screen), prices it (41% of week-one tickets), and offers a temptation (the 61-vs-29 activation gap). The strongest actionable claim spends the first two and resists the third: redesign and test the screen the data indicts, while treating the activation gap as self-selected hope rather than bankable return. Description alone wastes the localization; the removal mandate spends the gap as if it were causal; the support-staffing move treats the symptom the funnel already traced to its source.",
    choices: [
      {
        text: "Step 3 is the tutorial's weakest step, passing 54% of users against roughly 90% for every other step.",
        correct: false,
        rationale:
          "Too timid. Accurate, but it stops at description — the funnel shape, the ticket share, and the activation gap together point at a move, and this names none.",
      },
      {
        text: "Redesign the step-3 permissions screen and A/B test it against the current one — it's the funnel's choke point and the source of 41% of week-one tickets. Don't budget for the activation gap closing, though: finishers self-select, so passing more users may not buy their 61%.",
        correct: true,
        rationale:
          "Just right. The decision the data supports — fix and test the measured choke point — with the self-selection caveat keeping the expected payoff honest.",
      },
      {
        text: "Drop the permissions screen from the tutorial entirely: finishing doubles activation, so removing the blocker moves everyone it saves from 29% toward 61%.",
        correct: false,
        rationale:
          "Over the line twice. It rips out a records-access screen the product may require, untested — and it banks the self-selected 61-vs-29 gap as a causal payoff the funnel data never established.",
      },
      {
        text: "Staff the support queue for the step-3 surge — at 41% of week-one tickets, faster answers there will smooth onboarding.",
        correct: false,
        rationale:
          "A real number aimed at the wrong lever. The tickets are a symptom of the screen the funnel already localizes; absorbing them faster leaves the 54% pass rate — the actual leak — untouched.",
      },
    ],
  },
  {
    title: "The loss ratio that hasn't aged",
    mode: "calibrate",
    skill: "absent_caveat",
    difficulty: 3,
    contextSnippet:
      "**Silverthorn Insurance — embedded-checkout channel, first 4 months:** acquisition cost **$18/policy** vs **$54** blended across other channels · **2,900** policies sold · loss ratio to date **31%** vs **58%** book average — but the embedded policies are **0–4 months old**, and claims on this line typically **emerge over 18–24 months** · current volume runs through **one retail partner**.",
    sourceLabel: "Distribution channel review (fictional)",
    prompt: "What is the strongest claim this readout supports about the new channel?",
    explanation:
      "Two numbers, two maturities. The $18-vs-$54 acquisition cost is a finished measurement; the 31% loss ratio is an unfinished one — a cohort 0–4 months old, on a line whose claims take 18–24 months to emerge, mostly hasn't had time to have claims yet. The strongest claim carries that caveat inside the same sentence that quotes the ratio, and still makes the acquisition-cost call with full confidence. The failure modes bracket it: bank both numbers, bank neither, or hedge the wrong one.",
    choices: [
      {
        text: "Embedded checkout wins on both economics and risk: policies cost a third as much to acquire and run a 31% loss ratio against the book's 58% — scale the channel and update the line's underwriting assumptions.",
        correct: false,
        rationale:
          "Carries the numbers and drops the caveat that decides them: at 0–4 months of age, on a line where claims emerge over 18–24 months, the 31% is mostly claims that haven't had time to happen. Repricing risk on an unaged cohort is exactly the move the missing caveat exists to stop.",
      },
      {
        text: "Embedded checkout is acquiring policies at a third of blended cost — $18 vs $54 — and that result is real now. The 31% loss ratio isn't yet: these policies are 0–4 months old on a line where claims emerge over 18–24 months, so scale the channel on acquisition economics — watching the single-partner concentration as it grows — and let the loss ratio age before it informs anything.",
        correct: true,
        rationale:
          "Just right. It makes the strong claim the data has earned (the acquisition cost) and carries the load-bearing caveat in the same breath as the number it limits — the loss ratio is quoted and immediately dated, and the one-partner dependence is noted where scaling is proposed.",
      },
      {
        text: "Four months of data through a single partner is too little to conclude anything about the channel; revisit once the book matures.",
        correct: false,
        rationale:
          "Over-hedged. The $18-vs-$54 acquisition cost is measured, complete, and needs no aging — refusing to claim it discards the readout's one settled fact.",
      },
      {
        text: "The channel's 31%-vs-58% loss-ratio advantage is genuine — the caution is concentration: with all volume through one retail partner, the partner relationship is the risk to manage as we scale.",
        correct: false,
        rationale:
          "A true caution attached to the wrong number. Partner concentration is worth managing, but it isn't what limits the 31% — cohort age is, and this claim banks the unaged loss ratio as 'genuine' while hedging elsewhere.",
      },
    ],
  },
];
