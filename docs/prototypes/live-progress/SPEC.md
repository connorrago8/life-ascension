# Live progress prototype

Self-contained phone demo for the daily status pill, quest ring, completion flight, Izzy’s unlock sheet, and partner toast. It does not change the Next.js runtime. Open `index.html` over any static server (a `file://` module import is blocked by browsers). No CDN requests.

Viewport first: 390×844. At 340px the page does not scroll sideways. Connor’s nav is Home, Quests, Play, Character, More. Izzy’s nav omits Play.

## What the references actually contributed

### HTML demo (`https://fil.design/skills/html-demo` and its `SKILL.md`)

Fetched. Used: a live HTML app, real labels copied from this repo, `body` margin 0, reduced-motion end frames that are complete pictures, and a clean console. Not used: the 1200×750 filmed stage and the scrubbed pointer. This deliverable is an interactive phone, not a recorded film.

### Emil Kowalski, design engineering (`emilkowalski/skills` `emil-design-eng/SKILL.md`)

`https://emilkowal.ski/skill` is an index and does not include the essay. The skill file was read from GitHub. Used: custom ease-out `cubic-bezier(0.23, 1, 0.32, 1)` for entrances, accelerate `cubic-bezier(0.3, 0, 1, 1)` for exits, press scale 0.97 in 140ms, no `scale(0)`, no `transition: all`, CSS transitions where a gesture can be interrupted, and a spring only on the pill. Toasts stay under 400ms. Sheets use the iOS drawer curve as the fallback and a sampled spring when JavaScript is running.

### REA (`https://rea.tools`)

Fetched. It is the product page for an inspection tool, not a write-up of Activity rings, Duolingo, or the Dynamic Island. REA was not installed. The method used here is the one the page demonstrates: name the rule, rebuild a small version, check both paths.

- Activity rings: a rounded stroke starts at 12 o’clock and eases to the new fraction. Hitting 100% shifts the stroke to gold and pops the ring 4.5%. A new quest retargets the same stroke.
- Duolingo: `+N XP` leaves the row and the pill number changes when the flight arrives, not when the tap lands. The flame lights once, when today first reaches 100%.
- Dynamic Island: one pill above the nav. Tap grows it upward on a spring. Tap again collapses it. A second tap during the flight reverses with the velocity it already has.

### Meng To (`https://github.com/MengTo/Skills`)

The HTML page for `mengto/skills` did not list files. The README and tree were read from `MengTo/Skills`. Used: one spec instead of a vibe, real tokens, and the HTML-demo rule of a single class prefix (`lp-`). The 3D and game skills were not applied.

### LottieFiles motion design (`LottieFiles/motion-design-skill`)

`SKILL.md`, the 12 UI principles, and the timing tables were read.

Personality for this screen is restrained, closer to corporate than playful. Dark fantasy is the palette, not a bouncy mascot.

- Signature entrance: `cubic-bezier(0.23, 1, 0.32, 1)`.
- Exits: `cubic-bezier(0.3, 0, 1, 1)`, about two thirds of the entrance.
- Duration palette: press 140ms, standard 220–320ms, sheet and seal up to 400ms.
- Overshoot budget: about 3.6% on the pill spring only. No squash on buttons beyond 0.97. Anticipation is skipped because the press is under 150ms.
- Follow-through: the check draws immediately; the `+N XP` flight arrives later and only then rolls the pill.
- Staging: the reveal sheet is the hero. The simulate panel closes when the sheet opens. When a level-up and an unlock are the same moment, particles play on the piece, not also on the pill underneath the sheet.
- Arc: the XP flight bends 14px upward at mid-flight. The distance stays inside the phone, under one third of the screen.
- Success particles are reserved for today hitting 100%, a level-up with no sheet, and the unlock reveal. Ordinary quests do not burst.
- Spatial moves are not linear. The ring uses ease-out because it is feedback, not a clock.

### Motion AI Kit (`motiondivision/ai-kit`)

Read: `SKILL.md`, `best-practices/index.md`, `css-or-motion.md`, `css-spring/index.md`, `performance-audit/index.md`, and `motion-reviewer.md`.

The CSS spring tool and the MotionScore methodology are served by the Motion MCP / Motion+ server. That server is not connected here, and MotionScore grades were not invented. The audit below follows the public best-practices file. `generate-css-easing` was not called. `sampleLinear()` in the page samples the same mass-spring (stiffness, damping, mass 1) into a CSS `linear()` and assigns it to `--lp-spring` for the sheet. The pill does not use that curve: a sampled `linear()` cannot keep velocity when a tap interrupts it, which `css-spring/index.md` states directly.

