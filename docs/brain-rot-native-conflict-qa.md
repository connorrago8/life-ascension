# Native conflict recovery QA

Test-only child of PR104 (5bf160f20cd2c701e0969deee2c15eecf749c3e3).

The earlier PR104 run42081684612 timed out waiting for Level2 during native-lock recovery; final run42082543361 passed with diagnostics only. Cause remains unknown. This suite adds controlled evidence; it does not repair or replace that original unmodified real-time contract.

## Executable contract

`tests/browser/brain-rot-native-conflict.qa.mjs` runs16 cases: 320/375/390/430px, accepted peer completion or heart loss, two repetitions. Real browser origin Web Locks hold the player's queued Start. A valid authored peer checkpoint advances level1→2 or hearts3→2 at revision2. Native storage events and lock release must recover the visible player paused; stale queued Start and subsequent Hub teardown must preserve the entire peer checkpoint byte-equivalent as parsed JSON, including revision and null active state. Return must display the same level/hearts. No animation clock advancement, mocked locks, synthetic storage events, external requests or backend writes.

The browser clock is frozen to isolate persistence ordering from accidental game simulation. A native lock barrier drains requested saves before durable assertions. Holder acquisition resolves from the actual native grant callback. Fixtures are valid source-authored outcomes, not natural concurrent player victories, randomized fairness proof or a timing-distribution benchmark. Repetition is bounded; passing16 cases cannot explain or dismiss an intermittent earlier timeout.

Mandatory manifest adds this suite; receipt coverage expands19→20. Existing suites and gate requirements remain intact. Workflow adds the parent branch trigger only. Application/gameplay/schema/XP/auth/deployment files are unchanged.

## Evidence boundary

Local syntax check and20 gate/runner tests pass. Browser and final-head CI results must be read from the PR run, not inferred from these checks. Same agent authored the parent implementation: no independent self-approval or release acceptance. Hosted Preview, Safari, VoiceOver and native iPhone remain unverified; native simulator is postponed. A failure should include case, width, repetition, durable checkpoint and visible main text, with errors/blocked requests, then fail the normal assertion.
