# The home page 10x — competition & build record

The app quietly outgrew its own front door. It began as a single data-storytelling
study (swipe pairs, find your taste) and became a platform with a second
first-class experience — four calibration Training Rooms. But the landing still
had **one** CTA ("Make your first call") and buried the rooms as tile #03 in a
flat six-surface grid. This is the record of the four-firm competition that
10x'd the home page into a clean fork between the two experiences. The simulated
year is in **HOME-YEAR.md**.

## The brief

10x the home page so it forks cleanly into the two experiences — **the study**
(`start()` → `/swipe`: ~10 pairwise calls, then taste-vs-crowd/desk divergence,
live crowd count) and **the Training Rooms** (`/train`, plus the original room
`/drill`: four studios, stake-your-confidence calibration, levels/badges/exam) —
each made compelling, **without re-burying either**. Constraints: blinding
(craft-only landing, no fidelity vocabulary, no hint of the hidden experiment),
preserve the live crowd count and the returning-visitor continue path, DATUM
design language (hairline rules, mono+serif, restrained reduced-motion-safe
motion, and the law that *accent/light is earned* — one lit action), mobile-first,
buildable as a client `page.tsx` on existing endpoints with no new backend.

## The four firms

| Firm | Concept | Approach |
|---|---|---|
| A · Diptych | **Two Doors, One Desk** | Two equal-weight doors side by side; study fill-CTA, rooms outline-CTA. |
| B · Throughline | **The Calibration Desk** | One unifying thesis ("How good is your judgment, really?"), then a single primary study CTA + a secondary ghost rooms tile. |
| C · Instrument | **The Bench** | One instrument with an ARENA/RANGE toggle; one lit dial at a time. |
| **D · Two Jobs** | **The Fork in the Lamp** | Route by OUTCOME — two lit lanes named "I'm curious" / "I'm training"; hierarchy held by earned-light asymmetry, not by burying one. |

## The judging panel (scores out of 40)

Three judges — a **conversion strategist** (acquisition/activation), a **brand &
editorial director** (voice, positioning, DATUM integrity), and a
**design-engineer** (buildability, motion/a11y, mobile, who read the code).

| Firm | Conversion | Brand | Designer | **Total** |
|---|---:|---:|---:|---:|
| **D · Two Jobs** | 34 | 34 | 30 | **98** 🏆 |
| B · Calibration Desk | 33 | 33 | 33 | 99 |
| A · Diptych | 29 | 30 | 34 | 93 |
| C · The Bench | 20 | 28 | 24 | 72 |

**The decision — and an honest note on it.** The raw aggregate put **B** one point
ahead of **D**, 99–98. But the single hardest constraint in this brief is *fork
into both without **re-burying either***, and **two of the three judges
independently flagged B's fatal flaw**: it demotes the rooms to a secondary ghost
tile — "re-buries the exact surface the mandate says not to bury" (brand),
"flirts with the exact subordination the mandate forbids" (conversion). **D won
two of the three panels outright** (conversion and brand) and is, per the brand
judge, "the only one that satisfies all three [tell the truth · don't re-bury ·
earned light] at once." D's lone deduction — the designer's −4 — was for a *pitch
over-claim* about pre-selecting a segment via chips that don't exist in the file;
that copy is simply not built, so it is not a real cost. On the principled
tiebreak — the anti-burial mandate, which is decisive *for this brief* — the
winner is **D, THE FORK IN THE LAMP**.

**Key panel notes.**
- *Conversion (D ≻ B ≻ A ≻ C):* D's outcome-named lanes let a cold visitor
  self-sort "in one read" with both paths lit on first paint; it "maximizes total
  starts across BOTH experiences." **C eliminated outright** — a toggle that hides
  RANGE on first paint fails the core test.
- *Brand (D ≻ B ≻ A ≻ C):* D "uniquely resolves the brand contradiction" — both
  experiences lit and present, hierarchy held by *legitimate* earned-light
  asymmetry (only the study glows). Strongest line in the field: the rooms' "Get
  better at knowing when you're right."
- *Designer (A ≻ B ≻ D ≻ C):* A is the purest two-equal-doors build, but D reuses
  existing state + `cta-glow`/`count` with no new keyframes; C is docked for a
  `rule-draw`-restart flicker and hiding a door behind a tab.

## The winner & the synthesis

**Winner: Two Jobs' "THE FORK IN THE LAMP."** The grafts the panel converged on,
all shipped:

1. **Brand's thesis graft (from B).** The flat "Two ways in…" hero is retired for
   B's unifying, judgment-first line — **"How good is your judgment, really?"** —
   with the sub "The study reads where your taste diverges from the crowd. The
   rooms sharpen the calls you keep getting wrong." So the two outcome lanes read
   as one instrument doing two jobs, not two apps bolted together.
2. **Conversion's equal-weight graft.** Lane B (the rooms) is held at equal card
   size and weight with a **full** tappable CTA ("Enter the rooms →") — the glow
   differentiates priority without shrinking or demoting the training path.
3. **Designer's scope correction.** No segment chips are built; the returning
   effect still pre-selects `segment` silently, exactly as before — the working
   `start()` → `/api/session` → `/swipe` path is byte-for-byte intact.
4. **Surface index (from A).** The six secondary surfaces are re-sorted into two
   labelled groups — **"Inside the study"** (Results·live, Review, The Desk's
   Calls, Bring your data, Methods) and **"Inside the rooms"** (the Training Rooms
   hub + the original Data Storytelling room) — so the console reinforces the fork
   instead of flattening it.
5. **The shared heartbeat (from C's "one lamp").** The live crowd count stays as
   the shared proof-of-life above the fork; only the study's CTA carries accent.

## What shipped in v1

- A rebuilt `src/app/page.tsx`: nameplate + LIVE line + DATUM beam, then the
  unifying thesis + the shared live count, then **two equal lit lanes** — "I'm
  curious" (the study, glowing CTA, returning-aware) and "I'm training" (the
  rooms, full ink CTA → `/train`) — then the two-group surface index.
- All working logic preserved: `start()`, both `useEffect` fetches
  (`/api/crowd`, `/api/results`), `returning`/`totals`/`segment`. No new state, no
  new backend, no new keyframes — every animation reuses the existing
  reduced-motion-guarded classes (`hero-line`, `rule-draw`, `double-rule`,
  `count`, `cta-glow`).

Verified: `tsc` clean, eslint clean, bundle-guard **blinding PASS** (the landing
stays craft-only), build green, and Playwright confirmed both lanes render with
their CTAs above the fold on a phone viewport and side-by-side on desktop, with
the returning-visitor "Continue your run" state intact.
