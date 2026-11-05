# Brain Rot loaded-state authority and validation repair

Base: UI candidate85 at388074f51a17d24fb7aa2c4fbbb9ffa85501d6ca, including
integration84/lifecycle80, Jetpack81 and Lantern83. This is a new isolated
Gameplay branch; none of those shared source branches is edited.

## Behavior

The page previously loaded an atomic board for display, then Resume ignored it
and read the legacy split key or created a fresh game. Mount now resolves the
snapshot paired with the chosen run once. Resume uses that validated in-memory
snapshot rather than re-reading an unrelated legacy key. This preserves an
atomic-only Rune board and avoids a later stale legacy record overriding it.

A common structural validator checks the fields consumed by rendering and the
deterministic stepper: identity, tick/seed/progress/goal/score, flags/input,
finite player/entity coordinates,16-cell tile grid and optional meaningful-move
tick. Atomic active state must match the current run level and game. Invalid
active data is discarded while retaining a valid run, level and hearts. No
failed-load penalty or automatic reward is introduced.

Legacy run loading now uses the same run validator as atomic loading. Legacy
active records and games.restore also use structural validation. Boss saved
states and entry snapshots must match their keyed games; malformed boss runs
are rejected, with existing valid-legacy/new-run fallback. This cannot recover
missing or invalid data and does not guarantee recovery of a corrupted save.
Valid per-game boss state, segment milliseconds and hearts are preserved.
Terminal active states are not eligible for replay as a newly completed frame.

## Evidence and scope

QA82 files copied byte-for-byte, without weakening expectations:
- tests/brainRotCheckpointReliability.test.mjs (4 source contracts)
- tests/browser/brain-rot-checkpoint.qa.mjs (2 actual-component cases)

Seven additional source tests cover all-ten-game deterministic continuation,
malformed/nonfinite structures, invalid-active run retention, legacy rejection,
boss fallback/time, keyed snapshot identity and terminal-state rejection.
The dedicated exact-head CI runs the complete suite and guarded synthetic
build, the unchanged QA browser cases, then the lifecycle,Jetpack,Lantern and
combined Hub/Town storage journeys. Final run/job evidence belongs in the
GitHub checkpoint. Author-run results are not independent QA acceptance.

No gameplay difficulty/goal/timing or XP/streak rule is changed. No account,
Crypt,Hub/Town UI,visual assets,environment/auth or Production modification.
Storage-unavailable failures remain handled by existing save behavior; this
repair does not introduce a new persistence-success promise. Multi-tab conflict
resolution and full boss forty-segment playthrough acceptance remain separate.
No native simulator, iPhone Safari,VoiceOver or Founder playtest is claimed.
