# Independent boss boundary regression contract

Test-only branch against candidate86 at debb36f87d221785ed57e9faf6741003a740f75a.
No acceptance or self-approval of earlier authored implementation. Original
PR73 head remains a separate source identity and must be refreshed in the
checkpoint. This package does not modify gameplay, UI or storage code.

## Fresh audit question

Does every completed boss-segment write contain a run and active state for the
same selected game, including a boundary that coincides with periodic saving?

The component currently persists the advanced boss before updating activeRef to
the next mini-game. A raw storage fixture inspects that write before context
closure/pagehide can repair it. The expected invariant is:

`raw.active.state.id === raw.run.boss.queue[raw.run.boss.index]`

Setup: Level31, Jetpack first/Rune next, tick59,14990ms already accumulated.
One delivered simulation frame crosses both the tick60 checkpoint and15s
segment boundary. Capture raw checkpoint identity and selected index. This is
an interruption/recovery contract, not an account-data or XP finding.

Potential severity: Medium if reproduced. A mismatched active state makes the
atomic record internally inconsistent. The current loader may discard the
active payload and fall back; clean exits may flush a corrected record. This
fixture alone does not prove visible progress loss, an ordinary clean-navigation
failure or a full boss-run failure. Those require a crash/reload continuation
fixture and gameplay-owner repair evidence.

## Control and adversarial coverage

- Actual-component lethal Flappy frame at14990ms: lose exactly one boss heart,
  no15s credit or portal advance, segment reset and entry state restored.
- Actual-component Rune idle at14990ms: ticks advance but boss time does not.
- Pure core:50 seeded schedules each require40 complete segments and award60s
  to each of10 games; no consecutive same-game boundary.
- Pure core: late-segment retry preserves previously completed seconds and a
  cloned entry snapshot; invalid/zero time delta grants nothing.

Source checks execute independently from the intentionally strict browser job.
If the raw identity invariant fails, leave it red. Do not replace the assertion
with loader-sanitized output or a post-pagehide record, which would hide the
write-order defect. No gameplay rewrite belongs on this QA branch.

## Evidence boundaries

The workflow pins exact PR-head checkout. Browser is sandboxed Linux Chromium,
390×844, frozen clock with explicitly delivered frames,local guest storage and
intercepted network. Only localhost GET/HEAD is allowed. This is not hosted
Preview, native iPhone simulator, Safari,VoiceOver or Founder playtest.

The final GitHub checkpoint records actual run/job IDs and results. Prior
candidate86 CI and author reports are reviewed evidence, not independent
release approval. Forty pure schedule transitions are not forty played boss
segments; fairness across naturally generated game states remains unverified.

Smallest owner follow-up if reproduced: make the next run/active snapshot one
coherent save, then rerun this unchanged test plus abrupt-recovery and retry.
