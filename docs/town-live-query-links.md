# Town navigation: render the current query directly

Systems follow-up to the intermittent Town link failures recorded on PRs100/101. Base is QA102 at4751f1aef265b562c32cb73378f690511144557e; Brain Rot timeout failures remain owned by Gameplay/QA.

## Change

`useModeHref` derives the href from Next's `useSearchParams` in the render instead of copying `window.location.search` into effect-driven state. The old state initialized to a plain href and updated after commit; pathname-only dependencies also missed same-path query changes. Both ModeLink and InAppBackLink now use a local Suspense boundary so static production builds remain valid. While the query is unavailable the existing label is a busy, non-actionable span, never a misleading actionable destination.

The same pure navigationModeHref contract applies: only development preview=1 propagates, no unrelated source parameters, existing destination query/hash retained, explicit destination preview wins, production/normal destinations unchanged. Click-time reads, modified-click behavior, real anchor destinations, Back/replace policy and disabled prefetch remain. No account authority is inferred from the query.

No World copy, art/CSS/assets, quest/XP/streak, gear, Crypt/Brain Rot save, backend, auth or deployment configuration is changed. Production build verification is separate from browser/device evidence. No iPhone simulator, merge or manual deployment.

## Verification

- Existing five pure mode contracts remain unchanged; local TypeScript and872unit tests passed.
- New mandatory browser suite at320/390 directly enters Blacksmith in development preview and reads actual Character/Back hrefs. It toggles only the current query through Next-integrated native history, checks preview on/off and unrelated-source filtering, goes Back, activates the Town return and verifies unchanged local storage plus no external/write requests.
- Existing Town Crypt-continuity test is retained without extra waits or altered assertions. It previously failed immediately reading Open Character's plain href. All inherited suites remain mandatory;19total.
- The new query-only test waits for the query-driven render before comparing. It does not claim browser URL mutation and React rendering are one atomic operation.
- React review: pure derived state, no effect/listener/copy state, stable component definitions, both query consumers under Suspense, pending labels non-actionable, actual resolved anchors retain existing controls. Device Safari/VoiceOver and static-build hydration behavior remain separate verification needs.

Exact-head CI/browser/deployment results will be recorded in the PR and checkpoint; no runtime pass inferred from source. Independent acceptance remains pending. Existing QA102 two timeout/Hub losses must not be skipped, repaired here or hidden by this navigation change.
