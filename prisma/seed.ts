/**
 * Seed data: 8 findings × 6 variants, hand-written.
 *
 * Variant-set design ("star" design): each finding has a BASE variant plus
 * deviations that change exactly ONE attribute from the base, rotating which
 * attributes are contrasted across findings. This maximizes pairs differing on
 * exactly one attribute (5–6 clean single-attribute pairs per finding) while
 * every attribute gets contrast coverage somewhere in the deck.
 *
 * Exactly 1 variant per finding is fidelity=overclaimed: same tags as the
 * base, but the text subtly exceeds the truthSummary (causal language on
 * correlational data, dropped uncertainty, extrapolated trend).
 *
 * The seed validates its own tags (length bands, one-overclaim-per-finding,
 * single-contrast pair counts) — the tags are the product, so a mislabeled
 * variant fails the seed rather than polluting the data.
 */

import { PrismaClient } from "@prisma/client";
import {
  ATTRIBUTE_KEYS,
  CAVEAT_PLACEMENTS,
  FIDELITIES,
  LEAD_TYPES,
  LENGTH_BANDS,
  QUANTIFICATIONS,
  SO_WHATS,
  bandFor,
  wordCount,
  type AttributeProfile,
  type Domain,
} from "../src/lib/types";

const prisma = new PrismaClient();

type SeedVariant = AttributeProfile & { text: string };

type SeedFinding = {
  title: string;
  domain: Domain;
  contextSnippet: string;
  sourceLabel: string;
  truthSummary: string;
  variants: SeedVariant[];
};

