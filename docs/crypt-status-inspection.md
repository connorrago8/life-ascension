# Crypt combat status inspection

Owned visual branch: visual/crypt-combat-controls-20261105.
Base: PR113 / 8a8f3cb73c19549dc339b0f748589827fb939055.
Draft implementation; not release approval or a gameplay balance change.

## Presentation and interaction

The existing collapsed Statuses control remains the entry point. Expanded inspection
now has separate Enemy and You groups, text owner labels and effect counts. Empty
enemy effects are explicitly identified. Enemy Block includes its name alongside
its value. The old six-icon summary is removed; the numeric total remains.

Each group contains wrapping, at-least-44px effect controls. One selected effect
shows its existing authoritative help text immediately below its own group, with
owner/name heading, static mint side mark and a linked aria-controls target.
Selection has an inset mark plus aria-expanded, independent of color. No effect
formula, application order, card forecast or timing was rewritten.

Tab follows normal document order; this is a disclosure, not a modal or focus trap.
Enter activates effects. Escape from within expanded inspection closes it and
returns focus to Statuses. A bottom Hide statuses action offers the same operation
for touch users. Closing clears the selected explanation. End turn remains outside
the inspection surface and keeps the existing reducer handler.

CSS is scoped to combat/status inspection. Charcoal surfaces, restrained mint,
gold keyboard outline, 8px control gaps, wrapping text, no animation. Scroll margin
reserves room for fixed navigation when focusing/scrolling effect buttons.
No new visual assets or additional screens.

## Executable verification

Mandatory crypt-status-inspection browser suite uses an explicitly authored active
combat state with six enemy and ten player effects. At320/375/390/430px and normal/
200% root text it checks real Tab/Enter/Escape, focus outline, accessible disclosure
and help targets, single explanation, owner groups,44px unobscured controls, text
reflow, reduced motion and read-only checkpoint invariance. It then sends actual
End turn, compares all state to unchanged reduceDelve and reads updated Burn.
An authored empty-enemy display variant verifies the empty message.

Nine screenshots are captured to artifacts/crypt-status. Localhost sandboxed
non-root Chromium only; external/non-GET requests abort. A root-font fixture is
not native browser zoom, iPhone Dynamic Type or VoiceOver testing. Authored status
combinations are not naturally earned gameplay or account-save certification.

The browser manifest requires27total suites; prior writer/recovery regressions
remain mandatory and unchanged. Workflow adds only the parent branch event and
attempt-scoped screenshot artifact; no hosted guard, credential or release changes.

## Boundaries and remaining risk

PR113 is RED for a375px ordered heart-loss actual-two-writer test: saved/saved
rather than saved/conflict, with stale three-heart state replacing the spent-heart
checkpoint. No writer/session code is changed here. Intermittency remains unresolved
even if a subsequent execution passes. Independent QA and permitted device review
remain necessary. No native simulator, permanentXP, quest/streak, auto-equipment,
production data, auth/protection, merge or manual deployment changes.

Final exact-head CI IDs, screenshots and results are recorded in the PR checkpoint.
