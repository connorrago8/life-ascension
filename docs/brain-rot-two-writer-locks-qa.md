# Two actual checkpoint writers: native browser contract

Test-only QA branch qa/brain-rot-two-writer-locks-20261105; base Visual111
b686303999a450723471fc50d30c38fdc34441d8. No gameplay source edits or approval.

## Question and distinction

Can two writers created from the same checkpoint generation both report saved,
letting a queued stale Start overwrite a completed level or restore a spent heart?
QA105 authors the competing peer snapshot directly while holding a native lock.
This new suite instead executes the repository's actual createCheckpointWriter /
commitExclusive code in two browser documents. It does not mock LockManager,
localStorage, writer.commit or storage events, and does not write the winning
checkpoint by hand. Only the initial fixture is seeded.

The module source is TypeScript-transpiled in the test, then installed in the
browser documents without rewriting the application. Actual BrainRot routes are
loaded, but these extra module writers are driven by controlled test calls rather
than human gameplay handlers. This is not a natural simultaneous-player playtest,
and browser process isolation is not asserted.

## Sixteen cases and exact oracle

320/375/390/430px × level-completion/spent-heart candidate × ordered/simultaneous
arrival. Every case starts at revision1, Level1, hearts3. WriterA proposes a valid
Start snapshot; writerB proposes Level2/null-active or hearts2/null-active.

A third document holds the actual native checkpoint lock. Both writers queue
commitExclusive behind it. Native query must show two pending requests. Releasing
the lock permits normal writer code to run:

| Contract | Required result |
|---|---|
| Ordered B then A | B saved; stale A conflict |
| Simultaneous invocation | Exactly one saved, the other conflict; winner unspecified |
| Authority and legacy mirrors | Fresh reader sees the winning run/active at revision2 |
| Rendered recovery | Fresh BrainRot route shows winning level and hearts |
| Fresh authority remains usable | A new writer saves the unchanged winning state at revision3 |
| Isolation | No unrelated storage mutation, page errors or external/write requests |

A completed-level/heart candidate losing a truly simultaneous contest is not
asserted to win. Conflict-retry product policy and competing earned outcomes need
separate evaluation. This contract checks serialization/freshness, not that policy.

The simulation clock is frozen so timer-driven gameplay cannot obscure the writes.
The browser's actual LockManager queue is not clock-mocked. No real account,
backend, XP, inventory or production storage is used. HTTP is localhost GET/HEAD
only; non-root sandboxed Chromium is required. Failures log native storage events
and final local checkpoint values; assertions remain mandatory, not retries/TODO.

## Evidence and limits

Local889 unit tests/TypeScript pass before publication; browser execution is CI-only
in this environment. Results must be read from the exact QA-head run, not inferred
from schedule or upstream passes. Existing native-conflict intermittency remains
unresolved even if this new control passes. It does not test all browser/Safari
storage-coherence schedules, natural two-application writer reachability, route
teardown, account saves, iPhone or full boss play.

Earlier gameplay/UI changes were authored in this same conversation. These new
checks are additional evidence, not independent self-approval or release consent.
Separate reviewer acceptance remains required. No native simulator, merge,
deployment/protection change, production data or automation-setting change.