const findings: SeedFinding[] = [
  // -------------------------------------------------------------------------
  // 1. Earnings — price-driven revenue growth
  {
    title: "Meridian Foods: price-driven growth",
    domain: "earnings",
    contextSnippet:
      "**Meridian Foods — Q3 FY25 revenue:** $2.84B (+6.2% YoY) · Volume +0.3% · Price/mix +5.9%",
    sourceLabel: "Meridian Foods Q3 FY25 earnings release (fictional)",
    truthSummary:
      "Meridian Foods Q3 revenue grew 6.2% year over year to $2.84B. Nearly all of the growth came from price increases; sales volumes were essentially flat at +0.3%. This is one quarter of data and says nothing about future demand.",
    variants: [
      {
        // BASE
        text: "Revenue grew 6.2% year over year to $2.84B in Q3. Pricing drove nearly all of it: volumes rose just 0.3%. Watch volume, not revenue, to judge real demand — this is one quarter, and price-led growth can stall.",
        leadType: "number_first",
        lengthBand: "medium",
        caveatPlacement: "trailing",
        quantification: "precise",
        soWhat: "explicit",
        fidelity: "faithful",
      },
      {
        // Δ leadType
        text: "Meridian's growth is coming from pricing power, not demand: Q3 revenue rose 6.2% to $2.84B while volumes rose only 0.3%. Track volumes next quarter to see if demand holds — one quarter of price-led growth proves little on its own.",
        leadType: "implication_first",
        lengthBand: "medium",
        caveatPlacement: "trailing",
        quantification: "precise",
        soWhat: "explicit",
        fidelity: "faithful",
      },
      {
        // Δ leadType
        text: "Is Meridian actually selling more food? Barely: Q3 revenue rose 6.2% to $2.84B, but volumes rose just 0.3% — pricing did the work. Judge demand by volume, not revenue. Caveat: one quarter can't confirm a trend.",
        leadType: "question_first",
        lengthBand: "medium",
        caveatPlacement: "trailing",
        quantification: "precise",
        soWhat: "explicit",
        fidelity: "faithful",
      },
      {
        // Δ lengthBand
        text: "Revenue up 6.2% to $2.84B; volumes just +0.3%. Watch volumes, not price-led revenue — one quarter only.",
        leadType: "number_first",
        lengthBand: "short",
        caveatPlacement: "trailing",
        quantification: "precise",
        soWhat: "explicit",
        fidelity: "faithful",
      },
      {
        // Δ caveatPlacement
        text: "Revenue rose 6.2% year over year to $2.84B in Q3, with volumes up just 0.3% — nearly all growth came from price increases. To judge underlying demand, track volume trends rather than headline revenue.",
        leadType: "number_first",
        lengthBand: "medium",
        caveatPlacement: "omitted",
        quantification: "precise",
        soWhat: "explicit",
        fidelity: "faithful",
      },
      {
        // Δ fidelity — extrapolates momentum, asserts durable pricing power
        text: "Revenue jumped 6.2% to $2.84B in Q3, and with pricing power this strong, Meridian can keep raising prices without losing customers — volumes still grew 0.3%. Expect revenue growth to accelerate into Q4; input costs are the only watch item.",
        leadType: "number_first",
        lengthBand: "medium",
        caveatPlacement: "trailing",
        quantification: "precise",
        soWhat: "explicit",
        fidelity: "overclaimed",
      },
    ],
  },
  // -------------------------------------------------------------------------
  // 2. Earnings — cloud segment concentration
  {
    title: "Northwind Group: cloud carries growth",
    domain: "earnings",
    contextSnippet:
      "**Northwind Group — Q2 segment revenue:** Cloud $412M (+31% YoY, was +39% in Q1) · Total company +4% · Cloud share of revenue: 18%",
    sourceLabel: "Northwind Group Q2 FY25 earnings supplement (fictional)",
    truthSummary:
      "Northwind's cloud segment grew 31% year over year to $412M in Q2 and now makes up 18% of total revenue, while total company revenue grew 4%. Cloud growth decelerated from 39% the prior quarter.",
    variants: [
      {
        // BASE
        text: "Cloud is now carrying Northwind's growth — though its pace is cooling, down from 39% last quarter. The segment grew 31% year over year to $412M in Q2 and now makes up 18% of revenue, while the company overall grew just 4%.",
        leadType: "implication_first",
        lengthBand: "medium",
        caveatPlacement: "upfront",
        quantification: "precise",
        soWhat: "implied",
        fidelity: "faithful",
      },
      {
        // Δ leadType
        text: "Up 31% year over year — though slower than Q1's 39% — Northwind's cloud segment reached $412M in Q2, 18% of company revenue. Total revenue grew only 4%, leaving cloud as effectively the group's entire growth engine.",
        leadType: "number_first",
        lengthBand: "medium",
        caveatPlacement: "upfront",
        quantification: "precise",
        soWhat: "implied",
        fidelity: "faithful",
      },
      {
        // Δ lengthBand
        text: "Cloud — decelerating from 39% — is still Northwind's whole growth story: +31% to $412M against 4% company-wide.",
        leadType: "implication_first",
        lengthBand: "short",
        caveatPlacement: "upfront",
        quantification: "precise",
        soWhat: "implied",
        fidelity: "faithful",
      },
      {
        // Δ lengthBand
        text: "Northwind has become a company whose growth lives almost entirely in one segment — although that segment is decelerating, from 39% growth in Q1 to 31% now. Cloud revenue reached $412M in Q2, up 31% year over year, and accounts for 18% of total revenue. The rest of the business barely moved, with company-wide revenue up just 4%.",
        leadType: "implication_first",
        lengthBand: "long",
        caveatPlacement: "upfront",
        quantification: "precise",
        soWhat: "implied",
        fidelity: "faithful",
      },
      {
        // Δ quantification
        text: "Cloud is now carrying Northwind's growth — though its pace has cooled noticeably from last quarter. The segment is expanding rapidly and now contributes nearly a fifth of revenue, while the rest of the business is close to flat.",
        leadType: "implication_first",
        lengthBand: "medium",
        caveatPlacement: "upfront",
        quantification: "qualitative",
        soWhat: "implied",
        fidelity: "faithful",
      },
      {
        // Δ fidelity — extrapolates the growth differential years forward
        text: "Even allowing for one quarter of deceleration, cloud has become Northwind's future: at $412M and growing 31% a year against 4% for the rest, it will double its 18% revenue share within two years and become the majority of the business.",
        leadType: "implication_first",
        lengthBand: "medium",
        caveatPlacement: "upfront",
        quantification: "precise",
        soWhat: "implied",
        fidelity: "overclaimed",
      },
    ],
  },
  // -------------------------------------------------------------------------
  // 3. Earnings — margin compression vs. EPS beat
  {
    title: "Atlas Retail: margin squeeze, EPS beat",
    domain: "earnings",
    contextSnippet:
      "**Atlas Retail — Q4:** Gross margin 31.4% (−180 bps YoY) · EPS $1.42 vs $1.35 guided · Drivers: markdowns, freight (incl. one-time contract renegotiation)",
    sourceLabel: "Atlas Retail Q4 FY25 earnings call (fictional)",
    truthSummary:
      "Atlas Retail's Q4 gross margin fell 1.8 points to 31.4%, driven by markdowns and higher freight costs. EPS of $1.42 still beat guidance of $1.35. A one-time freight contract renegotiation contributed to the cost pressure, so part of the margin decline may not repeat.",
    variants: [
      {
        // BASE
        text: "Gross margin fell nearly two points to about 31% in Q4 on markdowns and freight, yet EPS of roughly $1.40 still beat guidance. Focus pricing reviews on markdown depth. Note: a one-time freight renegotiation inflated costs, so some pressure won't repeat.",
        leadType: "number_first",
        lengthBand: "medium",
        caveatPlacement: "trailing",
        quantification: "rounded",
        soWhat: "explicit",
        fidelity: "faithful",
      },
      {
        // Δ leadType
        text: "Profitability is eroding at the gross line even as Atlas beats its targets: margin fell nearly two points to about 31% on markdowns and freight, while EPS of roughly $1.40 still topped guidance. Watch markdown depth. One-time freight costs mean some pressure won't repeat.",
        leadType: "implication_first",
        lengthBand: "medium",
        caveatPlacement: "trailing",
        quantification: "rounded",
        soWhat: "explicit",
        fidelity: "faithful",
      },
      {
        // Δ caveatPlacement
        text: "Even with a one-time freight renegotiation inflating costs — that part won't repeat — gross margin fell nearly two points to about 31% on markdowns and freight. EPS of roughly $1.40 still beat guidance. Focus pricing reviews on markdown depth.",
        leadType: "number_first",
        lengthBand: "medium",
        caveatPlacement: "upfront",
        quantification: "rounded",
        soWhat: "explicit",
        fidelity: "faithful",
      },
      {
        // Δ caveatPlacement
        text: "Gross margin fell nearly two points to about 31% in Q4 on markdowns and freight, yet EPS of roughly $1.40 still beat guidance. Focus pricing reviews on markdown depth, and track whether freight costs keep climbing next quarter.",
        leadType: "number_first",
        lengthBand: "medium",
        caveatPlacement: "omitted",
        quantification: "rounded",
        soWhat: "explicit",
        fidelity: "faithful",
      },
      {
        // Δ soWhat
        text: "Gross margin fell nearly two points to about 31% in Q4, pressured by markdowns and freight, yet EPS of roughly $1.40 still beat guidance. A one-time freight renegotiation inflated costs this quarter, so some of the pressure won't repeat.",
        leadType: "number_first",
        lengthBand: "medium",
        caveatPlacement: "trailing",
        quantification: "rounded",
        soWhat: "implied",
        fidelity: "faithful",
      },
      {
        // Δ fidelity — single-cause claim plus extrapolated trajectory
        text: "Gross margin fell nearly two points to about 31% because markdowns are out of control. Reprice now: on this trajectory margins break below 30% next year. EPS of roughly $1.40 still beat guidance, though quarterly cost swings add some noise.",
        leadType: "number_first",
        lengthBand: "medium",
        caveatPlacement: "trailing",
        quantification: "rounded",
        soWhat: "explicit",
        fidelity: "overclaimed",
      },
    ],
  },
  // -------------------------------------------------------------------------
  // 4. Econ — metro CPI cooling
  {
    title: "Riverton CPI: first sub-3% print in two years",
    domain: "econ",
    contextSnippet:
      "**Riverton metro CPI, May:** headline +2.9% YoY (April: +3.4%) · Shelter +5.1% YoY · First sub-3% print in 26 months",
    sourceLabel: "Riverton Metro Statistics Bureau, May CPI release (fictional)",
    truthSummary:
      "Metro-area consumer prices rose 2.9% year over year in May, down from 3.4% in April — the first reading below 3% in 26 months. Shelter inflation remained elevated at 5.1%. This is one month of a volatile series.",
    variants: [
      {
        // BASE
        text: "Inflation cooled to 2.9% in May from 3.4% in April — the first sub-3% reading in 26 months. Shelter, still rising 5.1%, remains the pressure point, so keep housing costs central in any budget planning. One month doesn't make a trend.",
        leadType: "number_first",
        lengthBand: "medium",
        caveatPlacement: "trailing",
        quantification: "precise",
        soWhat: "explicit",
        fidelity: "faithful",
      },
      {
        // Δ lengthBand
        text: "Headline inflation in the metro area came in at 2.9% year over year in May, down from 3.4% in April and the first reading under 3% in 26 months. Shelter costs, however, are still climbing at 5.1% and remain the main pressure point, so budget planning should keep housing front and center. Treat this as encouraging rather than conclusive: it is a single month of a volatile series.",
        leadType: "number_first",
        lengthBand: "long",
        caveatPlacement: "trailing",
        quantification: "precise",
        soWhat: "explicit",
        fidelity: "faithful",
      },
      {
        // Δ quantification
        text: "Inflation cooled to just under 3% in May from about 3.5% in April — the first sub-3% reading in over two years. Shelter, still rising around 5%, remains the pressure point, so keep housing costs central in budget planning. One month doesn't make a trend.",
        leadType: "number_first",
        lengthBand: "medium",
        caveatPlacement: "trailing",
        quantification: "rounded",
        soWhat: "explicit",
        fidelity: "faithful",
      },
      {
        // Δ quantification
        text: "Inflation cooled meaningfully in May, falling below the threshold it had held above for more than two years. Shelter costs are still rising briskly and remain the pressure point, so keep housing central in budget planning. One month doesn't make a trend.",
        leadType: "number_first",
        lengthBand: "medium",
        caveatPlacement: "trailing",
        quantification: "qualitative",
        soWhat: "explicit",
        fidelity: "faithful",
      },
      {
        // Δ soWhat
        text: "Inflation cooled to 2.9% in May from 3.4% in April — the first sub-3% reading in 26 months. Shelter is the holdout, still rising at 5.1% while the headline rate eases. One month of a volatile series doesn't make a trend.",
        leadType: "number_first",
        lengthBand: "medium",
        caveatPlacement: "trailing",
        quantification: "precise",
        soWhat: "implied",
        fidelity: "faithful",
      },
      {
        // Δ fidelity — declares victory and forecasts from one data point
        text: "At 2.9% in May, down from 3.4% in April, inflation is beaten — the two-year price surge is over and headed toward 2% by fall. Plan budgets on easing costs now; even shelter at 5.1% will follow the headline down, though monthly data wobbles.",
        leadType: "number_first",
        lengthBand: "medium",
        caveatPlacement: "trailing",
        quantification: "precise",
        soWhat: "explicit",
        fidelity: "overclaimed",
      },
    ],
  },
  // -------------------------------------------------------------------------
  // 5. Econ — small-business hiring index
  {
    title: "Small-business hiring index: third straight decline",
    domain: "econ",
    contextSnippet:
      "**Small-Business Hiring Index, June:** 94.1 (−3.0 pts, third straight decline) · Regional banks reporting tighter small-business lending for 2 consecutive quarters",
    sourceLabel: "Prairie Federation of Independent Business monthly survey (fictional)",
    truthSummary:
      "The regional small-business hiring index fell 3.0 points to 94.1 in June, its third consecutive monthly decline. The decline has coincided with banks tightening small-business lending standards for two quarters; the data shows correlation, not proven causation. The index is survey-based.",
    variants: [
      {
        // BASE
        text: "Caveat aside — this is survey data showing correlation, not cause — the hiring index fell 3.0 points to 94.1 in June, a third straight decline that tracks two quarters of tighter small-business lending. Watch credit conditions to anticipate where hiring goes next.",
        leadType: "number_first",
        lengthBand: "medium",
        caveatPlacement: "upfront",
        quantification: "precise",
        soWhat: "explicit",
        fidelity: "faithful",
      },
      {
        // Δ leadType
        text: "Small firms are pulling back on hiring — and while the survey shows correlation, not cause, the pullback tracks tighter credit. The index fell 3.0 points to 94.1 in June, its third straight decline, matching two quarters of stricter small-business lending. Watch credit conditions closely.",
        leadType: "implication_first",
        lengthBand: "medium",
        caveatPlacement: "upfront",
        quantification: "precise",
        soWhat: "explicit",
        fidelity: "faithful",
      },
      {
        // Δ leadType
        text: "Is tighter credit cooling small-business hiring? The survey can only show correlation, but the pattern fits: the index fell 3.0 points to 94.1 in June, a third straight decline alongside two quarters of stricter lending. Watch credit conditions to anticipate where hiring goes.",
        leadType: "question_first",
        lengthBand: "medium",
        caveatPlacement: "upfront",
        quantification: "precise",
        soWhat: "explicit",
        fidelity: "faithful",
      },
      {
        // Δ quantification
        text: "Set the caveat first: this is survey data, correlation not cause. Small-business hiring sentiment fell again in June — a third consecutive decline — sliding alongside stricter bank lending. Watch credit conditions to anticipate where hiring goes next.",
        leadType: "number_first",
        lengthBand: "medium",
        caveatPlacement: "upfront",
        quantification: "qualitative",
        soWhat: "explicit",
        fidelity: "faithful",
      },
      {
        // Δ soWhat
        text: "Even though this survey shows correlation rather than cause, the timing is notable: the hiring index fell 3.0 points to 94.1 in June, its third straight decline, coinciding with two quarters of tighter small-business lending standards.",
        leadType: "number_first",
        lengthBand: "medium",
        caveatPlacement: "upfront",
        quantification: "precise",
        soWhat: "implied",
        fidelity: "faithful",
      },
      {
        // Δ fidelity — asserts causation and forecasts continued decline
        text: "Survey-based, yes — but the picture is clear: the hiring index fell 3.0 points to 94.1 in June, the third straight decline, because banks have tightened lending. Expect hiring to keep falling until credit loosens; push any financing needs forward now.",
        leadType: "number_first",
        lengthBand: "medium",
        caveatPlacement: "upfront",
        quantification: "precise",
        soWhat: "explicit",
        fidelity: "overclaimed",
      },
    ],
  },
  // -------------------------------------------------------------------------
  // 6. Sports — three-point shift after coaching change
  {
    title: "Ridgeline Hawks: new shot diet, new results",
    domain: "sports",
    contextSnippet:
      "**Ridgeline Hawks, last 11 games (post-coaching change):** 3PT attempt rate 46% (season prior: 38%) · Record 8–3 · 6 of 11 opponents below .500",
    sourceLabel: "League play-by-play data through March 14 (fictional)",
    truthSummary:
      "Since the coaching change 11 games ago, the Ridgeline Hawks' three-point attempt rate rose from 38% to 46% of field-goal attempts, and the team has won 8 of those 11 games. It is a small sample, and 6 of the 11 opponents had losing records. A causal link between the new shot profile and the winning is not established.",
    variants: [
      {
        // BASE
        text: "The Hawks have reinvented their shot diet under the new coach — nearly half their attempts now come from three, up from just under forty percent — and they're winning: 8 of 11 since the change. Worth tracking, but it's a short stretch against a soft schedule.",
        leadType: "implication_first",
        lengthBand: "medium",
        caveatPlacement: "trailing",
        quantification: "rounded",
        soWhat: "explicit",
        fidelity: "faithful",
      },
      {
        // Δ lengthBand
        text: "The Hawks live behind the arc now and win — 8 of 11, albeit versus a soft slate. Track it.",
        leadType: "implication_first",
        lengthBand: "short",
        caveatPlacement: "trailing",
        quantification: "rounded",
        soWhat: "explicit",
        fidelity: "faithful",
      },
      {
        // Δ lengthBand
        text: "The Hawks have rebuilt their offense around the three-point shot since the coaching change, with close to half of all attempts now coming from deep, up from just under forty percent before. The results so far: eight wins in eleven games. Keep tracking the shot profile as the schedule stiffens — this is a short stretch, several of those opponents had losing records, and the connection between the new shot diet and the winning isn't yet proven.",
        leadType: "implication_first",
        lengthBand: "long",
        caveatPlacement: "trailing",
        quantification: "rounded",
        soWhat: "explicit",
        fidelity: "faithful",
      },
      {
        // Δ caveatPlacement
        text: "The Hawks have reinvented their shot diet under the new coach — nearly half their attempts now come from three, up from just under forty percent — and they're winning: 8 of 11 since the change. Track whether the new shot profile keeps producing wins.",
        leadType: "implication_first",
        lengthBand: "medium",
        caveatPlacement: "omitted",
        quantification: "rounded",
        soWhat: "explicit",
        fidelity: "faithful",
      },
      {
        // Δ soWhat
        text: "The Hawks have reinvented their shot diet under the new coach — nearly half their attempts now come from three, up from just under forty percent — and they've won 8 of 11 since the change. That said, it's a short stretch against a mostly soft schedule.",
        leadType: "implication_first",
        lengthBand: "medium",
        caveatPlacement: "trailing",
        quantification: "rounded",
        soWhat: "implied",
        fidelity: "faithful",
      },
      {
        // Δ fidelity — causal claim plus extrapolated win rate
        text: "The new offense is why the Hawks are winning: shifting nearly half their attempts to the three-point line has turned them into a contender at 8–3. Expect the win rate to hold as long as they keep shooting threes — though every team hits cold streaks.",
        leadType: "implication_first",
        lengthBand: "medium",
        caveatPlacement: "trailing",
        quantification: "rounded",
        soWhat: "explicit",
        fidelity: "overclaimed",
      },
    ],
  },
  // -------------------------------------------------------------------------
  // 7. Sports — xG underperformance
  {
    title: "Dario Ossola: finishing below the chances",
    domain: "sports",
    contextSnippet:
      "**Dario Ossola, league season to date:** 4 goals in 14 matches · 0.31 goals/90 vs 0.61 xG/90 · Shot volume: 2.9/90 (unchanged YoY)",
    sourceLabel: "OptaStyle match data, matchday 14 (fictional)",
    truthSummary:
      "Striker Dario Ossola has scored 4 goals in 14 league matches (0.31 per 90 minutes) against an expected-goals rate of 0.61 per 90, on unchanged shot volume — he is finishing well below the chance quality he receives. xG models differ between providers and 14 matches is a modest sample; underperformance of this size often, but not always, moves back toward expectation.",
    variants: [
      {
        // BASE
        text: "Is Ossola's scoring drought about chances or finishing? The data points at finishing: he's converting 0.31 goals per 90 against 0.61 expected, on unchanged shot volume. Underperformance this large often narrows, though xG models vary and 14 matches is a modest sample.",
        leadType: "question_first",
        lengthBand: "medium",
        caveatPlacement: "trailing",
        quantification: "precise",
        soWhat: "implied",
        fidelity: "faithful",
      },
      {
        // Δ leadType
        text: "Ossola is scoring 0.31 goals per 90 against an expected 0.61 — half the output his chances merit, on unchanged shot volume. Finishing, not service, is the problem. Underperformance this large often narrows, though xG models vary and 14 matches is a modest sample.",
        leadType: "number_first",
        lengthBand: "medium",
        caveatPlacement: "trailing",
        quantification: "precise",
        soWhat: "implied",
        fidelity: "faithful",
      },
      {
        // Δ lengthBand
        text: "Chances or finishing? Finishing: 0.31 goals per 90 versus 0.61 expected — though it's 14 matches.",
        leadType: "question_first",
        lengthBand: "short",
        caveatPlacement: "trailing",
        quantification: "precise",
        soWhat: "implied",
        fidelity: "faithful",
      },
      {
        // Δ caveatPlacement
        text: "How real is Ossola's drought? Allowing that xG models vary and 14 matches is a modest sample, the pattern is clear: 0.31 goals per 90 against 0.61 expected on unchanged shot volume — finishing, not chance creation, is what's lagging.",
        leadType: "question_first",
        lengthBand: "medium",
        caveatPlacement: "upfront",
        quantification: "precise",
        soWhat: "implied",
        fidelity: "faithful",
      },
      {
        // Δ quantification
        text: "Is Ossola's drought about chances or finishing? Finishing: he's scoring at roughly half his expected rate — about a goal every three matches when the chances say closer to two in three. Gaps like this often narrow, though xG models vary and the sample is modest.",
        leadType: "question_first",
        lengthBand: "medium",
        caveatPlacement: "trailing",
        quantification: "rounded",
        soWhat: "implied",
        fidelity: "faithful",
      },
      {
        // Δ fidelity — "regression guarantees" a rebound
        text: "How long can Ossola stay this unlucky? Not much longer: at 0.31 goals per 90 against 0.61 expected, regression guarantees a scoring surge — his output should double over the run-in. His shot volume hasn't changed, though a cold spell is always possible.",
        leadType: "question_first",
        lengthBand: "medium",
        caveatPlacement: "trailing",
        quantification: "precise",
        soWhat: "implied",
        fidelity: "overclaimed",
      },
    ],
  },
  // -------------------------------------------------------------------------
  // 8. Ops/security — phishing reports vs. credential entry
  {
    title: "Phishing: more reports, fewer victims",
    domain: "ops",
    contextSnippet:
      "**Phishing, Q3 vs Q2:** Reported attempts 1,847 vs 1,301 (+42%) · Credential-entry rate 1.9% vs 3.1% · Security-awareness training rolled out mid-Q2",
    sourceLabel: "SecOps quarterly metrics dashboard (fictional)",
    truthSummary:
      "Reported phishing attempts rose 42% quarter over quarter (1,847 vs 1,301), while the rate of employees entering credentials on phishing pages fell from 3.1% to 1.9%. The rise in reports may partly reflect better reporting awareness after the Q2 training rollout rather than more attacks; the training's causal effect is not established.",
    variants: [
      {
        // BASE
        text: "Employees are reporting more and falling for less: reported phishing rose 42% to 1,847 while credential-entry dropped from 3.1% to 1.9% after the training rollout. Keep the training cadence. Note the report spike may reflect awareness, not attack volume, and causality isn't established.",
        leadType: "implication_first",
        lengthBand: "medium",
        caveatPlacement: "trailing",
        quantification: "precise",
        soWhat: "explicit",
        fidelity: "faithful",
      },
      {
        // Δ leadType
        text: "Did the security training work? Signals point the right way: reported phishing rose 42% to 1,847 while credential-entry fell from 3.1% to 1.9%. Keep the training cadence. The report spike may reflect awareness rather than attack volume, and causality isn't established.",
        leadType: "question_first",
        lengthBand: "medium",
        caveatPlacement: "trailing",
        quantification: "precise",
        soWhat: "explicit",
        fidelity: "faithful",
      },
      {
        // Δ caveatPlacement
        text: "Employees are reporting more and falling for less: reported phishing rose 42% to 1,847 this quarter while the credential-entry rate dropped from 3.1% to 1.9% following the training rollout. Keep the training cadence and continue tracking both numbers quarterly.",
        leadType: "implication_first",
        lengthBand: "medium",
        caveatPlacement: "omitted",
        quantification: "precise",
        soWhat: "explicit",
        fidelity: "faithful",
      },
      {
        // Δ quantification
        text: "Employees are reporting more and falling for less: reported phishing rose about 40% to nearly 1,850 while credential-entry dropped from around 3% to 2% after the training rollout. Keep the training cadence. The report spike may reflect awareness, not attack volume; causality isn't established.",
        leadType: "implication_first",
        lengthBand: "medium",
        caveatPlacement: "trailing",
        quantification: "rounded",
        soWhat: "explicit",
        fidelity: "faithful",
      },
      {
        // Δ soWhat
        text: "Employees are reporting more and falling for less: reported phishing rose 42% to 1,847 while credential-entry dropped from 3.1% to 1.9% in the quarters around the training rollout. The report spike may reflect awareness rather than attack volume, and causality isn't established.",
        leadType: "implication_first",
        lengthBand: "medium",
        caveatPlacement: "trailing",
        quantification: "precise",
        soWhat: "implied",
        fidelity: "faithful",
      },
      {
        // Δ fidelity — asserts the training caused both moves, forecasts more
        text: "The training is working: it cut credential-entry by 39% — from 3.1% to 1.9% — and drove a 42% surge in threat reporting, to 1,847 catches. Expand the program to quarterly refreshers and expect click-through to keep falling, though phishing lures do evolve.",
        leadType: "implication_first",
        lengthBand: "medium",
        caveatPlacement: "trailing",
        quantification: "precise",
        soWhat: "explicit",
        fidelity: "overclaimed",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Tag validation — the tags are the product; fail loudly if any are wrong.
// Shared with the M2 generation validator: same rules, same tokenization
// (wordCount/bandFor live in src/lib/types.ts).

const ENUMS: Record<(typeof ATTRIBUTE_KEYS)[number], readonly string[]> = {
  leadType: LEAD_TYPES,
  lengthBand: LENGTH_BANDS,
  caveatPlacement: CAVEAT_PLACEMENTS,
  quantification: QUANTIFICATIONS,
  soWhat: SO_WHATS,
  fidelity: FIDELITIES,
};

function profileKey(v: AttributeProfile): string {
  return ATTRIBUTE_KEYS.map((k) => v[k]).join("|");
}

function validate(): void {
  const errors: string[] = [];
  for (const f of findings) {
    if (f.variants.length !== 6) {
      errors.push(`${f.title}: expected 6 variants, got ${f.variants.length}`);
    }
    const overclaims = f.variants.filter((v) => v.fidelity === "overclaimed");
    if (overclaims.length !== 1) {
      errors.push(`${f.title}: expected exactly 1 overclaimed variant, got ${overclaims.length}`);
    }
    // The overclaimed variant must pair with some faithful variant on a
    // fidelity-ONLY contrast — that head-to-head is the flagship experiment.
    for (const oc of overclaims) {
      const hasCleanPair = f.variants.some(
        (v) =>
          v.fidelity === "faithful" &&
          ATTRIBUTE_KEYS.filter((k) => v[k] !== oc[k]).length === 1
      );
      if (!hasCleanPair) {
        errors.push(`${f.title}: overclaimed variant has no fidelity-only contrast pair`);
      }
    }
    // No two variants may share a full attribute profile.
    const profiles = new Set<string>();
    for (const v of f.variants) {
      const key = profileKey(v);
      if (profiles.has(key)) errors.push(`${f.title}: duplicate attribute profile ${key}`);
      profiles.add(key);
    }
    f.variants.forEach((v, i) => {
      for (const k of ATTRIBUTE_KEYS) {
        if (!ENUMS[k].includes(v[k])) {
          errors.push(`${f.title} variant ${i + 1}: invalid ${k} value "${v[k]}"`);
        }
      }
      const words = wordCount(v.text);
      if (bandFor(words) !== v.lengthBand) {
        errors.push(
          `${f.title} variant ${i + 1}: tagged ${v.lengthBand} but has ${words} words (${bandFor(words)})`
        );
      }
    });
    // Report single-attribute-contrast pair count (design target: >= 5).
    let singles = 0;
    for (let i = 0; i < f.variants.length; i++) {
      for (let j = i + 1; j < f.variants.length; j++) {
        const diff = ATTRIBUTE_KEYS.filter((k) => f.variants[i][k] !== f.variants[j][k]);
        if (diff.length === 1) singles++;
      }
    }
    if (singles < 5) {
      errors.push(`${f.title}: only ${singles} single-attribute pairs (design target >= 5)`);
    }
  }
  if (errors.length > 0) {
    console.error("Seed validation failed:\n" + errors.map((e) => `  - ${e}`).join("\n"));
    process.exit(1);
  }
}

async function main(): Promise<void> {
  validate();

  // Idempotent re-seed: wipe in FK order. Comparisons reference variants, so
  // reseeding resets all votes — fine pre-launch, revisit before production.
  await prisma.comparison.deleteMany();
  await prisma.session.deleteMany();
  await prisma.variant.deleteMany();
  await prisma.finding.deleteMany();

  for (const f of findings) {
    await prisma.finding.create({
      data: {
        title: f.title,
        domain: f.domain,
        contextSnippet: f.contextSnippet,
        sourceLabel: f.sourceLabel,
        truthSummary: f.truthSummary,
        variants: { create: f.variants },
      },
    });
  }

  const counts = {
    findings: await prisma.finding.count(),
    variants: await prisma.variant.count(),
  };
  console.log(`Seeded ${counts.findings} findings, ${counts.variants} variants.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
