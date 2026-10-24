# LIFE ASCENSION — Game mechanics design (proposal only)

**Status:** Planning for after go-live. No code, migrations, live settings or XP changes are included in this branch. Existing server-side quest ownership, completion, date eligibility and one-time XP ledger rules remain authoritative.

## 1. Daily-habit streaks

**Clock:** Use `America/Chicago` calendar dates, including daylight-saving transitions. A day runs midnight to midnight Chicago time, not a rolling 24 hours or the device's time zone.

**Qualifying day:** One completed, eligible instance of an active `daily` quest whose `due_date` equals that Chicago date. Count **one streak day per habit per date**, even if a request is repeated. Only count instances completed on that same Chicago day. An earlier quest scheduled start date does not retroactively award streak days.

**When a streak breaks:** Evaluate **every Chicago calendar day** starting with the habit's original effective start date, whether or not a `quest_instances` row was generated. A missing instance counts as a missed day. A daily habit that is due but has no confirmed completion by the end of its Chicago calendar day ends the consecutive run. A deferred instance also counts as missed, not as a pause. A new completion starts at 1. Do not punish someone with negative XP. Streaks are per habit, not a single global streak. A future start date does not break a streak before it begins. Archived habits stop accumulating streaks and display their final historical best; they do not restart automatically.

**Missed days, pauses, and edits:** No backfilling and no future claims. Rescheduling an **already-active** daily habit's start into the future immediately ends its current streak; the new date starts a fresh streak opportunity, not a pause. Rescheduling cannot turn previously missed days into successes. A user may intentionally archive a habit, but that ends the active streak. No retroactive "streak repair" by changing time zones or due dates. For fairness, a future version could add a prospective rest-day calendar, but not in the first release.

**Bonus XP:** **No bonus XP initially.** Keep the existing `xp_ledger` as the sole source of XP and the current +1 per eligible completion. Display current streak, personal best and milestone badges (3, 7, 14, 30 days) without extra XP. This prevents stacking rewards and makes the feature easy to audit. If bonuses are introduced later, they must use separate ledger entries with a unique milestone identity, one transaction and a hard uniqueness constraint; never calculate XP client-side.

**Anti-gaming:** The server enforces quest ownership, active status, Chicago-local eligibility, no future completions, no past-date completions for streak purposes, and one completed instance per quest/date. The streak computation ignores retroactively completed historical instances. A replayed completion cannot increment a streak twice. The API must not trust a client-supplied timestamp or timezone.

**Daily-habit XP backfill (owner-approved; pending migration 0007):** You can log a missed daily habit up to **2 days late**, measured by `America/Chicago` calendar dates: today and the previous two Chicago dates only. No XP for older or future dates. Each habit/date can award at most 1 XP, so a habit backdated 30 days can earn at most 3 XP across the eligible dates. Late logging earns XP but **does not repair or extend a missed streak**. Overdue one-time chores and early goal completion are unchanged. Grok will implement and test this after migration 0006; this document does not make it live.

**Implementation dependency:** Until migration 0007 is merged, deployed, and tested, the existing daily completion window may still allow older entries. The proposed two-day XP limit must be enforced server-side, independently of streak calculation.

## 2. Daily AI check-in

**Timing:** Opt-in, at a user-selected local time, e.g. 8:00 AM Chicago. A manual check-in should work anytime. Don't schedule unsolicited messages until the user explicitly enables a recurring task. No sensitive quest details in push notifications.

**Read order:** The assistant fetches the user's active quests through authorized tools, then groups:
1. **Overdue:** one-time chores with past due dates and no completion, oldest first.
2. **Due today:** today's daily habits and scheduled one-time chores; eligible goals due today.
3. **Upcoming:** future chores and goals in the next seven days, sorted by due date. Label future chores as *not completable yet*; future goals may be completed early.
4. **Recently progressed:** notes on current quests if accessible, to continue work without suggesting duplicates.

The current `list_quests` MCP tool is date-scoped by default; a real check-in implementation needs a server-side upcoming/overdue query or a safe dedicated tool with limits and active-quest filtering. Do **not** claim the existing tool already provides all these categories. Never surface archived quests.

**Morning conversation example:**
> Good morning. You have 2 habits due today, 1 overdue chore, and a goal due Friday. Which 1–3 should we focus on? Did you finish anything since our last check-in?

Keep suggestions practical and short, and ask permission before creating new quests. If no quests exist, ask whether to add one simple daily habit and one one-time chore. Do not guilt the user for missed days.

**Interpret replies carefully:**
- "I'll do laundry" → planned action; create/schedule a quest only after user approval, no XP.
- "I'm halfway through laundry" → `update_progress`, no XP.
- "I finished laundry" → identify the correct active quest/instance, ask a concise confirmation if needed, then call `submit_completion` with `confirmed_complete=true`.
- "I didn't do laundry" → no completion.
- "I finished laundry and dishes" → disambiguate and confirm both individually or together before submitting each.
- "I finished Thursday's chore" before Thursday → server rejects early completion; explain eligibility without changing the due date behind the user's back.

