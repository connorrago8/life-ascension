# QA: native save timeout followed by graceful Hub return

Parent candidate: Gameplay #101, f29dda31045a68823a456bfa087a1b125f371439. This branch changes tests, evidence registration and this record only. It does not approve gameplay authored earlier in this conversation.

## Question

After a save visibly fails while a real browser-origin Web Lock is held, does graceful Hub navigation retry dirty stopped-run state once the lock has been released?

The owner covers queued success, freshness conflicts and paused recovery. Timeout plus an already-stopped terminal frame is a distinct lifecycle boundary. Source `pause` persists only when `wasPlaying && active` and not a won boss; completing a level or losing a heart has already stopped play and cleared active state.

## Executable tests

`tests/browser/brain-rot-save-timeout.qa.mjs` uses real sandboxed Linux Chromium, two same-context pages, a native exclusive Web Lock and authored valid saves. Gameplay time and the 2-second AbortController timeout are advanced by Playwright's virtual clock. The LockManager is not replaced. Requests outside localhost GET/HEAD are blocked.

1. Rune fixture joins two64 tiles through normal controls, reaching Level2. The lock remains held until both Start/completion saves time out. Confirm the explicit unavailable warning, release the lock, use an exclusive no-write barrier to prove availability, then Back to Hub and return. Expected: dirty Level2 survives a graceful exit. Log durable/rendered before/after and revision.
2. Flappy fixture loses one heart through a real lethal frame. Repeat the timeout/release/Hub sequence. Expected: heart2 remains2 after return.
3. Control: after the same failed completion and released lock, explicitly Start the next challenge, drain its save, Pause, then Hub/return. Expected: Level2 persists through this explicit retry.

Before execution, the first two are source-supported hypotheses, not confirmed defects. Their expected values are normal assertions, not skips/TODOs. Results will be recorded in the PR/checkpoint after exact-head execution. The control distinguishes a broken writer/released-lock fixture from a missing lifecycle retry.

## Severity and boundaries

If reproduced, classify the graceful-exit loss as a conditional device-local persistence defect, with medium severity given the explicit keep-tab-open warning. Heart restoration is the same failed-save lifecycle cause, not evidence of account XP or backend exploitation. This is not abrupt process termination; the native lock is demonstrably free before navigation.

Smallest gameplay verification after reproduction: track dirty failed snapshots independently from playing/active state and evaluate a stale-safe final retry. This is a recommendation, not an implementation or assignment.

No gameplay code, account data, XP, auth, production operation, native iPhone simulator or deployment changed. No independent self-approval: this agent authored the earlier gameplay repair. New adversarial evidence can reject a contract but cannot serve as independent acceptance of its own implementation. Real iPhone Safari, VoiceOver, process-kill recovery, mixed-version tabs and full natural-run concurrency remain unknown.
