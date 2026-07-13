# Launch & share copy

Two hooks now, not one. The original study ("same finding, two ways — pick the
better") is a slow build: the desk's 13 calls read "JURY'S OUT" until a contrast
clears n≥30, so it needs concentrated traffic before it comes alive. The
**Training Rooms** give a faster, more personal hook — *find out how
well-calibrated you actually are* — that pays off on the very first run and is
far more shareable. Lead with calibration; let the study be the second act.

Live: **https://judgment-call.vercel.app** · Rooms: **/train**
Voice note: this is a product about not overclaiming — the copy stays honest.
No "revolutionary," no fake urgency. Let the premise do the work.

---

## THE CALIBRATION HOOK (lead with this)

### 1 · The one-liner (DM, bio, link preview)

> Most people don't know the one thing that separates good judgment from lucky
> guessing: **calibration** — whether your confidence matches how often you're
> actually right. This measures yours in about two minutes.

### 2 · X / Bluesky / Mastodon (short)

> You answer, then you stake how sure you are — 25% to 95%. Get it right at 95%,
> small reward. Whiff at 95%, it stings. The math makes bluffing lose.
>
> After a dozen calls it draws your calibration curve: the gap between how sure
> you felt and how right you were. Statistics or data-architecture, your pick.
>
> judgment-call.vercel.app/train

Alt, sharper hook:

> Everyone thinks they're well-calibrated. Almost no one is. Find out where your
> confidence runs ahead of your accuracy — ~2 min, then it shows you the curve:
> judgment-call.vercel.app/train

### 3 · LinkedIn (professional, medium)

> The best analysts and engineers I know aren't the ones who are right most
> often — they're the ones who *know when they're right*. That's calibration,
> and it's measurable and trainable, yet almost nothing measures it.
>
> I built a small trainer that does. You get a scenario, you answer, then you
> stake your conviction (25–95%). It's scored with a proper rule, so the only
> way to win over time is to report what you actually believe — hedging loses,
> bluffing loses harder. After a dozen calls it plots your reliability curve and
> tells you, plainly, whether you lean over- or under-confident.
>
> Two rooms: reading **statistics** honestly, and weighing **data-architecture
> tradeoffs**. Interactive, not multiple-choice quizzes — you drag a confidence
> interval until it's defensible, you pick a partition key and watch the load
> histogram expose the hot shard, you judge two designs against a constraint and
> see where the room and the desk disagree with you.
>
> If you read or build data for a living, I'd like your calibration:
> https://judgment-call.vercel.app/train

### 4 · Newsletter / community drop (longer)

> **How well-calibrated are you? Almost no one knows.**
>
> Calibration is the match between your confidence and your accuracy — when you
> say you're 90% sure, are you right about 90% of the time? It's the meta-skill
> under every real decision, it's trainable, and it decays without practice. Yet
> you've probably never had it measured.
>
> Judgment Call's Training Rooms measure it. Each call is a scenario; you answer,
> then stake a conviction from 25% (chance) to 95% (locked in). Scoring uses a
> proper rule — reporting your true probability is the only winning strategy, so
> the game can't reward bluster. After a dozen calls you get a reliability
> diagram: your confidence on one axis, how often you were actually right on the
> other, against the line of perfect calibration. Most people's dots sag below
> it. That single picture is the most useful feedback a trainer can give.
>
> Two rooms, and neither is a plain quiz:
> - **Statistics** — spot the trap in a sampling story, then *drag* a 90%
>   interval until it's honestly wide; scrub a base rate and watch false
>   positives flood a grid.
> - **Data Architecture** — judge two designs against a hard constraint (and see
>   whether the crowd and a preregistered desk agree with you), or pick a
>   partition key and watch the load histogram reveal the hot shard.
>
> You climb a level ladder, you earn badges recomputed from your own record, and
> — the honest part — your calibration can go *down* if your confidence outruns
> your accuracy. Nothing is granted; everything is measured.
>
> **→ https://judgment-call.vercel.app/train**
>
> (There's also the original study it grew out of — you see one data finding
> told two ways and pick the better telling, blind; the crowd's preferences fall
> out of thousands of tagged pairwise votes, and a house desk has preregistered
> 13 opinionated calls it can be caught being wrong on. Two minutes:
> judgment-call.vercel.app)

### 5 · Slack / group chat (casual)

> made a thing that measures how well-calibrated you are — you answer, then stake
> how sure you are (25–95%), and after a dozen it plots your confidence vs how
> often you were actually right. mildly humbling. stats room or data-eng room,
> ~2 min → judgment-call.vercel.app/train

### 6 · The "why should I care" paragraph (reply / about page)

> Being right matters less than knowing *when* you're right. A forecaster who
> says 70% and is right 70% of the time is more useful than one who's confident
> and wrong a quarter of the time — you can act on the first and not the second.
> That's calibration. This trains and measures it with a proper scoring rule, so
> honest, well-sized confidence is the only thing that wins. Then it shows you
> the gap you didn't know you had.

---

## THE STUDY HOOK (the second act — for the /results docket)

Keep the original framing for people who came for the pairwise study, and for
the /calls/[n] share cards:

> Same finding, written two ways. Pick the better one. It's Chatbot Arena for
> data storytelling — blind pairwise votes, tagged by what differed, with a
> house desk that preregistered 13 opinionated calls the crowd grades live.
> judgment-call.vercel.app

---

## Distribution notes (for you, not for posting)

- **Two audiences, two hooks.** Calibration lands with forecasting/rationalist
  and quant-adjacent crowds and with any analyst/engineer who's been burned by
  false confidence — lead with /train there. The pairwise study lands with
  dataviz/journalism/"how should we write this finding" crowds — lead with
  /results there.
- **The share cards already work.** Each desk call has a `/calls/n` page with an
  OG image; personal results have a `/p/[slug]` poster; and the new
  **calibration credential** is a shareable, ledger-derived card — the most
  natural viral object here ("here's my calibration score / curve"). Any link
  you drop unfurls with a real card, no extra work.
- **What "success" looks like.** For /train, a first cohort large enough that the
  calibration scores (n≥30) and the bake-off / duel "The Room" verdicts (n≥5)
  turn live. For the study, n≥30 on the busiest contrasts so the desk's first
  verdicts flip from "JURY'S OUT" to CONCURS/OVERRULES. Concentrated bursts beat
  a slow trickle for both thresholds.
- **A hook that reliably converts:** lead with the *self-knowledge* promise
  ("find out where your confidence outruns your accuracy"), not the study
  framing — people click to learn about themselves, then stay for the rooms.
