# Goblin Jetpack — earned pickups and flight controls

November 4, 2026. Isolated gameplay branch based on Grok's smoke-fixes release
stack at `4b867c322bcdaeee9cb6fed4b1ab8beeacd6c024`. Its Brain Rot core, games,
component and mechanics tests were identical to the newer weekly-autopilot
branch before this batch. Quest/weekly changes are outside this PR. PR #80's
checkpoint lifecycle change is separate and can be reviewed alongside it.

## Reproduced defect

Before this change, seed 7, tier 1, no input: at tick 5,259 Jetpack had collected
35/35 pickups, scored 350, and won while parked at y=0.94. Hazards stayed above
that boundary while every pickup spawned at the player's current altitude.
The earlier 120-frame idle regression ended before the first collectible could
arrive, so it did not cover a full idle win. This was reproduced in the pure
simulation, not in hosted gameplay.

## Mechanics

- Pickups follow a repeating authored altitude path: 0.2, 0.4, 0.6, 0.8. Their
  position no longer follows the player. The next pickup is visible moving in
  from the right before collection.
- Existing thrust, gravity, speed, spawn cadence, three tier goals, hearts,
  failure rules and boundary clamping remain unchanged.
- A lethal hazard collision resolves before collection; that frame grants no
  pickup progress or score. A collected pickup is removed and scores once.
- Space supplies sustained hold for Jetpack (and existing hold-style Glider),
  released on Space keyup. Flappy retains discrete tap. Unrelated key release
  does not release thrust. Paused keyboard input is ignored.
- Jetpack shows its pickup objective/count and its hold/release controls.

No XP, account rewards, equipment, paid retry, database or Preview configuration
changes. An idle player may remain alive at the boundary but cannot clear the
normal Jetpack level by attracting collectibles there. Boss survival rules and
Rune meaningful-move checks are unchanged.

## Verification and limits

Local deterministic suite: 56 Brain Rot tests passed, including 12 full-length
idle fixtures across all tiers, lethal collision precedence, one-time pickup
collection, flight control, keyboard mapping and checkpoint round-trip
determinism. Full local suite: 775/775 passed; TypeScript passed.

The new CI workflow runs on this PR's Grok smoke-fixes base without changing
the shared build workflow. It uses synthetic invalid QA credentials for the
build and empty hosted credentials for browser work. The browser harness
covers 320/390px, actual Space down/up, unrelated key release, paused input,
objective text, overflow and zero external requests/HTTP writes. Its result
must be read from the exact candidate CI; unit tests do not certify the browser.

No native simulator, iPhone Safari, VoiceOver, actual touch playtest or full-run
difficulty acceptance is claimed. The flight path prevents boundary farming;
it is not proof every generated hazard/pickup sequence is fair. Existing saved
entities keep their positions until consumed or scrolled away; newly spawned
pickups use the new path, without resetting a saved run.

Next: independent QA on the exact candidate, including touch hold/release and
legitimate collection across tiers once a protected current Preview is usable.
Do not weaken Preview guards or imply this branch is deployed from CI success.
