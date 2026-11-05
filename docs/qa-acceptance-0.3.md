# LIFE ASCENSION 0.3 — QA Acceptance Checklist

**Purpose:** Execute this against one explicitly identified QA Preview deployment. This is a test plan, not evidence that any test has passed.

## Before testing

- [ ] Record deployed Git SHA and Preview URL; confirm SHA equals the approved candidate.
- [ ] Alpha records effective runtime QA Supabase project identity for browser and server write paths using non-secret evidence.
- [ ] Alpha records successful recoverable QA backup and isolated restore evidence.
- [ ] Confirm required receipt-v2 and earned-armor schema is present in QA only; do not run hosted migrations until separately authorized.
- [ ] Use a dedicated QA account and record starting XP, level, quest instance ID/status/progress, owned equipment, and equipped slots.
- [ ] Capture device/browser, app build SHA, date/time, and tester.

## A. Quest completion and exactly-once XP

- [ ] Complete one eligible real-life quest once.
- [ ] Confirm the UI reports success only after the server confirms it.
- [ ] Confirm lifetime XP increases by exactly +1 and level/threshold reflect the authoritative total.
- [ ] Repeat the completion request with the same request/receipt ID; confirm no second XP award.
- [ ] Simulate a lost response or refresh after submission; retry safely and confirm XP is still awarded at most once.
- [ ] Open a second account/session and confirm the first account's progress/XP is not shown or modified.
- [ ] Sign out and back in; confirm persisted XP and quest status remain consistent.

## B. Progress tracking and recovery

- [ ] For a tracked quest, add one progress step; verify the server-confirmed amount.
- [ ] Rapidly tap the progress action; confirm one operation at a time and no duplicate amount.
- [ ] Test a network failure and retry; verify no optimistic false success and no duplicated progress.
- [ ] Test invalid, over-target, stale, completed, and deferred progress states; ensure no misleading Quick-add action.
- [ ] Verify due dates remain the same calendar day on the target timezone/device.

## C. Equipment ownership, equipping, persistence

- [ ] Verify an item is locked before its required unlock condition.
- [ ] Complete the intended unlock condition; confirm server-backed ownership appears once.
- [ ] Equip the owned item; verify the correct slot and authoritative server result.
- [ ] Rapidly tap equip and trigger a failed equip request; verify no duplicate mutation and the lock releases.
- [ ] Refresh the page and sign out/in; confirm ownership and equipped appearance persist.
- [ ] Attempt an unauthorized/non-owned item equip using normal UI; verify rejection and no state change.
- [ ] Confirm another account cannot view or alter the test account's equipment.

## D. Forgotten Crypt playable loop

- [ ] Enter the Crypt from the intended player navigation.
- [ ] Complete the introductory exploration/inscription encounter and make each available choice.
- [ ] Complete a normal combat encounter and verify enemy/player turns and state transitions.
- [ ] Exercise stale/double combat action protection.
- [ ] Reach the Sentinel encounter; verify victory and defeat paths.
- [ ] On defeat, return to map, retry, and confirm old combat history/state does not leak into the new run.
- [ ] Confirm retreat/retry/refresh behave safely and do not corrupt the player session.
- [ ] Verify Crypt replay does not grant permanent real-life quest XP or farmable XP.
- [ ] Confirm rewards are reported only when actually persisted/earned.

## E. Mobile and accessibility (real iPhone Safari)

- [ ] Record iPhone model, iOS version, Safari version, viewport, and tested SHA.
- [ ] Sign in, complete a quest, inspect XP, equip an item, enter Crypt, and refresh.
- [ ] Test Home Screen launch if installed, browser back/forward, and session restoration.
- [ ] Check 320/375/390/430 px layouts, keyboard focus, scroll position, modal dismissal, and no clipped controls.
- [ ] With VoiceOver, verify labels, focus order, announced state changes, and actionable control names.
- [ ] Confirm no console/runtime errors that prevent the player journey.

## Result record

For each test, record **PASS / FAIL / BLOCKED / NOT RUN**, exact steps, expected vs actual, screenshot/log reference, account/test fixture, and SHA. Do not mark a section passed from source inspection alone.

| Section | Result | Evidence link / defect |
|---|---|---|
| Preflight / isolation | NOT RUN | |
| Quest + exactly-once XP | NOT RUN | |
| Progress recovery | NOT RUN | |
| Equipment persistence | NOT RUN | |
| Crypt loop | NOT RUN | |
| iPhone Safari / VoiceOver | NOT RUN | |

## Exit criteria

QA acceptance requires all P0 sections to pass against the same deployed SHA, with no unresolved data isolation, duplicate-XP, unauthorized mutation, or player-progress-loss defect. This checklist does not authorize deployment, hosted migrations, Production changes, or release.
