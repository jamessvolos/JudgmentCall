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
