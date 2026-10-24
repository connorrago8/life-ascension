# LIFE ASCENSION — Endless Tower (Phase 4+ concept)

**Status:** Short, docs-only concept. Branch `feature/endless-tower-concept` from `main`. **Not approved for implementation.** Sequencing: production launch and backup/restore validation → phone board → Phase 2 weighted XP and domain skills → later Phase 4+ dungeon. Existing phone-board and achievements docs remain under review.

## Pitch and core loop

A **hybrid roguelite** layered on top of the existing real-life quest app. Server-confirmed real-life quest progress develops permanent domain skills. Once per week, the player attempts a **5–15 minute** dungeon run with brief turn-based encounters, meaningful route choices, and temporary upgrades. A run can end in defeat or a new floor record; next week the player tries again with their legitimately improved character. Dungeon play is optional and never blocks real-life quest completion.

**Loop:** do real-life quests → Phase 2 skill levels update from authoritative completion records → view permanent character stats → attempt weekly dungeon → choose routes/boons and fight → record cosmetic dungeon-only progress → reset run equipment and retry later.

## Proposed Phase 2 skill-to-stat mapping

These are *derived read-only display/combat stats*, not a new XP source or a replacement for Phase 2 skills.

| Phase 2 domain skill | Dungeon stat | Example effect |
|---|---|---|
| Physical health | Vitality | Starting HP / survivability |
| Personal growth | Insight | Tactical options / ability effectiveness |
| Finance | Resolve | Defensive resistance |
| Home | Endurance | Stamina / sustained defense |
| Mental health | Focus | Consistency / cooldown control |
| Relationships | Presence | Event and encounter choices |
| Hygiene | Recovery | Recovery between encounters |
| Career | Mastery | Technique / precision |

Exact balance and cross-domain fairness require later playtesting. The app must never present these fictional game stats as medical, financial, or personal assessments.

## Temporary vs. permanent

**Permanent, outside dungeon:** already-earned real-life XP and immutable ledger history; achievements; Phase 2 domain skill progression; derived base character stats; optional dungeon-only highest-floor record and cosmetic region unlocks. Dungeon results cannot change any of the first four.

**Temporary, per run:** HP, consumables, combat buffs, chosen route, loot/boons, encounter status, and temporary attack/defense modifiers. All reset when a run ends; no loot boxes, random paid mechanics, or spendable reward currency.

## Hard separation rules

1. **Zero XP coupling:** Dungeon wins, losses, floor clears, boss fights, and run resets **never create, modify, or delete** real-life XP, `xp_ledger` rows, achievements, or quest completion records. No dungeon-triggered XP RPCs.
2. **Server-authoritative stats:** Base stats derive **read-only** from Phase 2 skills grounded in owner-scoped server-recorded, ledger-backed quest completions. No AI assertions, browser-supplied stats, or manual claims count.
3. **Anti-grind:** Phase 2 validates and locks quest tiers, caps low-effort repeat contributions, and uses **diminishing weekly returns** from repetitive easy quests. Favor steady activity across weeks and domains rather than volume on one day. Never multiply a player's XP ledger or retrospectively change XP to balance combat.
4. **Failure is harmless:** A failed or missed run costs only temporary run resources; it never reduces real-life XP, skill levels, achievements, or prior floor records.
5. **Independent and optional:** Dungeon errors/outages cannot block the daily quest board, completion RPC, or login. Later implementation should isolate dungeon logic and storage from core quest transactions.
6. **Weekly cadence:** One featured weekly challenge and personal best, with timezone boundaries defined explicitly (proposed `America/Chicago`). Avoid daily pressure or punitive streak mechanics.

## Questions for Phase 4 design review

- Exact combat system (simple turn-based cards versus actions) and floor count per 5–15 minute run.
- Deterministic or seeded run generation, balance, and replayability.
- Whether optional practice runs are unlimited but **cannot improve** the weekly record.
- Exact stat curves and weekly diminishing-return caps once Phase 2 skill schema and rules are finalized.
- Whether floor records require any new storage; **none is proposed or authorized here**.

**Scope:** Concept document only. No code, schema, migrations, PR #1 changes, production changes, or changes to the launch's +1 XP rules.
