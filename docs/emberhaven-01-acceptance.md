# Emberhaven 0.1 — Acceptance Gate

**Owner:** ChatGPT — World & Experience Developer  
**Feature branch:** `chatgpt/emberhaven-town-slice-20261031`  
**PR:** #61 (draft)  
**Scope:** standalone `/play/emberhaven` town navigation route. No database, progression, loot, combat, or existing navigation modifications.

## Implemented

- Town screen with Noticeboard, Blacksmith, and Trail Gate.
- Existing route targets: `/quests`, `/character`, `/play`.
- 44px minimum navigation buttons; labeled main and town section; bottom safe-area padding.
- Navigation-only: no persistence writes, equipment grants, run reset, or currency.
- Node source-level contract tests in `tests/emberhavenTown.test.mjs`.

## Evidence and limitations

- GitHub PR diff is **two files** relative to the Grok branch at review.
- Automated workflow execution for this feature is **not yet confirmed**.
- Source inspection is **not** an iPhone screenshot or browser test.
- Route exists but is deliberately **not linked from the current AdventureHub** until Founder approval.
- All checks below are **PENDING** until actually executed. Do not mark PASS based on this document.

## Gate A — Build and tests

1. Checkout exact feature head; record full SHA.
2. Run `npm ci`, `npm run lint`, `npm test` and the existing project build with its documented nonproduction environment.
3. Record command, exit code, SHA and any skipped test.
4. If CI does not trigger on this branch, use an authorized isolated test path; do not change Grok's workflows just to force a green badge.

## Gate B — Navigation and state

1. Open `/play/emberhaven` directly in an authenticated test session.
2. Select Noticeboard → confirm `/quests` loads and does not complete a quest or award XP.
3. Select Blacksmith → confirm `/character` loads without changing equipment.
4. Select Trail Gate → confirm `/play` loads without restarting a Crypt run.
5. Repeat as signed-out visitor; record actual redirect or login behavior.
6. Verify existing active-run data before/after; no write should be attributed to this route.

## Gate C — iPhone and accessibility

1. Inspect 320, 375, 390 and 430 CSS-pixel widths: no horizontal overflow or clipped CTA.
2. Check iPhone Safari top/bottom safe areas and bottom navigation overlap.
3. Check VoiceOver: one main heading, labeled destinations section, understandable link labels and focus order.
4. Check keyboard focus, contrast and 200% text scaling.
5. Check reduced-motion preference; the current route has no authored animation.

## Release boundary

- Draft PR only. Do not merge, deploy, or modify Production.
- Grok owns Quest Board, Character, Crypt and AdventureHub; this PR must remain separate.
- Before integration, compare against the *current* Grok head, not a stale SHA.
- Any merge requires independent QA and Founder authorization.
