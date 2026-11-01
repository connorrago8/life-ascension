# Brain Rot — development checkpoint and acceptance contract

Status: **prototype / draft PR #73; not production-ready**. Baseline: integration/questboard-emberhaven-crypt-20261031. Owner: Brain Rot development track. No merge or deployment authorized by this checkpoint.

## Completed in code
- Hub route and dungeon entry.
- Ten simulation prototypes (NOT ten feature-complete mini-games).
- Thirty shuffled levels, three difficulty tiers, and Level 31 entry.
- Boss queue visits each remaining game once per round, four 15-second segments per game.
- Browser-local run and active-state checkpoints.
- Unit tests for shuffle, deterministic simulation, puzzle merges, boss completion and queue uniqueness.

## Critical outstanding issues (priority order)
1. **Boss segment retry:** guarantee snapshot is captured when the first segment starts; restore state AND timer atomically after failure; never count a failed segment.
2. **Boss state persistence:** validate every game-specific state and resume after browser refresh; verify no state mutation while inactive.
3. **Timer integrity:** use a monotonic fixed-step accumulator, pause on tab hide, and avoid dropped/duplicated time.
4. **Actual iPhone gestures:** replace prototype on-screen arrows with per-game touch controls; swipe path for Blade Frenzy; hold/release for jetpack; full-screen gesture handling.
5. **Gameplay differentiation:** implement ten distinct rulesets, reachable procedural layouts, actual objective-based wins and fair losses. Current modes are scaffolding.
6. **Rune Fusion boss:** define and test meaningful 15-second puzzle activity; no idle-time farming.
7. **Cross-device save:** localStorage is device-local; use authenticated cloud save with conflict handling before claiming sync.
8. **Visual and audio:** original sprites, animations, environmental art, reduced motion, accessible contrast and sound settings.
9. **QA:** end-to-end Chromium, iPhone Safari, 320/390px, navigation to Hub, reload, background/foreground, all 31 levels, and full boss.
10. **Balance:** instrument completion times, failure causes, and adjust per-game tiers; no unverifiable success-rate claims.

## Acceptance gate
Do not merge until typecheck, unit tests, build, browser gameplay, checkpoint recovery, and independent QA all pass on the exact candidate SHA. No production deployment without separate release verification.

## Efficiency contract
Work in coherent vertical slices: inspect once → implement gameplay + save + tests → run local verification where available → push → check exact-head CI → report only meaningful result. One owner per component, avoid overlapping branch edits and repeated polling.
