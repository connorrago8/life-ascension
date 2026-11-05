# Brain Rot serialized checkpoint writes

Gameplay follow-up to QA #97 and integration #100. Design/author verification is not independent acceptance.

## Contract

All application checkpoint commits use `commitExclusive` and the origin-scoped Web Locks name `life-ascension:brain-rot:checkpoint-writer:v1`. Each invocation clones its payload before waiting. Once its exclusive callback runs, the writer checks the exact authoritative checkpoint against the snapshot it loaded/last saved, then commits the authority before the compatibility mirrors. Revision reads/serialization are followed by another freshness check, which rejects QA's injected guard-read interleavings too.

The synchronous `commit` is retained for the existing isolated protocol tests; it is not a serializable API and is not used by the application. Web Locks serialize cooperating new-version tabs, not old versions or arbitrary scripts writing storage directly. Unsupported/denied/aborted locks fail closed with no optimistic write. The existing save warning reports unavailable device saving; gameplay can remain in memory. A lock wait is bounded to two seconds.

Simulation and input remain synchronous while immutable saves queue separately. Storage latency never drops simulation ticks or changes boss timing. Saving has a visible pending state; completion clears it and failure shows the existing unavailable warning. Pause/background immediately stop gameplay, and completion of a queued save never starts gameplay again. Callbacks from recovered/unmounted writers do not reapply stale UI state. No game scores, RNG, hearts, quest XP, account/backend operations or reward rules change.

## Evidence and limitations

- Existing QA97 model tests remain unchanged; the extra freshness check rejects their scheduled stale level/heart writes.
- New deterministic owner tests cover queued level/heart conflicts, same-writer order/revisions, immutable payloads, missing/denied locks and freshness after a wait.
- New localhost browser contract uses native Web Locks across two pages at 320/390px. It holds a real lock, queues an application Start save without blocking its controls, commits an authored valid newer level while held, and checks rejection/recovery; it also checks pagehide during another queued Start cannot resume play automatically. It is not a full natural two-player race stress test or device Safari evidence.
- Inherited browser contracts remain required, including save/resume, stale-tab and boss boundaries. A new contract is added, none removed.
- Pagehide/navigation cannot guarantee completion of asynchronous storage work before a browser process exits. The one-second active autosave remains the recovery bound in ordinary play; abrupt termination can lose the unsaved interval. Never promise crash-proof last-frame persistence.
- Real iPhone Safari/VoiceOver, unsupported-browser messaging, background process termination, genuine simultaneous play stress and independent QA remain outstanding. Mixed old/new open tabs cannot receive a blanket race-freedom claim.
- The separate Town preview-link assertion seen on #100 is World/QA-owned and unchanged.

No merge, manual deployment, native simulator or production operation is authorized by this document.
