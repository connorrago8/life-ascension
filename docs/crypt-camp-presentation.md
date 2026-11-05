# Crypt camp: readable build and gear controls

Owned scope: visual/crypt-camp-equipment-20261105, based on Integration108
`a60212497bef6f533dfc72711e1d7479c86dde44`. Draft implementation, independent review required.

## Player-facing change

Camp-only CSS replaces the fixed hero summary grid with wrapping columns and gives
attribute descriptions, remaining points and each gear item's name/rarity/slot/bonus/
passive a stable reading order. Existing rarity borders remain, with textual rarity
and slot so color is not the only identifier. Wear/Take off and attribute controls
have at least48px targets, visible keyboard focus, wrapping labels and bottom-nav
clearance. Reduced motion disables camp button/sprite animation and transitions.
Existing Living Dark tokens and adventurer art are reused; no new sprite created.

The old “3 more points” sentence contradicted the current pointsForLevel helper.
The displayed increment now derives from that helper (currently2). This changes
copy only, not points, real-quest XP, streaks, stat effects or progression rules.

DelveRun changes only Camp markup/import/copy/live Wear summary. Allocation,
explicit Wear, same-slot replacement, save and Start handlers are unchanged.
No Brain Rot, checkpoint, account equipment, route or persistence implementation edits.

## Browser contract and limits

Development-only `/qa/crypt-camp` renders the actual Camp/DelveRun with Level3,
zero draft attributes and four demonstration gear IDs. Callbacks return visit-only
save feedback and cannot write an account. This route returns404 in non-development
builds. It is a display/control fixture, not earned loot or a natural playthrough.

`tests/browser/crypt-camp-presentation.qa.mjs` uses non-root sandboxed Chromium,
blank backend configuration and localhost GET/HEAD-only request interception.
At320/375/390/430px and normal/200% root text it asserts horizontal fit, unclipped
text,44px minimum unobscured targets, keyboard activation/focus and reduced motion.
It exercises Raise/Lower, initial empty wear, explicit Wear, same-slot replacement,
Take off, honest visit-only Save feedback, and verifies chosen Strength/loadout
reach actual deck selection. Raw localStorage must remain unchanged.
Eight full-page screenshot artifacts are required in CI; the suite is mandatory,
added before the existing final checkpoint-races entry. All previous suites and
run/attempt-bound fail-closed receipts remain required (23suites total).

Execution and render results must be read from the exact PR-head CI, not inferred
from this specification. These checks do not certify native zoom, iPhone Safari,
VoiceOver announcements, account persistence, natural run completion or hosted Play.

## Boundaries and next verification

Parent108 has three intermittent native-conflict browser-fixture failures in run
42093232016/attempt1; no fix, skip or reinterpretation here. Root cause and natural
two-application-writer reachability remain unresolved, owned by Gameplay/QA.
Independent review should compare normal/large-text camp renders and verify focus,
Wear announcements and bottom safe area on a real iPhone when authorized.
No native simulator, production merge/data, hosting protection or deployment change.

## Focus and explicit Worn follow-up

The first camp run42096731900 failed after a pointer click followed by programmatic
focus in its second text-size iteration. That does not establish keyboard modality
for :focus-visible. The contract now starts at Enter Floor1 and sends an actual
Tab: disabled Lower Strength is skipped, Raise Strength must become active and
match :focus-visible, its outline must be visible, and Enter must allocate a point.
The check runs in both text sizes at every width; no outline assertion is removed.

Worn entries now have a static inset mint frame and quiet surface, in addition to
the existing Worn text and aria-pressed state. Rarity/slot remain text. No item is
selected automatically. Remaining point text has a polite atomic live region.
These states add no animation, equipment mutation or power. Existing handlers,
attributes, gear bonuses, Start and save semantics remain unchanged.

This child branch contains only presentation/test/docs/workflow-trigger edits,
with PR109 as base. Full new-head CI and actual eight renders are required; this
record does not claim they have executed. Independent review remains pending.
