# Emberhaven 0.1 — Acceptance Gate

**Owner:** ChatGPT — World & Experience Developer  
**Feature branch:** `chatgpt/emberhaven-town-slice-20261031`  
**Verification PR:** #63 (draft; 0.1 CI passed)  
**World expansion PR:** #64 (draft; exact-head verification pending)  
**Scope:** standalone `/play/emberhaven` town navigation route. No database, progression, loot, combat, or existing navigation modifications.

## Implemented

- Town screen with Noticeboard, Blacksmith, and Trail Gate.
- Existing route targets: `/quests`, `/character`, `/play`.
- 44px minimum navigation buttons; labeled main and town section; bottom safe-area padding.
- Navigation-only: no persistence writes, equipment grants, run reset, or currency.
- Node source-level contract tests in `tests/emberhavenTown.test.mjs`.

## Evidence and limitations

- PR #63 is the isolated 0.1 baseline (three files); PR #64 contains the expanded town and forge (four files) against `main`.
- PR #63 exact head `f8fe58c240a4a03bebdcea1df4405c1d84f14e0b` passed existing CI run `41177390880` (TypeScript, unit, SQL, build). This does **not** certify PR #64's changed head.
- Source inspection is **not** an iPhone screenshot or browser test.
- Town route remains deliberately **unlinked from current AdventureHub** until Founder approval. Grok's active adventure branch uses `/play` and `/play/delve`; current `main` still shows a locked Crypt.
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

## Future integration boundary (not implemented)

- Do not bypass Grok's `AdventureHub` entry handler or directly create a Crypt run from town.
- On the playable branch, the map routes to `/play/delve` and tracks unfinished runs with `ACTIVE_RUN_KEY`. Keep that existing logic authoritative.
- Verify Crypt exit → town only after a compatible return route is implemented and tested. Never assume returning to town saves rewards; validate persistence with independent QA.
- Do not describe demo Character gear as account-synced inventory.

## Emberhaven 1.0 town exploration batch (PR #65)

The integrated town now has six linked destinations: Noticeboard, Blacksmith, Hearth, Lantern Market, Waystone, and Trail Gate. Hearth, Market, and Waystone are exploratory destinations; they do not grant XP, modify inventory, heal, or touch active Crypt state. The adventure map links back to Emberhaven; the Trail Gate and Waystone link through `/play` rather than bypassing the existing Crypt entry logic.

### Batch acceptance (one integrated gate)

1. Visit `/play` → Emberhaven → each of six destinations; check return navigation and 320/375/390/430px layouts.
2. Visit Emberhaven → Trail Gate → playable Crypt via the existing AdventureHub. Start an unfinished run, leave using the supported Crypt exit, visit town, return through the map, and confirm the same run resumes.
3. Complete a run and independently verify the existing server-controlled loot/floor-clear path and no extra XP or item claims from town.
4. Verify signed-out, authenticated, preview and reduced-motion accessibility. Check no unexpected account mutations or network requests on town pages.
5. Review AdventureHub's one-link change with Grok before any integration or merge.

This checklist is not evidence of execution. No merge or deployment is authorized.

## Visual cohesion batch

Town square uses responsive destination columns and a warmer card palette; Blacksmith stations now include lore, and Hearth, Market, and Waystone have distinct atmospheric lighting. Verify contrast, text scaling, 320px layout, keyboard focus and reduced-motion behavior during integrated QA. These are presentation improvements, not a functional shop or inventory system.

## Interactive map acceptance

The town square now includes a six-landmark selectable map with path connections, active landmark description, and an Enter action. Verify pointer, keyboard, VoiceOver button names, pressed state, focus indication, live description announcement, and that each link reaches its existing destination. The map is a selection interface, not free-roaming movement or a simulation. No run or account writes are introduced.