## Tokens

From `app/style.css` and `app/quest-workspace.css` on PR #141:

| Token | Value |
| --- | --- |
| Background | `#0e1016` |
| Panel | `#141820` |
| Border | `#2a3340` |
| Text | `#f4f7fb` |
| Muted | `#9aa6b5` |
| Magenta | `#ff2bd6` |
| Cyan | `#3de1ff` |
| Gold | `#c9a227` |
| Ink on magenta | `#140712` |

Row geometry matches `.quest-row`: title 650, meta 12px `#9aa6b5`, cyan `XP` hint, 44px completion control, gold `+N XP`. Izzy’s figure is the 80×112 pixel rects from `components/companion/CompanionHero.tsx` (base, Nightgrip Gloves, Silver Thorn, Shadow Cargo, Midnight Crop, Rogue’s Leather, First Mark). Level math is `lib/level.ts`. Copy is `lib/levelUpCopy.ts`. The wear control is the word **Wear**, matching `CompanionWardrobe` and `AdventurerCosmeticTrack`. Nothing is worn until that button is pressed.

## Tune panel

`tweakpane.min.js` is Tweakpane 4.0.5, MIT, `(c) 2016 cocopon`, vendored in this folder and imported as a module. It is not loaded from a CDN. Open Simulate, then Tune.

| Control | Default | Range |
| --- | --- | --- |
| Stiffness | 170 | 80–420 |
| Damping | 18 | 8–40 |
| Glow | 0.35 | 0–1 |
| Particles | 30 | 0–48 |
| Check | 220ms | 80–400 |
| Ring | 320ms | 120–500 |
| Fly | 360ms | 160–520 |
| Roll | 280ms | 120–400 |
| Toast | 280ms | 120–400 |
| Sheet cap | 320ms | 200–520 |
| Seal | 400ms | 200–600 |

At 170 / 18 the normalized spring reaches 90% in about 200ms, peaks at 3.6% overshoot, and is settled by about 620ms. `spring ms` is the sampled CSS duration, which includes the settle and can be longer than the perceptual arrival. Preview burst fires the particle pool without changing quest state.

## Interactions

Reduced motion is on when `prefers-reduced-motion: reduce` matches, until the in-demo switch overrides it. While it is on, transitions and animations collapse to 0.01ms so the end frame is what you see, flights are skipped, the spring snaps, and particles do not spawn. Sound is independent and stays muted until Sound is pressed.

### 1. Status pill

States: `compact` (232×44, or the phone width minus 32px when narrower) and `expanded` (phone width minus 24px, height of the summary). `aria-expanded` is on the toggle. Escape collapses it, then the simulate panel.

The spring integrates `p` from 0 to 1 with the tuned stiffness and damping (`dt` clamped to 32ms, paused while the tab is hidden). During the flight the pill’s layout box is the expanded size plus 16px of headroom, and `clip-path: inset(...)` reveals the bottom-center region. Width and height are written when the spring settles, not every frame. A second tap retargets `p` and keeps `v`.

Compact reads `done/total`, the flame, the streak, and XP remaining in this level. Expanded adds today, streak in days, `Level n · into / next XP`, and any Izzy piece that is unlocked, with Wear or Take off. Numbers roll in 280ms by translating the old value out and the new value in.

Glow is a static magenta shadow on `.lp-glow`. `.is-hot` fades its opacity to the tuned intensity over `--lp-glow` (280ms) and clears it. The shadow itself does not animate.

### 2. Quest ring

Two rounded strokes, rotated −90 degrees so they start at 12 o’clock. Today is magenta, radius 28, 6px. XP-to-next is gold, radius 20, 4px. Tracks are `#232833`. `stroke-dashoffset` eases over `--lp-ring` (320ms). At 0 the stroke opacity is 0 so the round cap does not leave a nub.

Today uses the true board immediately. The XP arc uses the pill’s shown XP, so it fills when the flight lands. Crossing to 100% adds `.is-closed` (stroke turns gold) and plays `.is-sealed` once: scale 1 → 1.045 → 1 in `--lp-seal` (400ms). A new quest removes the closed state and the stroke eases backward.

### 3. Quest row

Compact row: title, ownership (`Life`, `Together`, `From Izzy`, `From Connor`), cyan `XP`, 44px round control. Press scale 0.97 for 140ms. The check path runs `stroke-dashoffset` 16 → 0 in `--lp-check` (220ms), gold when done.

