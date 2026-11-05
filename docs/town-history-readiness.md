# Town navigation query readiness

## Contract and scope

Character and Back links must reflect the current development preview marker, including a query change between server HTML and client hydration. The destination still independently enforces account/preview eligibility. Production links never inherit preview mode. Explicit destination parameters win; unrelated source parameters are not forwarded. This adds no preview authority.

QA105 recorded a390px browser URL ending preview=0 while Character/Back hrefs retained preview=1 for30s, with empty history-state keys and no page errors. Timing before Next's native History API patch was a hypothesis. The new controlled browser fixture holds application scripts, validates original SSR hrefs, changes the query, then releases hydration; it tests both directions at320/375/390/430px. Initial test-only commit establishes baseline separately from the implementation.

## Implementation

`components/ModeLink.tsx` keeps `useSearchParams` for Next's SSR snapshot and normal query-navigation notifications. React `useSyncExternalStore` reads actual `window.location.search` after hydration, closing a missed pre-mount change without changing the initial server snapshot. Native popstate/pageshow subscriptions refresh browser Back/Forward and restored documents; cleanup removes both listeners. Normal Next query updates still render the hook, which rereads the browser snapshot.

No global pushState/replaceState patch, synthetic router event, internal Next history-state mutation, URL timer/polling, storage write, route change or dependency is added. `InAppBackLink` already shares this hook. Existing activation-time resolution remains in place. A plain arbitrary native pushState after hydration still relies on Next's documented subscription; this is not a general external URL store.

## Browser coverage

`tests/browser/town-hydration-links.qa.mjs`: eight cases, real server markup/application hydration and navigation. Scripts are delayed, never replaced. Asserts initial SSR mode, live Character/Back hrefs, no unrelated query forwarding, normal Back-to-Town navigation and unchanged localStorage. All external/write requests are blocked. Holding at least one script is mandatory, so a test cannot silently pass without exercising delayed hydration.

Original QA105 query-only/history assertions remain unchanged. Required manifest grows20→21; existing exact-head gate still requires all suites. Node syntax and gate/runner checks do not constitute browser execution. Final PR/run evidence must identify actual checkout, results and any remaining failures.

No Brain Rot core, save schema, quest XP/streak, visual asset, account/auth, hosted environment/protection, production or native simulator change. Implementation needs independent review; design/runtime source tests do not self-authorize acceptance. Browser evidence is Linux Chromium on localhost, not iPhone Safari/VoiceOver or Founder playtest.

Reference contracts: https://react.dev/reference/react/useSyncExternalStore (server snapshot during hydration, browser snapshot afterward); https://nextjs.org/docs/app/getting-started/linking-and-navigating (native History API integration). The installed Next app-router source registers its native History API wrappers in a passive effect, consistent with the missed-early-update hypothesis; controlled browser results establish the practical regression boundary.
