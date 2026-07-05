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

## 2026-07-05 · The Training Room — a new energy surface (10-wave build)

**Move (radical, structural).** Rebuilt `/drill` from a single 6-item "spot the
overclaim" quiz into **The Training Room**, a data-insight skills studio, over a
10-wave build. New: a skill dashboard (rating + rank, a mode picker, and a full
per-skill mastery map grouped into two families — fidelity vs craft), three
playable exercise modes (Spot / Fix / Calibrate), a deep authored+reviewed item
pool (6 → 35 items across 3 modes and 10 skills, difficulty-tiered), a
tappable skill map that drills a single skill (curriculum "practice this
weakness"), and a session recap (skills practiced + carry-forward tells for
missed skills). Backed by a mode-aware serving/grading API and a per-skill
progress aggregate; content ships via an idempotent build-time sync.

**Why it's a win (high leverage, new surface).** This is the "10x the training"
mandate realized: a data scientist now has a reason to return — different *types*
of insight learning (catch the overreach, repair the telling, calibrate the
claim) across a visible mastery map, not one repeated quiz. The Calibrate mode in
particular teaches base-rate-aware claim calibration, exactly the DS judgment the
product is about. Verified end-to-end (all three modes grade correctly via the
live API) and shipped to production.

**Hard-rules + blinding audit.** The Training Room is `/drill` — the sanctioned
teaching surface, wholly separate from the study. The voting-card neutrality rule
governs the STUDY's two cards on `/swipe` (untouched here); the drill's spot-mode
A/B is *meant* to differentiate after an answer (that's the teaching), which is
allowed only on this surface and always has been. No STILL COLLECTING / JURY'S
STILL OUT state exists on the drill. Instruments (rating, difficulty pips,
mastery bars) are disciplined and static. Motion is entrance-only (`rise`), no
continuous loops, reduced-motion respected. Blinding held under the strongest
test: the drill is where overclaim vocabulary is *permitted*, and the bundle
guard confirms the teaching chunk stays drill-only while the canonical grep on
client chunks is empty — so none of the new craft/fidelity content leaked to a
study surface. Six test suites pass incl. a new content-integrity test (every
choice item has exactly one correct answer).

**Learned / momentum.** The biggest "bold" moves this session were *architecture*
— reframing a quiz as a studio with a skill map and multiple exercise types —
more than visual effects, consistent with the landing lesson. Momentum: strong; a
whole new energy surface now exists and coheres with the DATUM language. Future
polish candidates (deferred, not leaps): an active-recall "name the move" beat
before the reveal, difficulty-escalation tuning as attempts accumulate, and a
concept-card intro when a single skill is focused.

## 2026-07-05 · Landing restructured — action-first, single start point

**Move (bold, structural).** Reworked the landing hero after a fresh read (and
direct user push that it "could be better"). Three coupled changes: (1) collapsed
the two-tier headline to one clean bold statement — the muted full-size
continuation had padded the H1 into a ~5-line grey block that dominated the first
screen; (2) lifted the entire start block — primary CTA, the
`ten calls · ~90s · no sign-up` reassurance, and the optional seat-tag chips — up
into the hero, so the one action is reachable above the fold instead of ~1,100px
down; (3) deleted the now-duplicate full-width "01 Vote" console panel and
renumbered the remaining tiles 01–06 under a "Six ways to go deeper" rule. New
read: live count → headline → benefit → **start + seat** → specimen (proof) →
six ways to go deeper → the desk on the record.

**Why it's a win (high leverage).** The prior page made a visitor scroll past the
hero *and* the specimen to find the only start button, and stated the mechanic
twice (headline + specimen caption) — a real conversion leak plus visual bloat.
The restructure puts action first, removes the grey wall, and kills the
redundancy, at zero new component/motion cost (relocation + deletion, same
`start()`/seat handlers). Verified desktop + mobile, light + dark; the CTA now
lands in the first screen at both widths.

**Hard-rules + blinding pass.** Voting cards untouched (they live on /swipe; no
diff). No collecting/JURY'S-STILL-OUT state on the landing to split. Instruments
unchanged. Motion: the block uses the existing entrance-only `hero-line` stagger
(`--i`) — no new continuous motion, reduced-motion unaffected, nothing loops. The
inert two-telling specimen still emits nothing (no accent/beam/glow), preserving
the demonstrative-pair neutrality rule. Blinding held: copy frames the pick as
which telling you *like* / is "better" to you — pure preference, never a correct
answer or hidden test; canonical grep on client chunks empty, bundle guard PASS
(~200KB), no fidelity vocabulary. Shipped to production (`1c276b3`).

**Learned / momentum.** On a mature surface, the highest-leverage "bold" move was
information *architecture*, not effects — sequencing the page around the single
action and cutting a duplicate. Momentum: strong; the landing is the one surface
in active iteration with the user, so further landing changes should follow their
direction rather than autonomous churn. The other energy surfaces (results,
review, drill, poster) remain mature and were re-confirmed clean in recent rounds
— no new autonomous bold move presents itself there this round.

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
