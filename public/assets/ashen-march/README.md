# Ashen March Enemy Telegraph Concept Assets

Status: **PROPOSED — visual prototype only**

This branch adds a standalone SVG concept sheet at `public/assets/ashen-march/ashen-march-telegraph-concepts.svg`.

## Included concepts
- Cinder Hound: idle silhouette and charge wind-up.
- Roadbound Sentry: guard silhouette and counter-opening cue.
- Ash Collector: idle silhouette and sweep wind-up.

## Constraints
- These are illustrative placeholder concepts, not approved canon or production gameplay.
- No combat logic, hitboxes, damage, XP, loot, unlock timing, or reward behavior is included.
- The SVG is not wired into the app or any production screen.
- The amber telegraph marks are paired with directional/shape cues; do not rely on color alone.
- The sprite proportions and legibility still require review in the actual renderer at 320–430 CSS px, including reduced-motion behavior.

## Review checklist
- [ ] Distinct silhouettes remain recognizable at mobile size.
- [ ] Wind-up cue is distinguishable from active attack and recovery.
- [ ] High-contrast outline works in light/dark environments.
- [ ] Reduced-motion alternative retains a static, readable telegraph.
- [ ] Alpha/Beta/Founder review before any integration.
