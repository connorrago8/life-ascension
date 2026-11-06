# Flight games: gate resolution and reachable Hill Glider controls

Owned gameplay branch gameplay/brain-rot-flight-fairness-20261105, based on QA112
(d412fd887a646e1e2e580620fa0c98ed3a90fc22). No protected merge or release approval.

## Proven changes

Pre-fix Flappy engine fixtures at9/10 gates awarded the10th gate and10score when
the same frame killed the player against either post. Won remained false, so this
was incorrect transient gate/score credit, not a demonstrated level/XP grant.

All post collisions now resolve before any gate credit. A clean pass compares the
old gate/player relative position to the new one. This removes hardcoded-speed
scoring, prevents idle credit from an accepted stationary post behind the player,
and counts legitimate rightward steering through the clear gap. Reverse movement
and already-passed posts grant nothing. Existing flight physics, gap generation,
energy/XP, hearts and boss rules are unchanged.

Twelve new deterministic tests cover top/bottom lethal contacts in either entity
order, clean final-goal pass, stationary/future/reverse passes, steering, another
lethal pair suppressing all frame credit, exact previous-plane boundaries, and actual generated gaps at3tiers ×
30seeds with serialized replay. Source success is not human balance acceptance.

This batch also carries existing owned Hill Glider work from PR110/b4477a4 and
22e654d: hill momentum/earned landings,6/9/12goals, no-input/constant-hold stall,
validated airborne state, legacy challenge restart preserving run/hearts, and a
280px arena with initial control navigation hit-tests. No new visual assets.
See brain-rot-hill-glider.md for physics and migration details.

## Browser scope

New flappy-gate-resolution suite uses authored near-clear/lethal/stationary
snapshots at320/375/390/430px. Actual Resume, simulation tick, result callbacks,
heart/level updates and native checkpoint saves run in the application. Clear
advances exactly one level; lethal spends one heart without advancing; stationary
idle retains9gates/90score. This is controlled-state browser execution, not a
natural full-level or full-boss playtest. Stationary gates are a structurally
accepted adversarial save, not a claim of normal generated stationary terrain.

The carried Hill Glider browser suite checks real controls, pause/save and idle
loss at all four widths. Its280px viewport correction remains pending until this
branch's exact-head CI and screenshots execute. All requests are sandboxed
localhost GET/HEAD with blank backend configuration; no real account data.

## Integration and risks

Owned commits were cherry-picked into this isolated branch. Only workflow trigger/
artifact and browser-manifest/count conflicts occurred; resolution retained camp,
two-writer controls, every original QA suite and all attempt-bound gates.26required
browser suites include new Hill Glider and Flappy coverage. No shared branch edits.

QA112 remains RED for authored-peer serialized/native conflict application cases.
Direct writer controls pass but do not identify a safe source repair. This batch
makes no writer/session/recovery implementation change and retains the red tests.
Root cause and natural two-player reachability remain unresolved; no delay-based
save workaround or new storage-authority migration is claimed.

Final exact CI/results and asset IDs belong in the PR checkpoint. Independent QA
is required; no self-approval. No native simulator, iPhoneSafari/VoiceOver, natural
full-run, current hosted Play, production data, auth/protection, merge, manual or
production deployment acceptance is implied.