`+N XP` is a fixed label that travels from the row to the pill in `--lp-fly` (360ms) with `1 - (1 - t)³` and a 14px upward arc. The pill’s done count, streak, and XP remaining roll when that label arrives. A second completion queues another snapshot so the numbers do not rewind. Account switch cancels flights and shows the true numbers.

XP amounts are the app’s tiers: 5 for a small chore, 10 for Evening wind-down and Gain XP. Level curve is `5 × (level + 1)` per step. Connor starts at 30 XP (level 3, 5/20). Three quests (5+5+10) land at 50 XP, level 4, 5/25, and the note “Level 4 reached.” Connor does not get a wear sheet in this prototype.

### 4. Izzy unlock

Even levels through 12 use `lib/companionPass.ts` names: Nightgrip Gloves (2), Silver Thorn (4), Shadow Cargo (6), Midnight Crop (8), Rogue’s Leather (10), First Mark (12). Izzy starts at 5 XP, so the first 5 XP quest reaches level 2.

The sheet is `role="dialog"` `aria-modal="true"`. Copy, in order: LEVEL UP, “Level n reached.”, “The road remembers every step.”, “New gear unlocked: {label}.”, “From the midnight glow, a new piece of your legend emerges.” Entrance is the sampled spring, capped by the sheet slider (default 320ms), plus a 200ms opacity fade, from `translateY(16px) scale(0.98)`. Exit is 220ms accelerate. Scrim is `rgba(8, 10, 12, 0.55)`. Focus moves to Wear. Not now, Escape, and the scrim close the sheet and do not wear. Wear and Take off are explicit. The board line “Wearing …” updates only after Wear.

If the same tap both levels her into a piece and would burst at the pill, the burst is on the figure instead. A Connor level-up, which has no sheet, bursts at the pill.

### 5. Partner toast

“{Partner} sent you: {title}.” One toast, 2-line clamp, magenta 2px leading edge. Enter 280ms ease-out from `translateY(8px)`. Exit 180ms accelerate. Hold 3200ms, or tap to dismiss. A newer toast replaces it. Switching accounts hides it. The new row fades in over `--lp-row` (200ms) from 6px below.

### Particles

Pixel squares, 2 or 3 CSS pixels, magenta `#ff2bd6`, cyan `#3de1ff`, gold `#c9a227`. Default 30, pool of 48, reused. Gravity 80px/s², life about 0.42–0.64s. The `burst` and `stepP` functions are about 1.2KB. No three.js. They do not run under reduced motion. The canvas is `pointer-events: none`.

Fires when today first hits 100% (at the ring), when a level-up has no sheet (at the pill), and when the reveal sheet finishes opening (at the figure).

### Sound

Muted until Sound is pressed. Three CC0 1.0 preview MP3s from the Openverse API (`license=cc0`). Each file is under 30KB. License: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Attribution is not required by CC0; it is recorded here anyway.

| Cue | Title | Creator | Openverse / Freesound | File |
| --- | --- | --- | --- | --- |
| Check | UI Button Click | benzix2 | https://freesound.org/people/benzix2/sounds/467951 | `sfx/check.mp3` (4,593 bytes) |
| Level-up | Chime Notification | Jofae | https://freesound.org/people/Jofae/sounds/380482 | `sfx/level.mp3` (8,453 bytes) |
| Unlock | [UI Sound] Approval - High Pitched Bell Synth | GabFitzgerald | https://freesound.org/people/GabFitzgerald/sounds/625174 | `sfx/unlock.mp3` (18,579 bytes) |

The files are the preview URLs Openverse returned (`cdn.freesound.org` `*-hq.mp3`), not a separate paid download. Check plays on quest complete. Level-up plays when the level changes and no sheet opens. Unlock plays when the sheet finishes opening. They do not stack on the same frame.

## Motion audit

MotionScore was not graded. `performance-audit/index.md` says the tier table lives at `motion://skills/performance-audit` on the Motion+ server, and that a refused read must not be replaced with improvised S–F grades. The notes below are the public rules in `best-practices/index.md`, applied to this folder, including the bug found while running the page.

