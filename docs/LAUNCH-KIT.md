# Launch kit — channel-ready

This is the operational companion to `LAUNCH-COPY.md`. That file holds the voice
and the reusable formats; this one is the plan: which channels, in what order,
with paste-ready text, and what to watch on `/admin` once the traffic lands.

**Live:** https://judgment-call.vercel.app · Rooms: **/train** · Study: **/results**

## The strategy in one line

Lead with the **calibration self-knowledge hook** ("find out how well-calibrated
you are"), let the **credential card** be the object people share, and let the
study be the second act. People click to learn about *themselves*, then stay for
the rooms. Keep the voice honest — this is a product about not overclaiming, so
no "revolutionary," no fake urgency.

## The share object

The most natural viral unit is the **Calibration Credential**: finish a run,
tap *Publish & copy link* on the room dashboard, and you get a
`/train/<track>/c/<slug>` card (score or `n/30` provisional, reliability curve,
honesty badges) that unfurls with a real OG image anywhere you drop it. Publish
your own first and lead posts with it where the format fits ("here's my
calibration — what's yours?").

## Sequencing (don't blast everything at once)

Concentrated bursts beat a slow trickle — the calibration score needs **n≥30**
staked calls and "The Room" verdicts need **n≥5** per item, so you want cohorts,
not a drip. Suggested order:

1. **Warm circle first** (Slack/DM/group chats) — 5–10 people who'll actually
   finish a run. This seeds "The Room" so the first public visitors don't all
   hit empty crowd tallies.
2. **One anchor post** on the channel that fits best (below). Watch `/admin`.
3. **A second channel a day or two later**, once you've seen where people drop
   off and tightened anything obvious.

Post when you can be around for the first few hours to answer replies — early
engagement is what carries a post.

---

## Channel drafts (paste-ready)

### Hacker News — Show HN

> **Show HN: A trainer that measures how well-calibrated your judgment is**
>
> Being right matters less than knowing *when* you're right — that's
> calibration, and almost nothing measures it. This does: you get a scenario
> (reading a statistic, or weighing a data-architecture tradeoff), you answer,
> then you stake how sure you are from 25% to 95%. It's scored with a proper
> rule, so over time the only way to win is to report what you actually believe —
> hedging loses, bluffing loses harder. After a dozen calls it plots your
> reliability curve: your confidence vs. how often you were actually right.
>
> The interactions aren't multiple-choice quizzes — you drag a 90% confidence
> interval until it's defensible, scrub a disease's base rate and watch false
> positives flood a grid until a positive test is a coin flip, pick a partition
> key and watch the load histogram expose the hot shard, or judge two designs
> against a constraint and see where a preregistered "desk" and the live crowd
> disagree with you.
>
> It grew out of a blind pairwise study on data storytelling (same finding,
> written two ways — pick the better one), which is still there under /results.
>
> https://judgment-call.vercel.app/train

*HN note:* expect "isn't this just a Brier score?" — yes, and that's the point;
be ready to explain the reliability-diagram decomposition and why ECE alone is
gameable (you already fixed that). Reply substantively, don't defend.

### r/dataengineering

> **I built a calibration trainer for data-architecture judgment (free, ~2 min)**
>
> Not a quiz — you judge two designs against a hard constraint (B-tree vs LSM
> under a tail-latency SLA, sync vs async replication for a ledger,
> consistent-hashing vs modulo for an autoscaling cache…), pick the fit, and
> stake how sure you are. Then three verdicts stack: **you**, **the room** (live
> crowd tally), and **the desk** (a preregistered rationale + the failure mode).
> You can be popular and wrong; the screen shows you which. There's also a
> partition-key bake-off where you pick a shard key and the load histogram
> reveals the hot shard.
>
> It scores your *calibration* — whether your confidence matches your accuracy —
> not just correctness. Curious how this community's dots land on the reliability
> curve.
>
> https://judgment-call.vercel.app/train/architecture

### r/statistics or r/datascience

> **A trainer that measures your statistical calibration, not just whether you're right**
>
> You get a scenario — a sampling trap, a base-rate screen, a regression-to-the-
> mean story, an A/B lift that might not be significant — answer, then stake
> 25–95% conviction. Proper scoring rule, so honest confidence is the only
> winning strategy. It draws your reliability curve after a dozen calls. Two of
> the interactions are worth trying: drag a 90% interval until it honestly
> captures the truth without being lazily wide, and scrub a prevalence slider to
> watch PPV collapse under a rare base rate.
>
> https://judgment-call.vercel.app/train/statistics

### LessWrong / ACX-adjacent (forecasting/rationalist)

> Calibration is the meta-skill under every forecast, it's trainable, and it
> decays without practice — yet you've probably never had yours measured on
> concrete domain reasoning (as opposed to trivia). I built a trainer that does:
> answer a statistics or data-architecture scenario, stake 25–95%, get scored
> with a proper rule (Brier skill score vs. an always-base-rate reference; ECE
> kept only as a diagnostic because it's gameable by hedging). It plots your
> reliability diagram and decomposes into reliability vs. resolution, so it
> rewards being *sharp*, not just calibrated. Interested in how this crowd's
> curves look.
>
> https://judgment-call.vercel.app/train

### LinkedIn

> The best analysts and engineers I know aren't the ones who are right most
> often — they're the ones who *know when they're right*. That's calibration,
> and it's measurable and trainable, yet almost nothing measures it.
>
> I built a small trainer that does. A scenario, you answer, then you stake your
> conviction (25–95%). It's scored with a proper rule, so the only way to win
> over time is to report what you actually believe — hedging loses, bluffing
> loses harder. After a dozen calls it plots your reliability curve and tells you,
> plainly, whether you lean over- or under-confident.
>
> Two rooms — reading **statistics** honestly, and weighing **data-architecture
> tradeoffs** — and neither is a multiple-choice quiz. If you read or build data
> for a living, I'd genuinely like your calibration:
>
> https://judgment-call.vercel.app/train

### X / Bluesky (short)

> Everyone thinks they're well-calibrated. Almost no one is.
>
> You answer, then stake how sure you are (25–95%). The math makes bluffing lose.
> After a dozen calls it draws the gap between how sure you felt and how right you
> were. Stats or data-architecture, ~2 min:
>
> judgment-call.vercel.app/train

### Slack / group chat (warm circle — post this first)

> made a thing that measures how well-calibrated you are — you answer, then stake
> how sure you are (25–95%), and after a dozen it plots your confidence vs how
> often you were actually right. mildly humbling. would love if a few of you ran
> it in the next hour so the crowd verdicts have something to show → 
> judgment-call.vercel.app/train

---

## What to watch on /admin (the funnel you already have)

Open `/admin?key=…` → **Training Rooms — circulation**. Per room, the path that
matters:

`entered → staked → n≥30 (score-eligible) → credential`

- **entered → staked drop-off high?** People start a run but don't stake
  conviction — an onboarding/comprehension problem. The first-run hint and the
  cold-start calibration card are your levers.
- **staked but few reach n≥30?** People try it once and don't come back for a
  full calibration score — a retention/hook problem. The Descent and the deeper
  pools (108 items) are the levers.
- **credential count near zero despite runs?** The share loop isn't firing — make
  the *Publish & copy link* moment more prominent, or prompt it at the recap.
- **"The Room x/y live (n≥5)"** climbing means duel/bake-off crowd verdicts are
  coming alive — that's the architecture room getting social proof.

For the **study** side, watch the desk calls on `/results` flip from "JURY'S OUT"
to CONCURS/OVERRULES as the busiest contrasts clear n≥30.

## Handling the obvious questions

- *"Is this just a Brier score?"* — Brier skill score is the headline, yes; the
  value is the reliability-diagram decomposition (reliability vs. resolution) and
  that it's on concrete domain reasoning, not trivia. ECE is a diagnostic only —
  it's gameable by hedging your base rate, which is why it isn't the score.
- *"How is the crowd/desk not just noise?"* — "The Room" is gated at n≥5 with an
  explicit empty state; the desk calls are preregistered and graded with Wilson
  intervals at n≥30. Nothing claims significance it hasn't earned.
- *"Data/privacy?"* — anonymous session id in localStorage; no accounts. (Say
  only what's true for your deployment.)
