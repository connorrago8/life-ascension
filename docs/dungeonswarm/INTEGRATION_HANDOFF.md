# Dungeonswarm — mobile integration handoff (2026-10-31)

**Status:** source handoff; NOT merged or deployed. Tracking: #68.

## Founder-approved direction

- Core genre: **roguelite RPG**; Brotato/Vampire Survivors auto-attacking combat with meaningful build choices, shops, permanent unlocks, and replayability.
- **Emberhaven Town** is the hub. Dungeonswarm is its own destination alongside the Crypt.
- **Hollow Keep** is an 11-room **linear** dungeon, a coherent themed adventure rather than random disconnected biomes. Paper Mario-inspired room-to-room storytelling and presentation.
- **Level 1 Lantern Court:** full playable open square, no restrictive obstacle clutter, forgiving early combat, lively atmospheric effects.
- Sparse **purposeful** props only (supply crates, explosive barrels, themed hazards). No oversized arbitrary colored circles or floor shapes.
- Early power selection: **Twinshot**, **Storm Arrow**, **Ember Bow**; **Lantern Captain** encounter.
- Six weapon types/slots, reroll/lock/forge shop, meaningful RPG builds; evolution combinations:
  - Hunter Bow + Storm Staff → Thunderstorm Barrage
  - Hunter Bow + Ember Bomb → Explosive Arrows
  - Moonblades + Iron Cleaver → Blade Cyclone
  - Spirit Spear + Storm Staff → Lightning Lance
- **Ember Legacy:** persistent between-run unlocks. Prototype uses browser localStorage, **not** authenticated cross-device sync.

## Canonical source

The complete, latest standalone file is `dungeonswarm_weapon_evolutions.html`, contained at ZIP root in `dungeonswarm_mobile_handoff_2026-10-31.zip` shared in ChatGPT. The ZIP also contains 14 historical iterations under `history/`. **Do not merge the historical files independently.**

The ZIP cannot be fetched by GitHub from a ChatGPT sandbox link. Grok must receive the ZIP or canonical HTML as an attachment before integrating. Do not claim the source is present in this repository until actually committed.

## Mobile integration requirements

1. Work on a dedicated feature branch; avoid concurrent Grok/Alpha/Beta edits; no force pushes.
2. Build an isolated Next.js route, linked from Town, with Return to Town navigation and clean game lifecycle handling.
3. Ensure the existing app, Quest Board, Crypt, authentication, and Supabase security remain intact.
4. Preserve run state when leaving/reentering the dungeon; validate localStorage migrations. Do not claim cloud sync without implementing it.
5. Test 320, 375, 390, 430 px layouts; iPhone Safari touch controls; level 1 power choice; Captain; shop; evolutions; death and restart; victory; save and resume.
6. Run TypeScript, build, CI, and security checks. Report full commit SHA, CI run/job results, and deployment ID if applicable.
7. **No production deploy or merge without separate approval.**

## Evidence

Standalone JS syntax check was reported passing. No reliable end-to-end mobile/browser test evidence is available. This handoff is a requirements document, not proof of implementation.
