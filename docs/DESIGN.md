# The Desk Edition — Judgment Call design system

The product is a scientific instrument disguised as a 90-second game. Every
screen is treated like a page from a newspaper graphics desk: warm paper,
hairline and double rules, a text serif carrying the hero content, a mono
"data voice" for everything numeric or methodological. Nothing decorates;
everything annotates.

All tokens live in `src/app/globals.css` (`:root` + `@theme inline`). Use the
Tailwind utilities they generate (`bg-wash`, `border-rule-strong`, `text-danger`,
`rounded-card`…) — never raw hex.

## Voices

| Voice | Face | Use |
|---|---|---|
| **Serif** (`font-serif`, Source Serif 4) | the hero | tellings, headlines, persona titles, deck copy |
| **Mono** (`font-mono`, IBM Plex Mono) | the data | masthead, kickers, n-counts, intervals, buttons, footnotes — every number is `tabular-nums` |
| Sans (system) | plain prose | body sentences, form labels |

Utility classes: `.masthead` (caps, 0.3em tracking), `.kicker` (caps mono
section label), `.double-rule` (2px + offset 1px — the signature mark).

## Color law

- `--accent` (press blue) is **earned by data**: it appears on measured,
  published values (calipers, earned heatmap cells, calibration matches) and
  primary CTAs. Below n≥30, surfaces are ink-only with **hatched** fills
  (`repeating-linear-gradient(-45deg, var(--card-border) …)`).
- `--danger` appears **only on graded surfaces** (drill verdicts, calibration
  misses, errors) — never on taste, which has no wrong answer.
- **The instrument rule:** no accent on or between the two voting cards, ever.
  Card affordance = `--rule → --rule-strong` border shift + shadow lift,
  identical on both sides. Anything beyond position could cue a preference.
- Poster tokens (`--poster-*`) are theme-stable: the taste poster is "printed,"
  identical in light and dark.

## Instruments (reuse these, don't invent new chart forms)

- **Caliper gauge** (`/results` ContrastRow, review crowd rows, OG images):
  1px track, quarter ticks, strong 50% null line, Wilson interval as a
  bracket (`border-x-2 border-t-2 border-accent`), point estimate as a filled
  8px dot. Two-population variant: filled dot vs hollow ring on one track.
  Verdict chips: `INTERVAL CLEARS 50` (accent) / `STRADDLES 50` (muted).
- **Hatched collecting bar**: the honest suppressed state. Never show a
  percentage below threshold; never differentiate *why* something is
  collecting (blinding — suppressed craft, multi-attribute, and fidelity
  pairs must be indistinguishable).
- **Tally meter** (swipe folio): 3px ticks, notch-pop on the newest, 3-pulse
  beckon on the 10th at 9/10.
- **Stamps** (graded moments only): rotated `rounded-chip border-2` mono caps
  — LOGGED (ink), FAITHFUL (ink), OVERCLAIMED / MISSED (danger),
  MATCHED (accent).
- **Dot-leader index lines** (poster): mono attr · serif value · dotted
  leader · `n/n`.

## The alive layer (2026-07 direction shift)

The Desk Edition's information design stays; its *atmosphere* got voltage.
Three additions, all environmental, none allowed near an instrument:

- **Night desk palette**: dark mode drops warm paper for a deep cool blue
  (`oklch(0.168 0.016 265)` field) with an electric accent — same rules,
  higher contrast. Light mode remains paper.
- **Grain** (`body::after`): one static SVG-noise sheet at 5–7% opacity over
  every page, so flat fills read as stock. Static by design; hidden in print.
- **Aurora** (`.aurora` inside `.aurora-field`): three blurred light fields
  drifting on a 26s pendulum behind the landing hero. This is the ONE
  sanctioned loop in the system — it is weather, not signal. On fine-pointer
  devices the field also leans toward the cursor (a compositor-only transform
  on the wrapper via `--ax/--ay`, so the blurred fill never repaints); touch
  and reduced-motion get the plain drift. It never appears on `/swipe`,
  `/drill`, `/review`, `/results` or any surface carrying data, and it dies
  under reduced-motion (static gradient remains) and in print.
