# Companion Style Track (PR #130)

## Approved direction
- Baldur’s Gate 3 × dark cyberpunk × detailed 16-bit pixel art
- Adult proportions. No cute / pastel / chibi.
- One modular cosmetic every 2 levels through Level 50.
- Manual Wear / Take Off only.
- Free-text deterministic XP scorer + 30-day backdate (5 AM CT).
- Companion accounts only. TEST-only, reversible.

## Implemented on branch
- Dark cosmetics registry + migration (`lib/companionPass.ts`, `202611110002_companion_pass.sql`)
- Layered CompanionHero (base tank/pants/boots + neon overlays)
- Deterministic activityScorer (5/10/20)
- ActivityLog form with preview + backdate (wired into Home)
- Dark CSS overrides
- 5 AM CT game-day helper
- Rollback for the catalog

## Remaining before review
1. Confirm `companion_log_activity` RPC accepts scored XP and optional recorded_on (adjust call if needed).
2. Replace geometric SVG placeholders with proper layered pixel assets.
3. Capture five 390×844 screenshots (Home, Quests collapsed/open, Character L1, Character L20 equipped, battle pass) via `/companion-gallery` with `COMPANION_GALLERY=1`.
4. Apply TEST migration on disposable DB and verify wardrobe payload.
5. End-to-end Wear/Take Off and unlock-timing check.

Crypt XP and Ashen Hood remain untouched.
