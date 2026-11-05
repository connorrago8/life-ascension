# QA: overlapping checkpoint writers

Inspected gameplay candidate: PR96 `02234ca95b551a40e8e28b731f615409a76eaf15`.
This branch changes tests, CI trigger coverage and this evidence note only.
No gameplay or persistence implementation is changed. Same agent authored PR96;
these are new regression results, not independent self-approval.

## Executed protocol model

Two isolated JavaScript VM contexts compile the actual core, game and writer
modules. Both use a shared in-memory Storage facade and load revision1. The
facade injects exactly one deterministic context switch after A observes its
guard-read value, before A continues. B then commits a valid state using the
actual writer. A receives the earlier guard value and continues its actual
writer. No function outcomes or writer internals are mocked.

1. A observes revision1 / level1.
2. B saves level2 at revision2 and reports saved.
3. A's guard receives its earlier observed value and passes.
4. A rereads revision2, then saves its stale level1 at revision3.
5. Both authoritative and legacy records contain level1; A also reports saved.

A second case follows the same schedule with hearts3→2→3. Three controls cover
B-before-A, A-before-B and a freshly reloaded peer; all retain the accepted state.
The two no-rollback assertions intentionally fail and remain mandatory ordinary
unit tests. They must not be made TODO/skipped to green the gate.

## Finding and confidence

VERIFIED BY ISOLATED TEST: the optimistic writer does not provide atomic
compare-and-replace across overlapping contexts. High potential impact is local
progress loss; medium potential impact is attempt/heart integrity. The old
sequential stale-tab defects are distinct and pass on PR96's browser evidence.

UNKNOWN: whether/how often native browsers permit this exact cross-process
schedule during application play. The facade is a scheduling model, not browser
localStorage, a real sibling page, native concurrency, or an iPhone test. No new
rendered failure is asserted. There is no account, permanent XP or server impact
established. The limitation was disclosed by PR96; this run turns that limitation
into an executable blocking contract rather than declaring a previously
undocumented fix regression.

Exact dependency: checkpointWriter.commit's separate getItem freshness test,
readCheckpoint revision read and later setItem, followed by legacy mirrors.
Increasing/rechecking revision alone cannot establish an atomic transaction.
Smallest owner next step: select a cross-context single-writer/serialization
protocol, then run these unchanged tests plus a genuine two-browser-context
stress/barrier test. Evaluate supported-browser fallback and abnormal writer exit
before claiming complete multi-tab safety. Gameplay owns any implementation.

## Evidence boundaries

The new test file is included by npm test; its failures block source-build and
candidate evidence. Existing fourteen sandboxed localhost browser suites stay
unchanged and are separate evidence. A failed unit step means the subsequent
build is not executed on this QA head. Do not cite the parent build as a build of
this test branch. Exact run/jobs and outcomes go in the GitHub checkpoint.
No hosted/iPhone/VoiceOver/Founder acceptance, native simulator, data mutation,
merge, deployment, auth bypass or production operation.
