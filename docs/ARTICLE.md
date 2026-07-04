# I built a Chatbot Arena for business insights. Here's what 10,000 judgment calls say about how data should talk.

*Draft for Medium. Embed placeholders marked `[EMBED: …]`. Numbers marked `{LIVE}`
are pulled from /results on publication day — do not hardcode them earlier.*

---

You've seen the two versions of the same chart headline. One says:

> Gross margin fell 180 bps YoY to 31.4% in Q4, driven by markdowns and freight.

The other says:

> Margins are slipping — and pricing is why. Fix markdowns first.

Same data. Different telling. One of them gets quoted in the Monday meeting.

Which one? That's an empirical question, and almost nobody treats it like one. We
A/B test subject lines and button colors, then write the actual insight — the
sentence a decision rides on — by feel.

So I built the experiment: **Judgment Call**, a pairwise preference arena for data
insights. You see two tellings of the same finding, tap the better one, and after
ten calls you get your own "taste profile." Behind the taps, every telling carries
a craft fingerprint — where it leads, how long it runs, where the caveat sits, how
precise the numbers are, whether the so-what is spelled out — and every vote is a
controlled contrast on exactly one of those attributes.

**Try it before you read on — it takes 90 seconds:** [judgment-call.vercel.app](https://judgment-call.vercel.app)

## How the measurement works

Chess players have Elo. LLMs have Chatbot Arena. Business insights now have the
same machinery:

- Two tellings of one finding, identical facts, differing on **one attribute**.
- Left/right placement randomized server-side; position bias is monitored publicly
  (left is currently winning {LIVE: position rate} of decided votes — an interval
  containing 50% is the null behaving itself).
- Win rates carry Wilson 95% intervals and stay hidden until a contrast reaches
  n≥30 — the site shows an honest hatched "collecting" bar instead of a premature
  percentage.
- Votes under 0.8 seconds, repeats, and "can't decide" are logged but excluded
  from the published statistics. The exclusion rules were fixed before data
  collection, in a preregistration committed to the public repo.

[EMBED: iframe https://judgment-call.vercel.app/results?embed=1 — full live results]

## What the room has learned so far

{LIVE: pull the 2–3 strongest published contrasts and write one paragraph each.
Template below.}

**{Value A} beats {value B}, {rate}% (n={n}).** {One-paragraph interpretation —
what a writer of insights should do differently tomorrow morning.}

[EMBED: deep link https://judgment-call.vercel.app/results#<anchor> for each
contrast discussed]

Executives and analysts don't always agree. The live "disagreement view" puts both
segments on one gauge — the gap between the marks is the point:

[EMBED: screenshot or iframe of the Executives vs. analysts section]

## The experiment I haven't told you about

Some of the tellings in the arena are lying to you. Not with numbers — every
figure is accurate — but with language: causal claims on correlational data, a
trend quietly extrapolated, certainty inflated a notch past what the data holds.
Each one is paired against a faithful telling of the same finding, and the only
difference is the overreach.

This is the flagship question: **does punchy-but-overclaimed beat
accurate-but-hedged?** If yes — if the overclaimed telling wins its head-to-heads —
that's a measured, quantified account of why your feed reads the way it does.

{LIVE: report only if the fidelity arm has cleared its preregistered threshold;
otherwise: "The sample hasn't crossed its preregistered reporting threshold yet —
the number publishes on the live site when it does, whichever way it lands."}

Two design notes for the skeptics (the full methods live on the results page):

1. **You can't game what you can't see.** Which tellings are the plants is never
   revealed while voting — they're invisible in your personal results, excluded
   from public stats, and even the XP system pays identical rewards across hidden
   arms so the reward stream can't fingerprint them.
2. **Overclaims never touch real companies.** Findings built from real SEC filings
   and federal data (yes, the arena runs on real sources — every real-data card
   links its source) never receive a deliberately overclaimed telling. The plants
   live only on aggregate and fictional findings.

## Train yourself to catch it

The arena has a training room: **Spot the Overclaim** — two tellings, one subtly
exceeds its data, immediate feedback with the exact device named, and your own
drill rating that moves like a chess puzzle score.

And because every vote records whether the voter had drilled first, the study gets
a second experiment for free: **do trained judges resist overclaims better?**
{LIVE: report the naive-vs-trained cut when defensible.}

[LINK: https://judgment-call.vercel.app/drill]

## Judge it yourself

Ten calls. Ninety seconds. No sign-up. You'll get your taste profile — I'm
{LIVE: author persona title} — and your votes feed every number in this article,
all of which update live.

**[judgment-call.vercel.app](https://judgment-call.vercel.app)**

The methodology, preregistration, and code are public:
[github.com/jamessvolos/JudgmentCall](https://github.com/jamessvolos/JudgmentCall).
Disagree with a design choice? The repo takes issues.

---

*Checklist before publishing:*
- [ ] Replace every `{LIVE}` with numbers from /results that day; cite the snapshot id from the Study Log.
- [ ] Verify the fidelity arm against docs/PREREGISTRATION.md thresholds before mentioning any rate.
- [ ] Add `?utm_source=medium` to every link (the funnel panel tracks it).
- [ ] Test both embeds in Medium's iframe sandbox.
- [ ] Screenshot fallbacks for embeds (Medium sometimes strips iframes — use images linking out).
