// "Spot the overclaim" drill items — training content, fully separate from
// study findings. Each pairs a faithful telling with an overclaimed one built
// on exactly ONE overclaim device, and the explanation names the device and
// walks the claims ledger (what was claimed vs. what the data supports).
// All data fictional, like the study findings.

export type DrillSeed = {
  title: string;
  contextSnippet: string;
  sourceLabel: string;
  faithfulText: string;
  overclaimedText: string;
  explanation: string;
  device: string;
};

export const DRILL_SEEDS: DrillSeed[] = [
  {
    title: "Churn after the price change",
    contextSnippet:
      "**Meridian SaaS, Q2:** monthly churn 3.1% (was 2.6% pre-change) · price +12% in April · net revenue retention 104% (was 106%) · exit surveys: 41% of churned cite price",
    sourceLabel: "Meridian revenue ops dashboard (fictional)",
    faithfulText:
      "Churn rose from 2.6% to 3.1% monthly after April's 12% price increase, and 41% of leavers cite price. Net retention slipped two points but held above 100% — the increase is net-positive so far, worth rechecking after a full quarter.",
    overclaimedText:
      "Churn rose from 2.6% to 3.1% monthly because of April's 12% price increase — 41% of leavers cite price. Net retention slipped two points but held above 100%, so the increase is net-positive.",
    explanation:
      "The data shows churn rose AFTER the price change and that 41% of churned users mention price — an association plus a partial survey signal. \"Because of\" converts that into a proven cause: 59% of leavers cited something else, and nothing rules out seasonality or the redesign shipped the same month. The faithful telling keeps the timeline and the survey share without asserting the mechanism.",
    device: "causal language on an association",
  },
  {
    title: "The pilot program's early results",
    contextSnippet:
      "**Fieldstone Logistics pilot, 6 weeks:** 2 depots (of 40) · on-time delivery 87% → 93% at pilot depots · control depots flat at 86% · pilot depots were volunteer sites",
    sourceLabel: "Fieldstone ops pilot readout (fictional)",
    faithfulText:
      "Six weeks in, the two volunteer pilot depots improved on-time delivery from 87% to 93% while controls stayed flat. Promising — but volunteer sites tend to outperform, so the gain may shrink when the rollout hits the other 38.",
    overclaimedText:
      "Six weeks in, pilot depots improved on-time delivery from 87% to 93% while controls stayed flat. Rolling this out network-wide takes on-time performance to 93% across all 40 depots.",
    explanation:
      "Two volunteer depots over six weeks support a claim about those depots, not about all 40. The overclaim extrapolates a hand-picked sample to the whole network and quietly drops the selection effect the context states outright (volunteer sites). The faithful telling reports the same numbers and names the reason the effect may not travel.",
    device: "extrapolating a selected sample to the population",
  },
  {
    title: "Support tickets after the redesign",
    contextSnippet:
      "**Support volume, launch month:** tickets +18% MoM · seasonal norm for launch months: +10–15% · 'how do I…' category +42% · CSAT stable at 4.4",
    sourceLabel: "Helpdesk monthly export (fictional)",
    faithfulText:
      "Tickets rose 18% in launch month — a few points above the 10–15% seasonal norm — with 'how do I' questions up 42% and satisfaction flat. Reads as onboarding friction from the redesign, though only the excess over the seasonal band is attributable.",
    overclaimedText:
      "The redesign drove tickets up 18% in launch month, with 'how do I' questions up 42% even as satisfaction held. Onboarding friction is generating roughly a fifth more support load.",
    explanation:
      "The context says launch months normally run +10–15%: most of the 18% rise is seasonal baseline, so attributing the full rise to the redesign inflates the effect roughly threefold. The faithful telling subtracts the base rate; the overclaim ignores it — the classic missing-denominator move.",
    device: "ignoring the base rate",
  },
  {
    title: "The A/B test that 'won'",
    contextSnippet:
      "**Checkout copy test:** variant B conversion 4.6% vs A 4.4% · n = 3,900 per arm · 95% CI on the lift: −0.2pp to +0.6pp · test ran 11 of planned 14 days",
    sourceLabel: "Experiment platform readout (fictional)",
    faithfulText:
      "Variant B converted at 4.6% vs 4.4% — a lift whose confidence interval still spans zero (−0.2 to +0.6 points) with three days left in the plan. Directionally encouraging; not yet a result.",
    overclaimedText:
      "Variant B lifted checkout conversion from 4.4% to 4.6% — a 4.5% relative gain. Ship B and bank the lift before the quarter closes.",
    explanation:
      "The interval −0.2pp to +0.6pp includes zero: the data is consistent with no effect at all, and the test hasn't finished its planned window. The overclaim states the point estimate as a banked gain and adds urgency. The faithful telling gives the same numbers with the interval doing its job.",
    device: "treating a noisy point estimate as settled",
  },
  {
    title: "Headcount and shipping velocity",
    contextSnippet:
      "**Platform team, 2 quarters:** headcount 14 → 19 · story points shipped +9% · cycle time p50 unchanged · two new hires still onboarding · point inflation not audited",
    sourceLabel: "Engineering ops quarterly (fictional)",
    faithfulText:
      "After growing the team from 14 to 19, shipped story points are up 9% with median cycle time flat. Modest so far — two hires are still ramping, and points haven't been audited for inflation, so read the 9% loosely.",
    overclaimedText:
      "Growing the team from 14 to 19 lifted delivery 9% with cycle time holding steady — the hiring plan is paying for itself. Scaling to 24 should compound the gain.",
    explanation:
      "A 36% headcount increase yielding +9% output with unaudited point inflation is weak evidence the plan is 'paying for itself', and nothing in the data supports the linear projection to 24 heads. Two overreaches: declaring ROI the data can't show, then extrapolating it. The faithful telling flags both soft spots the context provides.",
    device: "unsupported projection from a weak effect",
  },
  {
    title: "Regional sales after the campaign",
    contextSnippet:
      "**Northwest campaign, 8 weeks:** NW revenue +11% YoY · national revenue +8% YoY · campaign reached ~30% of NW accounts · no holdout group",
    sourceLabel: "Sales analytics weekly (fictional)",
    faithfulText:
      "Northwest revenue grew 11% year-over-year during the campaign, three points ahead of the 8% national trend. Without a holdout we can't isolate the campaign's share of those three points — the premium is consistent with impact, not proof of it.",
    overclaimedText:
      "The campaign delivered 11% revenue growth in the Northwest — three points above the national trend. That's the campaign generating an extra three points of growth on 30% account coverage.",
    explanation:
      "With no holdout, the three-point regional premium can't be attributed to the campaign — regions routinely diverge from the national average for reasons no one measured. The overclaim converts the whole residual into campaign effect and dresses it in precision ('an extra three points'). The faithful telling reports the same premium and says exactly what's missing.",
    device: "attributing a residual without a control",
  },
];
