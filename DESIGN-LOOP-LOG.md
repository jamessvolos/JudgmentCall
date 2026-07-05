# Design loop — round reflections

Round-by-round record of the DESIGN LOOP (bleeding-edge, hard-rules-first).
Each entry: the move attempted, why it was (or wasn't) a clear win, what was
learned, and current design momentum. Convergence rounds (no change justified)
are recorded here too — restraint is a valid outcome.

The hard rules are the constitution of the interface: no differentiation on/
between the two voting cards; the uniform collecting state never splits;
instruments stay disciplined; nothing loops (the DATUM language retired the
aurora — stillness = precision); everything blinding-safe.

---

## 2026-07-04 · Results §02 ranked by decisiveness

**Move.** The public /results attribute head-to-heads (§02) were ordered by
sample size (`n desc`, from `analytics.tallyToStats`), so the reader's eye
landed first on the most-*voted* contrasts — which happen to be `TOO CLOSE TO
CALL` straddlers — while the one contrast that actually **resolved** (its Wilson
interval clears the 50% null, carrying the red `ROOM OVERRULES` chip) was buried
sixth. The page's emotional core — the room deciding, and overruling the desk in
public — was scattered by accident of turnout. Re-ranked §02 by **how firmly the
room has settled each call**: tier 0 resolved (by how far the interval clears the
null), tier 1 sampled-but-straddling (most data first), tier 2 the suppressed /
un-voted block. Added the one missing section intro line naming the order.

**Why it's a win (medium leverage).** It amplifies an emotional beat that already
existed but was mis-ranked, at zero decorative cost — a pure information-hierarchy
fix in the page's own Wilson-first vocabulary. The decisive verdict + the
`ROOM OVERRULES` red chip now lead where the eye first lands; the §01 standing
tally becomes findable above the rows it describes. Tiny, safe diff (a `.sort`
plus a two-line helper; no new component, no new motion, no new token).

**Hard-rules + blinding pass.** Voting cards untouched (they live on /swipe).
The uniform collecting state is *strengthened*: every `n < MIN_N` row collapses
into one contiguous tier-2 block (stable-sorted, undifferentiated) instead of
trailing by coincidence of `n desc` — no suppressed row is split or restyled.
Instruments unchanged (reorder only, no flash, no position animation),
reduced-motion unaffected, nothing loops. The sort key reads only published
craft `rate / interval / n`; fidelity is dropped from `attributeStats`
(`analytics.ts`) before it can reach this section, so ranking craft contrasts by
craft decisiveness exposes nothing about the hidden experiment. Verified: tsc 0,
lint clean, build OK; re-screenshotted /results dark+light at 1280 — the
resolved `ROOM OVERRULES` row now leads, the two `COLLECTING` rows sit together
as one uniform block at the bottom.

**Learned / momentum.** On an instrument-dense surface, "bleeding edge" means
*clarity*, not effects — the highest-leverage move was surfacing drama the data
already held, not adding any. The restraint elsewhere on /results is right and
was left alone. Rejected as lower-leverage or rule-violating: a "drama sort"
floating overrules above concurrences (makes the instrument editorialize —
violates instrument discipline); promoting the §01 tally into a hero readout
(decorative duplication, downstream of this fix). Momentum: strong; the public
surfaces (landing just reimagined as the Live Console, results now self-ranking)
cohere around earned-light + Wilson-honest instruments.

## 2026-07-04 · Fresh-eyes pass on Review + voting surface — converged (no change)

**Explored.** Fresh-eyed the two energy surfaces not touched earlier this
session: drove a 10-vote session and screenshotted **/review** (light + dark,
1280 + 390), and re-checked the **/swipe voting surface** at a mid-run state.

**Why no change (all clear a high bar already).**
- **/review** reads as polished and coherent with the reimagined landing +
  ranked results: masthead + datum beam, the "vs the desk 5/8" readout, and
  per-call caliper rows *self-differentiated by verdict stamp* (HUNG JURY /
  WITH THE ROOM / YOU OVERRULED THE DESK / DESK CONCURS), so unlike the results
  aggregate it needs no re-ranking — and a personal run is inherently
  chronological, so reordering would misrepresent it. Hard rule held: the two
  `JURY'S STILL OUT` rows render uniformly (hatched, no caliper dot), the
  collecting state intact.
- **/swipe voting cards** confirmed perfectly neutral — identical border /
  bg-card / serif / top rule-mark, zero color/accent/motion between them; tally
  and finding panel disciplined. The most-protected surface; left untouched.
- **Poster** was reimagined as a "big swing" in a prior session and rebuilt in
  lockstep with its OG twin; not re-opened this round.

**Move attempted / result.** A genuine fresh-eyes critique, not a change: no
frontier/aliveness leap presents itself that clears the hard-rule bar without
manufacturing. Convergence recorded per the stop condition — not changing to
stay busy.

**Momentum.** Strong. The public surfaces cohere around the DATUM instrument
language after this session's landing reimagining + results decisiveness
ranking. Next candidates when a real opportunity surfaces: elevating the
/review personal-stat readout toward the /results lit-instrument treatment
(coherence, medium leverage) and a fresh poster pass — both deferred as
polish, not leaps, this round.

## 2026-07-04 · Poster fresh-eyed — full surface coverage; converged (no change)

**Explored.** Closed the one coverage gap: drove two full 10-vote runs to fire
the milestone **poster** (TastePoster) and screenshotted it in light + dark —
the surface deferred every prior round this session. With it, every energy
surface has now been fresh-eyed this session: landing (reimagined as the Live
Console), results (§02 ranked by decisiveness), review (examined), the voting
cards (confirmed neutral), and the poster.

**Poster read + hard-rules audit.** A polished "printed spec plate": corner
registration marks, serial (NO. 3146), a generated serif persona title, five
dot-leader CRAFT attribute rows (length / lead / numbers / caveats / so-what),
the honest "leanings, not findings" line, and the blinding-safe "the public
link shows this poster only — never your individual votes." Hard rules hold: no
voting cards, no collecting-state to split, instruments disciplined, entrance-
only motion (nothing loops, theme-stable poster tokens by design), and only the
five craft attributes appear — no fidelity attribute, no experiment leakage.

**Result.** No frontier/aliveness leap presents itself on any surface that
clears the hard-rule bar without manufacturing — the public surfaces are mature
and cohere around the DATUM instrument language after this session's landing
reimagining + results ranking. Fully-informed convergence.

**Standing policy to avoid churn.** All energy surfaces are now covered and
coherent. Absent a *new* surface, new content/personas to show, or a specific
named opportunity worth implementing (the two on file — elevating the /review
personal-stat readout, a poster refresh — are polish, not leaps, and the
/review one is a semantic mismatch: /review is personal, not "live"), further
design rounds should converge quickly rather than re-drive a full screenshot
sweep. The next real entry should coincide with a genuine bold move.
