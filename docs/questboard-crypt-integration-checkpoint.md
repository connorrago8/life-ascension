# Quest Board × Emberhaven × Crypt integration checkpoint

This branch starts at the verified Quest Board 3.0 branch, not at production.

## Source candidates
- Quest Board PR #71: quest selection, XP ledger, companion and Chicago-day persistence.
- Emberhaven PR #65: interactive adventure hub, town destinations and playable delve link.
- Crypt saves PR #67: versioned local resume and opt-in cloud adapter.

## Safety requirements
1. Never overwrite the authoritative `get_lifetime_xp` or `set_quest_instance_status` flow.
2. Preserve the approved Crypt route `/play/delve` and the Town route `/play/emberhaven` when bringing their source files.
3. Keep preview-only functionality isolated; do not enable migrations or production deployment by creating this branch.
4. Reconcile shared files (`lib/nav.ts`, `app/(app)/play/page.tsx`, `tests/characterScreen.test.mjs`, `app/style.css`) manually.
5. Validate exact-head CI, run/resume behavior, return-to-Hub behavior and signed-in XP persistence before release.

This document is a checkpoint, not a claim that Crypt or Town source has already been merged.
