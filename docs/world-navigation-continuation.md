# World navigation and continuation

Base: Visual91 f49d7a174b494306b52022f7e9ee4803e7fe65e8.
Owned World/Systems changes; no Brain Rot or visual asset edits.

## Guided Lantern route
Logical clue id forge is not a route slug. The old guided link constructed
/play/emberhaven/forge after the Hearth clue,while the existing destination is
/play/emberhaven/blacksmith. Each clue now carries its actual destination and the
guided link uses that mapping. Persisted clue IDs remain hearth/forge/market;
no migration,save reset,service,reward,dialogue or puzzle-rule change.

## Honest Crypt continuation
Hub previously treated any storage entry as a resumable run. It now delegates to
the same loadActiveRun owner/shape/live-phase/age checks used by Crypt. The helper
can establish dev-preview ownership only in development with preview=1,or guest
ownership only when the backend client is unconfigured. Configured clients have
no verified identity on Hub and use neutral Enter wording; Crypt still resolves
identity/resumption normally. No ownership is inferred from a local record.

Refresh on mount,window focus,pageshow and relevant cross-tab storage changes.
Reads do not clear,rewrite or migrate rejected saves. No auth request,new account
state,XP,TTL,save schema,run reducer or combat changes. This is an entry hint at
refresh time;Crypt's loader remains authoritative on entry. Preview query routing
is preserved.

## Executed/required evidence
Local TypeScript and836source tests pass. Seven new behavioral cases cover valid
mode/owner,unknown account authority,production-query safety,expiry and future-time
boundaries,invalid/ended records and denied storage,with byte preservation.
Exact-head CI adds two sandboxed localhost Chromium journeys at320/390px: actual
guest/preview run resume with same ID/deck/HP and neutral invalid-entry wording;
guided Hearth→Hub→Town→Blacksmith→Market→Waystone progression through real links,
with no town404,all three clues and solved keepsake. Browser results pending CI.

Existing inherited completed-boss Resume regression must remain visible/red until
Gameplay repairs it. No independent self-approval,hosted/iPhone Safari/VoiceOver,
native simulator,Founder or full boss acceptance is implied. No production or
security/configuration changes. Owner branches stay isolated;no merge authorized.
