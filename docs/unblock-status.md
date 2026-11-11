# Unblock status (PR #130)

## Task 1 — Collapsible Completed
Already present on the main Quest Board (`quests/page.tsx` line ~269):
- Starts collapsed via `showCompleted` state
- Toggle shows Completed (n)
- Companion board also has its own collapsed section

No further change required for the main board.

## Task 2 — companion_log_activity
Discovered actual signature in `202611080002_companion_bond.sql`:
```sql
companion_log_activity(p_request uuid, p_title text, p_note text)
returns jsonb
```
- Awards personal base XP via `_award_personal_quest_xp`
- No custom XP tier or backdate parameter

ActivityLog now calls the real signature (generates request UUID).
Custom 5/10/20 tiers remain preview-only. A versioned RPC would be needed for server-authoritative tiers.

## Task 3 — Connor Wear persistence
Added TEST-only migration `202611110004_adventurer_wear.sql`:
- `adventurer_worn` table (one item per slot)
- `adventurer_set_worn(p_id text, p_wear boolean)`
- `adventurer_get_worn()`
Rollback included. UI calls the RPC.

## Remaining
- Apply TEST migrations on disposable DB
- Versioned activity RPC if custom XP tiers must be authoritative
- Screenshots and full test suite

Production untouched. PR remains draft.
