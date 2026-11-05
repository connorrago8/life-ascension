# Brain Rot checkpoint writer and terminal authority

Gameplay increment over Integration95 `2142737c020dd45c117f4bfcb77913119266f4df`.
Addresses QA93 sequential stale-tab rollback/heart restoration and QA90 completed
boss Resume. No level goal, energy, score, XP, input mapping, art, route or
account/database changes.

Each mounted dungeon owns a checkpoint writer bound to the exact serialized
checkpoint it loaded or last accepted. A changed/missing record causes a
conflict before any authoritative or legacy write. Accepted saves write the
checkpoint first, then compatibility mirrors. Failed checkpoint writes never
update those mirrors and retain in-memory play with a visible retry warning.
A legacy mirror failure cannot supersede the authoritative checkpoint.

Resume checks freshness. Cross-tab storage notifications pause play, clear input
and load the latest valid checkpoint; play resumes only on an explicit action.
A lifecycle event on an already-paused page does not save unchanged cached state.
Every application save path uses the writer, including periodic saves, losses,
level completion, boss bank/handoff and pause. New-run hydration is read-only.

Completed bosses reject recovery of old banks, Start, timer stepping and segment
failure. The UI presents completion instead of Resume. Terminal checkpoint writes
clear active state; completed seconds, hearts and existing banks remain intact.

This is an optimistic stale-snapshot guard, NOT a transaction/lock: truly
simultaneous cross-process reads followed by competing writes remain an open
adversarial test/dependency. Browser tests for sequential races must not be
reported as proof of serializable concurrent writers. No independent acceptance
or release authorization is implied even if CI becomes green.

Tests: eight deterministic owner cases cover stale level/heart writes, fresh
continuation, same-tab revisions, same-revision changed contents, deletion,
quota/retry, mirror failure and all ten completed-boss banks. Existing QA93/90
browser files remain unchanged and mandatory. Exact runtime evidence belongs in
the GitHub checkpoint after execution. Browser scope is sandboxed localhost
Linux Chromium, not hosted Preview, iPhone Safari, VoiceOver, natural full runs
or Founder playtest. No native simulator, merge, manual deployment or production
operation.