- **Hero entrance** (`.hero-line`): the landing masthead / edition line /
  headline / deck develop in out of a soft blur, staggered by `--i`, once on
  load — then still. Reduced-motion and print serve it solid.
- **Gradient ink** (`.ink-gradient`): display type only (the hero's key
  phrase) — never body copy, never a number.
- **CTA glow** (`.cta-glow`): the one primary action per page may glow;
  nothing else does.

This direction is provisional: the target reference (jamessvolos.com/about)
is unreachable from the build environment — tune against it when available.

## The House View (opinionated by design)

The desk registers one dated call per craft contrast in
`src/lib/house-view.ts` (13 total). Calls are frozen once made — changing one
requires a new dated entry. `/results#house-view` renders each beside its
caliper with the room's live verdict (`ROOM CONCURS` accent / `ROOM
OVERRULES` danger / `TOO CLOSE TO CALL` / `JURY'S OUT` muted). In run review
the desk appears only on calls that already carry a published crowd tag
(blinding: no new payload classes), speaks in first person ("THE DESK
CONCURS." / "YOU OVERRULED THE DESK — …"), and is always framed as
concurrence, never correctness. Craft only — the desk has no stance on the
hidden experiment, ever.

## Motion (all CSS, all behind `prefers-reduced-motion`)

Tokens: `--t-fast` 120ms (hovers, ticks) · `--t-base` 240ms (entrances) ·
`--t-slow` 420ms (reveals) · `--t-beat` 180ms (sequenced siblings) ·
`--t-step` 60ms (list stagger) · `--ease: cubic-bezier(0.2, 0, 0, 1)`.

Principles: nothing loops; nothing moves while the user reads a voting pair;
reward choreography is **quarantined post-decision** (stamp → charge →
explanation beats on the drill verdict; LOGGED stamp before the field dims on
swipe). Below the fold, reveals are scroll-driven (`animation-timeline:
view()`, progressive enhancement), starting at opacity 0.2 so content is never
invisible mid-viewport. The poster "develops" (blur + grayscale → sharp).
Promotion is a typeset slug with a self-drawing rule, not a toast.

## Layout

Page = `max-w-2xl` column (poster/profile pages `max-w-md`), gutters `px-5`
mobile / `px-8` desktop. Radius: `rounded-card` (4px — print, not app),
`rounded-chip` (3px), pills only for "Can't decide" and badges. Shadows:
`shadow-[var(--shadow-card)]` resting, `--shadow-lift` on hover. Cards over
`bg-card`; quiet context panels over `bg-wash` with a 3px `--rule-strong` left
rail. Every public page ends with the colophon (`SiteFooter`).

## Blinding rules for designers (non-negotiable)

1. Fidelity vocabulary ("overclaimed", "faithful" as a tag) never ships to a
   client bundle or payload — except inside `/drill`, which is separate
   training content, clearly labeled.
2. Any state that would reveal which pairs belong to the hidden experiment
   must be visually identical to a common innocent state (see hatched bars).
3. Rewards are identical across hidden arms: never design a treatment
   (color, XP, copy) that varies with a pair's fidelity.
4. Personal surfaces (poster, `/p/`, review) show craft only.

## Print & embed

`?embed=1` on `/results` = chrome-less for iframes. `@media print`: chrome
carries `.print-hide`, the poster keeps its ink via `.poster-print`
(`print-color-adjust: exact`). OG images (`src/lib/og.tsx`) use the poster
tokens in hex (satori has no oklch) and IBM Plex Mono woff only — ASCII-safe
copy (no ≈/≥ glyphs in the latin subset).

## Checks before shipping UI

- Build + lint + axe (WCAG 2.1 AA) clean; links distinguishable by more than
  color; focus-visible ring on every interactive element.
- Screenshot at 390px (design target) and 1280px, light and dark.
- `grep -rl "overclaimed\|LOW_ATTENTION" .next/static/chunks/` must be empty.
- Client components import only from `client-constants.ts`, `client-stats.ts`,
  `session-client.ts`, or component files — never `types.ts`/`analytics.ts`.
