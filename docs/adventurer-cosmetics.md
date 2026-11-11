# Minimal Adventurer Cosmetic Track (Connor)

Lightweight counterpart to Izzy's Style Track. Purely cosmetic, level-gated, manual equip only. Does not touch Crypt XP or Ashen Hood logic.

## Proposed unlocks (every 5 levels, 6 pieces total)

| Level | Piece              | Slot      | Notes                          |
|-------|--------------------|-----------|--------------------------------|
| 5     | Dark hood          | head      | Complements Ashen Hood         |
| 10    | Leather vest       | chest     | Basic torso                    |
| 15    | Utility bracers    | main-hand | Or off-hand variant            |
| 20    | Reinforced boots   | feet      |                                |
| 25    | Cloak of the path  | back      | New slot or overlay            |
| 30    | Neon edge dagger   | main-hand | Cosmetic only                  |

## Implementation notes
- Reuse existing equipment tables where possible.
- Additive TEST migration only.
- Wear/Take Off via existing equip RPCs or a thin companion-style wrapper.
- Visuals can start as layered SVG on the current CharacterScreen.

This is a sketch only. Not implemented yet.
