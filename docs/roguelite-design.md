# Roguelite design

Real-life quests are the only permanent power. The dungeon pays in temporary run strength and home decorations. The Crypt XP cap stays as it is. Nothing here equips gear by itself.

## Release order

Release 1, landed on beta: a run is a journey of floors. Floor 1 is data. Clearing it still ends the run. Browser saves are versioned. Checkpoints are per floor.

Release 2, Home Hub: the existing Home grows a pixel house from quest level, with day and night from the 5:00 AM Chicago clock. Training reuses the quest stat budget. The armory reuses explicit Wear. The dungeon door opens `/play/delve`. The quest board stays one tap away. Companions never see this hub.

Release 3, three floors: Crypt, Drowned Catacombs, Ember Forge. Same card combat. After a boss that is not the last, the player chooses Descend or leave. HP, deck, and worn gear carry. Defeat and a finished run return toward Home. New cards carry tags and stay out of Floor 1's reward pool.

Release 4, build craft: tag synergies (2/4/6), a status-combo table (burn+oil, wet+shock), boons offered 1 of 3 by a patron, and card modifiers. All of it resets on death. A codex fills as those are discovered. The first Floor 3 clear can offer heat, which pays cosmetics only.

Release 5, exploration: fog of war, keys, locked doors, secret rooms, a stalker, a dread meter, ambushes, and cursed shrines. Seeded, and every floor still has a path to the boss. Rare stalker and shrine rewards are cosmetic or run-only.

## Seams already in the code

- `boons` on the run is an empty list.
- Floor definitions live in `lib/crypt/delve/journey.ts`.
- A later release can read card tags and a status-combo table without rewriting battles.
- `runModifiers` stays empty until Release 4. It must not change damage, HP, or level.

## Engagement rules

Runs should land around 10–15 minutes on a phone. A loss names how close the boss was and links to the quest board. There is no streak shaming and no punishment beyond the run ending.

Every finished run should eventually pay one cosmetic or run-only unlock: a story line, a trophy, a house decoration, or a card offered in future runs. That needs owner-only rows on TEST. It is not in Release 2.

The codex, trophies, decorations, and a daily best are the same kind of save: one row per owner, RLS so only that player reads and writes it, reversible. Authenticated users can currently only read `adventure_run_saves` on TEST, so resume stays in the browser until a safe write path exists.

One daily seed comes from the 5:00 AM Chicago game day and is the same for everyone. Personal bests can be compared later. Izzy's companion account does not enter the dungeon or gain adventurer stats. A view-only board for her is a product choice, not built here.

## What we will not do

No permanent combat power from the dungeon. No change to the Crypt XP cap. No gore. Motion and sound respect reduced motion, and sound stays off until the player turns it on.
