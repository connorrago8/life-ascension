# LIFE ASCENSION — Endless Tower (Phase 4+ growth-first concept)

**Status:** Docs-only, parked; **not approved for implementation**. Branch `feature/endless-tower-concept` from `main`. Launch comes first: backup/restore dry run and explicit deployment approval, then phone-board and Phase 2 progression work. Phone-board and achievements designs have been approved with minor notes. This document proposes no implementation or launch change.

## North star: the character is the game

The central reward is **seeing a fantasy character become stronger because of verified real-life progress**. The dungeon is a short, optional showcase for that growth—not the primary reason to complete quests. The character screen and a weekly **“you got stronger” reveal** deserve priority over elaborate combat, classes, modes, or floor systems.

**Loop:** complete real-life quests → server-verified Phase 2 skills develop → see character appearance, stats, and abilities evolve → view a weekly before/after growth reveal with evidence → optionally watch the character demonstrate those changes in a short mostly-automated dungeon encounter.

## Weekly growth reveal (the centerpiece)

Before a dungeon run, show:
1. **Then vs. now:** character portrait/model with visually clear changes since the prior reveal; allow side-by-side comparison.
2. **What changed:** skill/stat deltas and any newly unlocked visual or combat effects, with explanations grounded in qualifying real-life quest completions.
3. **Why:** link each change to its relevant Phase 2 domain and eligible server-confirmed progress; distinguish completed activities from actual skill-level increases.
4. **In action:** a short preview or combat demonstration that makes improvements observable (e.g., shield visibly absorbing more damage), not merely a larger number.

If a week has no skill/stat unlocks, show honest activity progress and unchanged attributes; **never fabricate growth**. Avoid making the reveal a judgment of personal worth, health, or finances. Cosmetics are fantasy metaphors, not assessments of the player.

## Phase 2 skill → visible character change → combat expression

These are illustrative, read-only *derived* dungeon effects, not new XP sources. Final effects, unlock thresholds, and fairness are TBD.

| Phase 2 domain | Derived stat | Visible character evolution | How it feels in auto-combat |
|---|---|---|---|
| Physical health | Vitality | Armor reinforcement / sturdy silhouette | Higher survivability and visible hit absorption |
| Personal growth | Insight | Runes / enchanted trim | More useful tactical options or smarter skill selection |
| Finance | Resolve | Protective shield aura | Reduced damage, with clear shield effects |
| Home | Endurance | Durable boots / utility gear | Better sustained defense across encounters |
| Mental health | Focus | Calm blue glow | More reliable ability triggers / steadier cooldown rhythm |
| Relationships | Presence | Companion spirit / banner | Support or ally-assist animations |
| Hygiene | Recovery | Restorative green effects | Visible healing/recovery between encounters |
| Career | Mastery | Refined weapon / insignia | Improved trained techniques and attack animations |

The chosen class or loadout, if any, is **freely selected**. No real-life skill forces a class; all domains should help any playstyle in a meaningful, balanced way. Visuals must remain customizable and accessible, including reduced-motion options.

## Dungeon as a short showcase, not a chore

- **Mostly automatic combat** with occasional pause-and-choose tactics, temporary equipment/boons, and recognizable enemy telegraphs. No reflex timers.
- Initial scope should be **one region, one boss, three distinct build approaches**, targeting roughly **5–15 minutes**. Build depth and encounter counts are secondary and subject to playtesting.
- **Permanent checkpoints every 10 floors** are the preferred long-term progression concept, with optional replay of unlocked earlier regions; failures never erase checkpoints.
- Tentative: **one official weekly expedition plus unlimited practice**, relaxed progression, and Standard mode for official checkpoint unlocks. These rules are **not locked**; revisit whether weekly attempt limits or mode gates create unnecessary pressure.
- Missing a week has no penalty; pausing/resuming should protect an in-progress run. Starting from an unlocked checkpoint should not require replaying old floors for equipment.
- A boss victory is satisfying because it demonstrates character growth and may unlock **dungeon-only** regions/cosmetics; it never grants real-life XP.

## Permanent vs. temporary

**Permanent outside dungeon:** existing real-life XP and immutable `xp_ledger`; achievements; Phase 2 domain skills; read-only derived base stats; optional dungeon-only checkpoint/floor/cosmetic records. Dungeon results cannot alter real-life progression.

**Temporary each run:** HP, consumables, buffs, routes, loot, boons, combat modifiers and encounter state. These reset after the run. No loot boxes, paid random rewards, or new farmable currency.

## Non-negotiable safeguards

1. **No XP coupling:** Dungeon wins, losses, boss clears, practice, and resets never create, modify, or delete real-life XP, `xp_ledger`, achievements, or quest completion records. No dungeon-triggered XP RPC.
2. **Server-authoritative, read-only growth:** Stats and growth reveals derive from owner-scoped Phase 2 skills grounded in server-recorded, ledger-backed qualifying quest completions. Never trust browser or AI claims of completion.
3. **Anti-farming:** Validated locked XP tiers, low-effort repeat caps, and diminishing weekly returns prevent repetitive easy quests from dominating progression. Never retroactively modify launch XP or ledger history to rebalance the dungeon.
4. **Failure is harmless:** Loss or missed weeks cost only temporary resources; never permanent skill levels, real-life XP, achievements, checkpoints, or records.
5. **Optional and isolated:** Dungeon errors/outages never block login, daily quests, or completion RPCs.
6. **Honest representation:** Only show stat changes supported by data; make fictional effects distinct from actual medical, financial, or personal assessments. No punitive streaks.

## Deferred Phase 4+ decisions

- Character art direction, visual upgrade thresholds, animations, and accessibility.
- How to translate skill growth into balanced combat effects without rewarding unhealthy quest farming.
- Whether classes, modes, or official-run limits improve enjoyment or add friction.
- Encounter/floor counts, seeded practice runs, exact curves, and storage for dungeon-only records.

**Scope:** Design document only. No code, schema, migrations, PR #1 changes, production changes, or changes to launch +1 XP rules.
