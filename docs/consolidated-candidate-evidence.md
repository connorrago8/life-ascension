# Consolidated candidate evidence — November 5, 2026

This integration increment builds on Visual94 `9d10e8dadd5fedf7203554563c8add980f73db97`.
It changes CI orchestration/evidence only, not application, gameplay, UI, storage,
quest XP, credentials, hosted configuration or release permissions.

## Complete execution and complete rejection

`scripts/browser-contracts.mjs` is the explicit required coverage manifest:
11 browser-smoke suites and three boss suites. The runner launches each in a
separate Node process, preserving its existing test arguments and inherited
blank-backend/localhost/sandbox settings. A failure, launch error, signal or
180-second child timeout is recorded as failure, and the next suite is attempted.
No failure becomes optional, skipped, TODO or continue-on-error. A parent job
cancellation or job timeout still blocks the final gate.

The runner clears its report first and writes incremental per-suite receipts to
`browser-contract-evidence/<group>.json`. It records actual full git checkout,
name, file, result, exit code, signal, error and elapsed duration. It prints a
`CONTRACT_RESULT` line and an Actions summary table. This allows a failed early
suite to coexist with useful later render/test evidence. A partially written or
missing report never qualifies as complete execution.

The existing always-run family receipt step embeds those suite results in its
uploaded JSON. `verify-release-receipts.mjs` requires all three family receipts,
actual GitHub job success, and every required suite exactly once at the expected
full SHA and expected file with clean exit0/no signal/no launch error. Rejection
aggregates all defects rather than stopping at whichever failed family was read
first. Wrong-head, missing, duplicate, unknown, swapped-file and misleading
success-text receipts are rejected. The verifier never authorizes release.

## Current known candidate boundaries

The inherited QA90 completed-boss Resume and QA93 stale-tab level rollback / heart
restoration tests stay unchanged and blocking. Gameplay owns those repairs; no
repair is claimed here. Visual94's four-width Crypt renders and World92's guided
Lantern/continuation checks stay in the complete manifest. Source/build includes
TypeScript, full unit suite and the guarded synthetic QA build/bundle scan.

Linux sandboxed localhost Chromium is not hosted Preview, iPhone Safari,
VoiceOver, native simulator, Founder playtest, independent QA or a natural full
run. Per-suite success says only that that process completed its assertions at
this SHA. It does not change the meaning of fixture-based tests.

## Ownership and maintenance

Integration owns the runner, coverage manifest, workflow, receipt verifier and
regression tests. Add a new mandatory suite to the explicit manifest when adding
its CI coverage; the gate then rejects an omitted execution. Preserve existing
non-root browser checks, request isolation, fail-closed hosted branch guard and
contents:read permissions. No merge, manual deployment, auth bypass or production
operation is included. Exact head/run/job outcomes and deployment identity are
posted in the single run checkpoint after execution, not assumed from this doc.
