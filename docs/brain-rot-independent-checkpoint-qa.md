# Independent checkpoint QA — November 4, 2026

Source under review: PR #73, `93ed0e5818d586285929515946c51228d3c53ecd`,
base `6a93a984c0cb1de18a2f535d12b31043bc05fcaa`.
This branch adds tests, a read-only CI workflow and this report only. It does
not change gameplay, saves, account data or release settings. It does not
approve PRs #80/#81, authored earlier in this thread.

## Evidence and scope

Original run `41280104547` passed build job `124770110632` (121 tests and a
compiled build) and SQL job `124770110435`. It contains no browser job. A fresh
Vercel branch lookup returned no deployment for PR #73; no hosted route or
iPhone behavior is certified. No native simulator was run.

Existing `tests/brainRot.test.mjs` passed locally. The independently added
checkpoint contract has one pass and three failures on the unchanged source:

| Contract | Executed observation | Scope |
| --- | --- | --- |
| Valid atomic boss record is self-contained | PASS: 8,000ms, hearts and active state round-trip without split legacy keys | Core/storage fixture |
| Active record is structurally safe to render | FAIL: `{id}` lacking player/entities/grid remains authoritative | Core/storage fixture |
| Active game belongs to the run's current game | FAIL: another valid mini-game state is accepted at the same level | Core/storage fixture |
| Legacy fallback obeys the boss validation contract | FAIL: `readRun` returns Level 31 with no boss although `validRun` rejects it | Core/storage fixture |

These synthetic device-state fixtures do not establish an account security or
server persistence defect. Recovery may discard the invalid active state or
reject the checkpoint; tests do not require a particular UI implementation.

## Browser acceptance cases

The separate unprivileged Chromium job uses the real component on localhost,
empty hosted credentials, a frozen gameplay clock and blocked external
requests/HTTP writes. It is independent of the core-contract job, so a unit
failure cannot skip browser execution. Browser outcomes must be read from the
exact QA candidate's CI logs; they were not executed locally when this report
was written.

1. **Valid atomic-only resume:** use the real engine to make eight Rune moves,
   store a complete checkpoint without the two legacy keys, load the game,
   compare its displayed saved board, activate Resume with time frozen, and
   require the board to remain identical. Source concern: mount reads atomic
   state; `start()` reads `readActive()` or boss state instead of the loaded
   atomic active record. No move or elapsed tick should replace the board.
2. **Malformed active recovery:** store a checkpoint whose active state has only
   its valid game ID. Load the real page. Require no uncaught page error and a
   usable fresh Start action. Source concern: accepted state is cast directly
   and `Surface` dereferences `entities`, `grid` and `player` without validation.

The first is a valid checkpoint recovery contract. The second is an adversarial
corruption/migration-recovery contract, not proof that ordinary saves corrupt
themselves. Neither fixture uses real accounts or claims XP/gear behavior.

## Severity and next verification

- **Potential High:** a valid saved board being replaced on Resume would lose
  run decisions. Requires the actual browser result above before confirmation.
- **Medium:** malformed device state accepted by the loader can reach unsafe
  render paths. Actual crash behavior requires the second browser result.
- **Medium:** source-confirmed validation inconsistency between atomic and
  legacy boss loaders. UI softlock and migration reachability remain untested.

Smallest gameplay-owner follow-up: establish one authority for loaded active
state and validate active shape/game identity plus legacy boss shape before
using it. Preserve recoverable progress; do not silently reinterpret corrupt
records as a successful run. Gameplay repair belongs in its owner's branch.

Keep these acceptance assertions red until the corresponding behavior is
corrected. They are not a green release gate, a Production recommendation or
an independent acceptance of fixes authored in another role.

## Test instructions

`node --test tests/brainRotCheckpointReliability.test.mjs` executes the four
storage contracts. To execute the real-component cases, start a local dev
server on port 3138 with public Supabase variables empty and run
`QA_BASE_URL=http://127.0.0.1:3138 CHROMIUM_BIN=/path/to/chromium node --test tests/browser/brain-rot-checkpoint.qa.mjs`
as a sandbox-capable non-root user. No Preview protection changes are needed.