| Finding | What changed |
| --- | --- |
| A width/height spring would lay out every frame | The flight writes `clip-path` only. Width and height update when the spring settles. `will-change: clip-path` is set for the flight and cleared after. |
| Animating `box-shadow` repaints | The glow shadow is static. Only opacity fades. |
| Per-frame allocation | The spring mutates one object. Particles reuse 48 slots. The clip string is the one allocation left, because CSS needs it. |
| Infinite loops | The flame and the ring seal each play once. There is no idle shimmer. |
| Tweakpane `refresh()` inside `change` recursed until the stack overflowed | A reentry flag ignores the refresh’s own change event. Confirmed: no page errors after the guard. |
| SVG `stroke-dashoffset` on the ring is paint, not a compositor transform | Left as a CSS transition on one 84px icon. A canvas ring would drop the text. |
| Sheet, toast, flight, check, and number roll | Transform, opacity, or a short stroke reveal. Exits are shorter than entrances. |

## Port plan

One pill. PR #141 already reserved it and did not build it.

- Slot: `app/components/AppShell.tsx` renders `<div className="nav-status-slot" data-slot="engagement-status" />` between `AppNav` and `.shell-main`.
- Placement: `app/style.css` under `max-width: 719px` fixes that slot above the nav (`bottom: calc(64px + env(safe-area-inset-bottom))`, height 28px, `pointer-events: none`) and sets `.shell-main` padding-bottom to `calc(114px + env(safe-area-inset-bottom))`.
- The PWA branch named in that PR (`grok/engagement-pwa-push-*`) is not in this checkout. Its pill, if it adds one, must be deleted and its data passed into the component below. Push permission and install belong in the expanded summary, not in a second fixed chip.

Build `components/engagement/StatusPill.tsx` and render it as the only child of `[data-slot="engagement-status"]`. The slot stays `pointer-events: none`. The pill sets `pointer-events: auto`. Raise the reserved band from 28px to 44px so the compact target meets the touch size, and keep a single padding-bottom on `.shell-main`. Do not add another `position: fixed` pill in `AppNav`, the quest page, or a push banner.

| Piece | Port target |
| --- | --- |
| Pill spring, roll, glow | `StatusPill.tsx` plus a few rules next to `.nav-status-slot` |
| Today ring and XP arc | A `TodayRing` used by the quest header (`components/quests/QuestWorkspace.tsx` or `app/(app)/quests/page.tsx`) |
| Check and `+N XP` flight | The existing `.xp-float` in `components/quests/QuestWorkspace.tsx` and `PersonalQuestBoard.tsx`. Measure `[data-slot="engagement-status"]` and fly there. Keep `ConfirmCompleteButton` in front of the animation. Keep the in-flight lock. |
| Izzy sheet | Replace the auto-hiding banner in `components/UnlockCelebration.tsx` / `components/CosmeticLevelUp.tsx`. Wear calls the handler `CompanionWardrobe` already uses. Do not call wear from the level-up effect. |
| Partner toast | One node in the engagement slot’s stack, fed by the existing assign refresh. Do not add a second snackbar. |
| Reduced motion | The `prefers-reduced-motion` blocks already in `app/style.css` and `app/quest-workspace.css`. |
| Numbers | `lib/level.ts`, `lib/companionPass.ts`, `lib/levelUpCopy.ts`. No new curve. |

Connor and Izzy do not share XP, streaks, or unlocks. Couple marks still write each person’s own ledger.

### One animation approach

Use CSS transitions plus one small hand-rolled spring for the pill. Do not add GSAP, Lottie, three.js, Remotion, or the Motion library for this work.

Measured with esbuild 0.27.3, minify, React external, from `motion@12.23.24`:

| Import | Minified | Gzip |
| --- | --- | --- |
| `import { motion } from "motion/react"` | 124,023 B | 40,886 B |
| `import { animate } from "motion"` | 63,402 B | 22,728 B |
| Bundlephobia, full `motion@12.23.24` entry | 135,636 B | 45,309 B |

The pill spring and the particle step in this file are about 1–2KB together. `css-or-motion.md` is right that Motion springs are the better tool once many gestures share velocity, layout, or shared elements. This surface is one interruptible pill, and the rest is class-driven CSS. Revisit Motion only if a later change needs layout animation or shared-element transitions across the app, and even then import the smallest entry rather than `motion/react` wholesale.

## Demo hashes

Read on load. Combine with `&`.

| Hash | End frame |
| --- | --- |
| `#expanded` | Pill open |
| `#toast` | Partner toast and the new row |
| `#closed` | Connor, today complete, streak held, level note |
| `#izzy` | Izzy, no Play tab |
| `#sheet` | Level 2 Nightgrip Gloves sheet, not worn |
| `#reduce` | Reduced motion, one quest already checked |

`window.__lp` exposes `tune`, `accounts`, `levelFor`, `burst`, and `sampleLinear` for the prototype only.
