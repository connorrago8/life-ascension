# Paused-tab checkpoint races

Inspected candidate: World92 b64b14776c987044abc87f402416405abab79af4.
Test-only branch; no gameplay,UI,persistence implementation or release approval.
Same agent authored earlier implementation: no independent self-approval.

## Question
Can a paused second tab overwrite a more recent accepted level or heart count
when lifecycle saving fires? saveCheckpoint increments the current persisted
revision but does not tie that revision to the in-memory run being written.
An increasing revision alone therefore does not establish snapshot freshness.
This is a source-supported hypothesis until executed.

## Browser fixtures
Two real same-origin pages in one isolated context hydrate the same valid record.
A Rune fixture has a legal64+64 move that completes Level1. A Flappy fixture is
one lethal frame from a heart loss. Tab A plays through the actual Resume control
and engine tick;tab B never plays and receives an explicit pagehide event. A third
page mounts the resulting checkpoint to expose recovered progress or hearts.
A control opens its second page only after the level unlock;with no active state,
pagehide should leave the newer record byte-for-byte unchanged.

Tests assert unlocked level2 remains2 and spent hearts2 remain2. Raw before/after
revision and recovered UI values are logged. Ordinary failures stay visible;
no TODO/skip/continue-on-error. The fake clock controls scheduling;pagehide is a
synthetic lifecycle event,not a native tab-close or iPhone background test.

## Boundaries
Sandboxed Linux localhost Chromium,390px,authored local-save fixtures. No real
account,permanent XP,network writes,production or hosted mutations. Existing
source/build and UI/journey tests run before the race cases. Existing QA90 boss
terminal-recovery failure remains unchanged. No native simulator,iPhone Safari,
VoiceOver,Founder or independent acceptance. Global seed fairness and full-level
playthrough coverage are not inferred from these fixtures.

If reproduced,Gameplay owns stale-writer rejection/coordination across atomic and
legacy slots;QA retains failing contracts. Do not change save behavior here.
