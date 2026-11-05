# Brain Rot dirty checkpoint exit retry

Gameplay follow-up to QA102's native-lock timeout/Hub reproductions. Base Systems103 at fcb8ee03263f62624ecc68b869296456502111d4; source changes are isolated from World links and visual assets.

## State ownership

A mount now owns a checkpoint session separate from the writer's storage authority. Loading/recovering a saved run starts clean and never queues a write. Every simulation save captures an immutable run/active pair and marks it dirty before requesting the existing exclusive writer. Only successful completion of the latest save clears that dirty snapshot. Unavailable/rejected storage retains it.

Pause, pagehide, visibility loss and route-exit cleanup preserve the existing active-frame save. When no game is playing, they retry only this mount's dirty snapshot, including null-active completion/loss or a terminal boss. They do not save clean paused readers. Multiple lifecycle events share a latest in-flight save instead of duplicating it.

Every retry uses the original createCheckpointWriter and its Web Lock/exact raw checkpoint check; no fallback or new authority. Any conflict invalidates the entire session and loads the current checkpoint paused. Old success/failure callbacks cannot clear newer dirty state or announce a newer save as finished. Recovery/unmount invalidate notifications, but a final retry already queued before cleanup is allowed to commit through the existing authority checks.

## Gameplay and verification

Simulation/input/timers remain synchronous and unchanged. No game rules, score, RNG, XP, hearts formula, boss duration, progression format, account/backend, art, route or auth changes. No direct Storage API write is added.

Nine deterministic owner tests cover failed completion retry, heart loss retry, clean-reader/no-op behavior, old success vs newer dirty state, in-flight coalescing, conflict invalidation, unmount callback suppression, unexpected rejection, and a completed boss snapshot remaining terminal.

Local TypeScript and881/881units passed. QA102 browser file and its assertions remain unchanged and mandatory; so do sequential stale-tab, native Web Locks and all boss cases. No inherited browser suite removed/relaxed. Systems103's Town query test is a separate existing failure; this patch does not claim to fix or accept it. Exact-head CI/browser results belong in the PR and checkpoint after execution.

## Limits

A graceful client-side exit with storage available can retry; abrupt browser process termination or storage that stays unavailable cannot be promised to save. Only cooperating current-version writers share Web Locks. iPhone Safari/VoiceOver, mixed-version tabs and full natural-run stress remain unverified. This is author verification, not independent self-approval, merge permission or a production deployment. No native iPhone simulator run.
