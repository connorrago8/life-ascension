# Consolidated candidate evidence — November 5, 2026

Integration increment over Systems99 `63fe12e4321db7f967c122d03506acace3729c3f`.
Only CI orchestration,receipt verification and regression tests change here.
No gameplay/UI/world/XP/storage/authentication or hosting implementation changes.

## Independent execution, all required

| Family | Evidence scope |
|---|---|
| source-build | TypeScript,guarded synthetic QA build and browser-bundle scan |
| unit-tests | Full source/unit suite,including ordinary failing QA regressions |
| browser-smoke | Thirteen sandboxed localhost browser suite receipts |
| boss-boundary | Three sandboxed localhost boss suite receipts |

The four jobs have no dependency on one another. A known unit regression must not
prevent discovery of a separate build failure. Conversely,a successful build
cannot stand in for unit success. No continue-on-error,skips,TODOs or optional
assertions are introduced. Existing QA97 model failures remain unchanged.

Each family checks out the explicit full PR head and always attempts its receipt
upload. Receipts use actual git HEAD and the job outcome. The final gate waits
for all four,then requires both successful receipts and successful actual GitHub
job results. Missing,wrong-head,duplicate,failed,skipped,cancelled or unknown
families reject. Unit upload/job failure overrides an earlier success receipt.
The verifier aggregates every rejection and always returns releaseAuthorized:false
even in a fully green case. CI is not independent acceptance or Founder approval.

The build retains the existing guarded synthetic configuration:invalid-signature
fixture key,TEST-shaped public identity,public-key fingerprint and QA bundle scan.
It performs no hosted configuration changes or deployment. Unit/browser jobs have
blank backend variables and no hosted credentials. Permissions remain contents:read
and checkout credentials are not persisted.

## Complete browser receipts

The explicit browser manifest requires16suites(13smoke,3boss). Each runs in an
isolated Node child. A failed/crashed/timed-out child remains failed while later
suites are attempted. Incremental actual-SHA/name/file/exit/signal/error receipts
are embedded in the family receipt. Missing,duplicate,unknown,wrong-file or
nonclean outcomes reject. Parent cancellation/timeout still blocks the gate.
Artifacts and Actions summary tables retain scoped results despite a red family.

Current app coverage includes checkpoint validation/navigation,Jetpack,Lantern,
cross-feature saves,Hub/Town four-width presentation,Crypt continuation/combat/
inspection,Town development-mode continuity,sequential stale-tab control and
boss boundary/handoff/recovery. Authored fixtures remain identified in their
individual test docs. Browser process success is not full-run or device coverage.

## Current boundaries and ownership

QA97's deterministic overlapping-writer model still fails two no-rollback
contracts;native browser reachability is unproven. Gameplay owns any protocol
repair. This integration change collects build evidence while retaining that
rejection. No failing test implementation is edited.

Integration owns the workflow,receipt gate and this documentation. World/UI/
Gameplay/QA source ownership is unchanged. Native simulator remains postponed;
no hosted/iPhoneSafari/VoiceOver/Founder/independent acceptance is implied.
Current full SHA,exact run/jobs,outcomes and deployment identity belong in the
GitHub checkpoint after execution. No merge,manual deployment,auth bypass,
production data or protected-branch change is authorized here.
