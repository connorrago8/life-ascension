# Lantern Route: immediate device save and honest recovery

Branch base: Grok weekly-autopilot at 3cc9ecbc39b67a724f4ad9035558e83d444765a3.

The existing route already retained clues and the kept lantern in localStorage,
but deferred writes to a React effect and swallowed storage failures. Its
unconditional saved wording did not distinguish durable progress from a
visit that could not save. Accessing window.localStorage itself could also
throw before the old helper's try/catch.

This slice commits a story action to its single existing device key before the
action returns. A ref holds the latest progress across rapid actions; no storage
side effects run inside a React state updater. Loading never writes defaults.
Begin waits for hydration, avoiding an action against the initial empty state.

The status distinguishes loading, loaded, successfully saved and failed saves.
Only a successful write shows the saved promise. Failure keeps the current
visit playable with an explicit leave/reload warning and a 44px Retry device
save action. Retry writes the current in-memory choice; it does not reload an
older snapshot over it. The loading message is not a writeability guarantee.

Scope: existing Lantern story only. No account sync, XP, quest completion,
streak, item, equipment, Crypt or Brain Rot changes. Reset still restarts clues
while retaining the earned local story keepsake. Clearing browser data can
remove device saves; concurrent tabs remain last-writer-wins and are not
covered by this increment. Storage-denied visits can lose unsaved progress on
exit, as disclosed; this change does not promise durable storage when blocked.

## Verification

- `npm run lint`
- `node --test tests/lanternPersistence.test.mjs`: seven behavioral contracts,
  including acquisition/read/quota failures, immediate roundtrip, retry,
  legacy keepsake and reset.
- `npm test`: full source suite, not browser evidence.
- `.github/workflows/lantern-return.yml`: exact PR-head checkout, typecheck,
  full source suite, guarded synthetic production build and real local town in
  sandboxed Chromium. It reuses the repository's CI-only synthetic build
  configuration; it does not alter hosted protection or credentials.
- Browser script: `tests/browser/lantern-persistence.qa.mjs` checks 320/390px
  action→Hub→return, three clue collection, failed write→retry, solve→reload,
  reset/kept state, denied storage getter and unrelated key preservation.
  Network interception blocks external requests and HTTP writes. This is
  Linux Chromium with touch emulation, not iPhone Safari, VoiceOver or a
  native simulator. Final run/job evidence belongs in the GitHub checkpoint.

No automatic merge or release approval. Gameplay-owner save findings from
QA PR82 remain separate and unresolved by this Town-only change.
