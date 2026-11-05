# Boss portal checkpoint handoff
Owner: Gameplay. Draft, no merge/release approval.

## Confirmed trigger
QA87 and integration88 reproduce a 15-second boss switch coinciding with tick60:
the atomic run selects Rune Fusion while its active state remains Goblin Jetpack.
Prior integration88 head: 77b66070b88a8eb33fe2bda2773a8b7f2230930d; failing run41990363954/job127120883411.
This proves raw checkpoint inconsistency, not previously observed user progress loss.

## Change
Resolve loss, final victory and portal handoff before periodic writes.
A pure handoff helper preserves the outgoing bank, clones the incoming bank
(or creates its first state), and establishes an independent retry snapshot.
Update the active reference before persisting the matching boss. Save both legacy
active and atomic checkpoint with the incoming game. Completed boss clears active.
No clock duration, difficulty, heart, Rune meaningful-move or reward rule changes.

## Verification scope
Keep the original QA87 browser file unchanged. Add deterministic bank/retry,
same-game rollover, aliasing and terminal guards. Add browser inspection of every
atomic write on a boundary, recovery in a fresh context from only that captured
record (no clean pagehide/legacy repair), and the final segment's terminal save.
The consolidated exact-head workflow runs these with existing lifecycle, controls,
Hub, Lantern and isolation suites. Green author CI is not independent QA acceptance.
Hosted Preview, iPhone Safari/native simulator, VoiceOver and Founder playtest are
separate and unclaimed. No protected branch, production, database, XP, auth or
Preview-protection changes.

## QA next
Independently reproduce the original boundary case and verify abrupt recovery,
incoming retry snapshot, third-heart reset and all forty segments on a protected
nonproduction deployment at the exact reviewed SHA when available.
