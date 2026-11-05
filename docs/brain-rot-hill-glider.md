# Hill Glider: earned landings, not elapsed time

Owned gameplay scope: gameplay/brain-rot-hill-glider-20261105, isolated from
PR73 and based on Integration108 a60212497bef6f533dfc72711e1d7479c86dde44.
Visual109 is not included: its camp browser contract currently fails focus visibility.

## Confirmed problem and resulting behavior

Before this change, a no-input deterministic simulation cleared Hill Glider in
50/50 seeds at tier1. The generic timer awarded progress once per second while
ceiling parking avoided hazards. This was an engine reproduction, not a browser
or Founder playtest. Other sampled games did not clear idle in that same sample.

Hill Glider now has its own terrain/momentum/launch/landing loop. A sine hill profile
is shared between rendered terrain and engine collision. Hold dives downhill to
build speed; release on an uphill launches; diving onto a descending hill after a
real flight awards one landing and10 score. Staying grounded awards nothing.
Targets are6/9/12 clean landings across three tiers; no timer victory remains.
This is an authored repeated course, not a claim of procedural hill variety.

Engine constants at the existing60Hz fixed-step simulation:
- terrain height .66-.16*cos(distance*2π/1.4); avatar radius .035;
- initial speed .004, ground speed range .0006–.012;
- ground acceleration slope*.00028 diving, slope*.00006-.000018 released,
  then .998 drag;
- release launches on slope<-.2 with speed>.0045;
  vertical launch velocity slope*speed-.002;
- flight gravity .00065 diving, .00006 released;
- clean landing requires downward flight, active dive and downhill slope>.04;
  clean landing speed boost .0015 capped.012; other landing speed*.55;
-90 consecutive frames below.0015 speed cause a normal challenge loss.

This introduces no XP, currency, reward, slot or account power. The existing run
reducer alone spends hearts on loss; Level31 still requires40 completed15s banks.
Boss goal remains MAX_SAFE_INTEGER, so clean landings cannot terminate its segment.

## State and controls

Optional `glide` state contains distance/grounded/stall. Serialization retains
exact airborne physics; validator rejects nonfinite/out-of-range values and wrong
mini-game IDs. Existing snapshots without glide remain parseable. A legacy glider
challenge restarts with zero timer credit; run level/hearts are preserved. Start
shows a migration notice. Legacy boss snapshots retain their boss bank/time rules;
engine fallback initializes only the mini-game state when required.

Surface reuses the existing wing avatar; an SVG terrain polygon is generated from
the collision function, not new visual assets. Hill Glider removes unrelated arrow,
flap and slice controls. Hold to dive captures pointer release/cancel; Toggle dive
is a tap/keyboard alternative with aria-pressed. Space and arena hold still work.
The280px Hill Glider arena keeps dive controls above bottom navigation on the
four tested initial viewports without changing normalized physics.
Phase and stall cues are textual; no sound/color dependency. Pause and lifecycle
save paths are unchanged. Press rejects gameplay input while paused.

## Verification scope

Twelve deterministic tests cover all tiers,50seeds idle and constant dive,20seeds
successful timed play, genuine launch-to-landing credit, no grounded repeat credit,
airborne replay/input immutability,15s boss play, legacy migration, malformed saves,
and paused/terminal immutability. Full local suite901/901 and TypeScript passed
before publication; final exact-SHA CI results belong in the PR checkpoint.

Mandatory localhost Chromium suite checks320/375/390/430px, actual controls,
terrain,44px targets with initial navigation hit-tests, toggle/Space release, paused immutable save, and a fresh
no-input challenge actually losing one heart without advancing its level.
It uses authored seeds and a controlled clock, native locks, sandboxed non-root
Chromium, blank backend configuration and GET/HEAD-only localhost requests.
Screenshots and receipts must come from that actual CI execution.

Engine controllers are not human balance testing. Browser input checks are not a
natural full-level win, full boss, real iPhone Safari, VoiceOver or native simulator.
No native simulator was run. Timing tolerance, beginner learnability and repeated
hill variety require independent play review before acceptance.

## Integration boundaries

Existing checkpoint/session/writer code and all prior QA cases remain unchanged.
Parent108 native-conflict intermittency remains unresolved, even if a later run
passes. This batch does not repair or certify it. PR109 visual failure remains
separate; no visual branch changes or self-approval. All mandatory suites and
run/attempt-bound gates stay fail-closed (23suites with this addition).
No production data, protected-branch merge, hosting/protection change or deployment.