**Exactly-once behavior:** The assistant never grants XP. Only the database completion RPC writes to `xp_ledger` under its unique instance constraint. Repeating the same completion yields no extra XP. An assistant retry after a timeout must check quest state instead of creating a second quest. All AI clients share the same owner-scoped source of truth.

**Privacy and reliability:** Use only authenticated user-scoped API calls, minimum needed fields, explicit user consent for reminders, and a rate-limited read API. No health or finance quest details in external notifications without opt-in. Provide a graceful fallback when the API is unavailable.

## 3. Level curve (levels 1–50)

Use **lifetime XP** from the server's `xp_ledger` sum; levels never decrease when a streak breaks. Level 1 begins at 0 XP. For level `L` (1–50), cumulative XP required is:

`floor((L - 1)^2 / 2) + 4 × (L - 1)`

The displayed level is the greatest threshold less than or equal to lifetime XP. At 50, keep showing level 50 and lifetime XP; do not discard additional XP. Values are intentionally modest for the current +1 XP per completed quest and can be revisited based on real usage.

| Level | Total XP required |
|---:|---:|
| 1 | 0 |
| 2 | 4 |
| 3 | 10 |
| 4 | 16 |
| 5 | 24 |
| 6 | 32 |
| 7 | 42 |
| 8 | 52 |
| 9 | 64 |
| 10 | 76 |
| 11 | 90 |
| 12 | 104 |
| 13 | 120 |
| 14 | 136 |
| 15 | 154 |
| 16 | 172 |
| 17 | 192 |
| 18 | 212 |
| 19 | 234 |
| 20 | 256 |
| 21 | 280 |
| 22 | 304 |
| 23 | 330 |
| 24 | 356 |
| 25 | 384 |
| 26 | 412 |
| 27 | 442 |
| 28 | 472 |
| 29 | 504 |
| 30 | 536 |
| 31 | 570 |
| 32 | 604 |
| 33 | 640 |
| 34 | 676 |
| 35 | 714 |
| 36 | 752 |
| 37 | 792 |
| 38 | 832 |
| 39 | 874 |
| 40 | 916 |
| 41 | 960 |
| 42 | 1004 |
| 43 | 1050 |
| 44 | 1096 |
| 45 | 1144 |
| 46 | 1192 |
| 47 | 1242 |
| 48 | 1292 |
| 49 | 1344 |
| 50 | 1396 |

Example: 24 lifetime XP reaches level 5; level 6 starts at 32 XP, so progress is 0/8 toward the next level. Do not award XP for reaching a level.

## 4. Proposed database sketch (names and columns only)

**No migration is created here.** Compute streaks from immutable completion history where possible; the following optional cache supports efficient dashboards:

**`habit_streaks`**
- `id` UUID primary key
- `owner_id` UUID (references user)
- `quest_id` UUID (references quest); **composite foreign key** (`quest_id`, `owner_id`) → `quests(id, owner_id)` with `ON DELETE CASCADE`
- `current_streak` integer, default 0
- `longest_streak` integer, default 0
- `last_qualified_date` date, nullable (Chicago date)
- `last_evaluated_date` date, nullable (Chicago date)
- `created_at` timestamptz
- `updated_at` timestamptz
- unique (`owner_id`, `quest_id`)
- checks: `current_streak >= 0`, `longest_streak >= current_streak`; enforce **daily-quest-only** rows with a trusted server-side function/trigger checking the parent quest cadence (a cross-table condition cannot be a simple SQL CHECK constraint)
- enable RLS with **owner-only SELECT**; revoke client INSERT/UPDATE/DELETE; only reviewed server-side definer functions may write, with explicit owner validation
- `last_evaluated_date` is advanced by the authorized server-side streak evaluator when processing each Chicago calendar day, including missed days, and is also reconciled on dashboard reads after inactivity; never trust a client-supplied evaluation date

**Source of truth:** `quest_instances` completion timestamps and `xp_ledger` for XP. `habit_streaks` is a rebuildable derived cache, not a source of XP. Enforce RLS owner checks, server-controlled updates, and transaction-safe recalculation if implemented.

## 5. Acceptance scenarios for future development

- Chicago daylight-saving transitions count calendar dates correctly.
- Completing the same daily habit twice on one day yields one streak day and at most one XP.
- Missing a due day **even when no instance was created** breaks the current streak without removing XP.
- A deferred day counts as missed; moving an active habit's start into the future ends the streak rather than freezing it.
- Logging yesterday's or the day-before-yesterday's missed daily habit may earn XP after 0007, but **does not** repair the streak; logging three or more Chicago days late earns no XP.
- A habit backdated 30 days can earn no more than 3 XP (today plus the previous two days), even if older dates have no instance rows.
- Future-dated habits and archived quests never advance streaks.
- Rescheduling does not retroactively create streak days.
- AI partial-progress updates never award XP.
- Two assistants submitting the same confirmed completion award at most one XP.
- Level thresholds derive only from lifetime ledger XP and match the table above.
