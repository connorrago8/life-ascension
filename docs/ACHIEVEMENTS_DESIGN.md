# LIFE ASCENSION — Achievements v1 (post-launch design)

**Status:** Design only. Branch `feature/achievements-design` starts from `main`, but eligibility is specified against **draft PR #1 at `c33cf19`**, including migrations `0001`–`0007` (not the older `main` schema). No PR #1, production, migration, or XP changes.

## Principles
- Achievements are **display-only**, award **0 XP**, grant no currency, and do not trigger any quest completion.
- Only server-recorded, owner-scoped completed quest instances corroborated by `xp_ledger` qualify. Neither AI messages, self-claimed milestones, progress notes, templates, nor client state can unlock badges.
- Use **distinct instance IDs**, not XP sums or ledger-row counts alone. One instance can qualify only once even if completion is retried.
- Unlocks are **retroactive**: calculate from existing historical records without replaying completions or writing XP. **Completions of later-archived quests continue to count permanently** because the historical completion and ledger records remain valid; do not filter on `quests.active`.
- Domain attribution uses the quest's recorded domain; if domain can be edited in future, preserve domain-at-completion before shipping historical domain badges.
- No streak penalty, XP reduction, or new completion pathway.

## Badge catalog — exact rules

| Badge ID | Display name | Unlock rule | Existing source |
|---|---|---|---|
| `first_steps` | First Steps | At least 1 distinct ledger-backed completed instance | `quest_instances` + `xp_ledger` |
| `adventurer_10` | Adventurer | At least 10 distinct ledger-backed completed instances | Same |
| `veteran_50` | Quest Veteran | At least 50 distinct ledger-backed completed instances | Same |
| `legend_100` | Century of Quests | At least 100 distinct ledger-backed completed instances | Same |
| `well_rounded_3` | Explorer | At least 3 distinct qualifying quest domains | Completed instances → `quests.domain` |
| `well_rounded_5` | Well-Rounded Adventurer | At least 5 distinct qualifying quest domains | Same |
| `seven_day_journey` | Seven-Day Journey | At least one qualifying completion on each of 7 consecutive **Chicago completion dates** | Authoritative server completion timestamp, joined to ledger |

### Computation and edge cases

1. Scope all queries to the authenticated user; never accept a user ID supplied by a client or AI tool.
2. Build a qualifying set from instances with `status='completed'` and a matching `xp_ledger` entry for the **same owner and instance**. These names are verified in PR #1 `c33cf19`: `quest_instances(id,owner_id,quest_id,status,completed_at)`, `xp_ledger(owner_id,instance_id,amount,awarded_at)` with unique `xp_ledger.instance_id`, and `quests(id,owner_id,domain,active)`. Recheck after any later schema change. Do not assume a ledger entry is one XP forever: Phase 2 may add weighted amounts.
3. Count unique `instance_id` for volume badges. Count distinct domains across those qualifying instances for breadth badges. A repeated daily quest instance counts on each distinct completed day, but retries of the same instance do not.
4. For the streak badge, derive dates from **`quest_instances.completed_at`** converted using `America/Chicago`, **not** the instance due date or the user's browser clock. Late completions count on the day the action actually occurred. PR #1 migration `0001` defines `completed_at timestamptz`, and `0007` sets it to `now()` on completion. This is the authoritative source; do not substitute `due_date`, `xp_ledger.awarded_at`, or client time.
5. If an instance is completed but its ledger record is missing or inconsistent, exclude it and flag for diagnostics rather than awarding a badge from an unsupported claim.
6. Badge earned date is the earliest trustworthy timestamp when the rule became true, computed from chronological qualifying records. If historical timestamps are insufficient, show `Unlocked` without an invented date.
7. Retroactive calculation is read-only. V1 adds **no badge table, award writes, or API-key/AI write endpoint**. Compute with an owner-scoped read-only function or `security_invoker` view; never insert XP as a side effect.
8. Displaying progress should not require fetching all private quest history into the browser. Prefer a future owner-scoped read-only server function or view with correct RLS/security review. Validate query plans and pagination.

## SQL eligibility sketch — PR #1 `c33cf19`

The following is **read-only design SQL**, not a migration or a production query. Execute only after verifying the actual deployed schema. In an authenticated browser context, RLS also applies to the underlying tables. Prefer wrapping the computation in a carefully reviewed `SECURITY INVOKER` read-only RPC; **never** expose an unrestricted `SECURITY DEFINER` badge function.

```sql
WITH qualifying AS (
  SELECT i.id AS instance_id,
         i.owner_id,
         q.domain,
         i.completed_at,
         (i.completed_at AT TIME ZONE 'America/Chicago')::date AS completion_day
  FROM public.quest_instances AS i
  JOIN public.xp_ledger AS l
    ON l.instance_id = i.id AND l.owner_id = i.owner_id
  JOIN public.quests AS q
    ON q.id = i.quest_id AND q.owner_id = i.owner_id
  WHERE i.owner_id = (SELECT auth.uid())
    AND i.status = 'completed'
    AND i.completed_at IS NOT NULL
    -- Intentionally NO q.active filter: later-archived completions count.
), summary AS (
  SELECT count(DISTINCT instance_id) AS completed_instances,
         count(DISTINCT domain) AS completed_domains
  FROM qualifying
), completion_days AS (
  SELECT DISTINCT completion_day FROM qualifying
), islands AS (
  SELECT completion_day,
         completion_day - (row_number() OVER (ORDER BY completion_day))::int AS grp
  FROM completion_days
), streaks AS (
  SELECT count(*) AS consecutive_days FROM islands GROUP BY grp
)
SELECT summary.completed_instances,
       summary.completed_domains,
       coalesce((SELECT max(consecutive_days) FROM streaks), 0) AS longest_completion_streak
FROM summary;
```

Badge eligibility: `completed_instances >= 1, 10, 50, 100`; `completed_domains >= 3, 5`; `longest_completion_streak >= 7`. The completion day comes from `completed_at`, so completing an older daily instance today **cannot backfill yesterday's streak**. All badges award zero XP. For earned dates, a separate chronological threshold-crossing calculation is required; never substitute the current timestamp.

## Display-only UI

- **Achievements** page reachable from Character/Today, with compact summary: unlocked count / total.
- Grid of earned and locked badges; locked badges show an exact progress numerator/denominator where applicable, e.g. `7 / 10 completed quests`.
- Earned badges show title, short explanation, and earned date **only when trustworthy**. No claim that an animation is an award.
- Badge art is cosmetic; accessible text conveys status without color alone. Support keyboard focus, 44×44 CSS px targets, 4.5:1 normal-text contrast, 200% zoom, reduced motion, and iPhone safe areas.
- Never show a claim or manual-unlock button. AI may explain progress but cannot set badge state.

## Acceptance tests for future implementation

1. A confirmed quest instance with a valid ledger record unlocks First Steps retroactively, without any XP write.
2. Retried completion, duplicate events, and concurrent requests do not increase qualifying-instance count.
3. A note, quest creation, deferred instance, unconfirmed AI statement, and archived-but-never-completed quest never unlock badges.
4. Completed archived instances continue to count.
5. Two users' achievements and progress are strictly isolated.
6. 10, 50, 100-instance thresholds and 3/5-domain thresholds have exact boundary tests.
7. Late daily completion uses actual Chicago completion date, not its due date, for streaks; Chicago midnight and DST are covered.
8. Missing/ambiguous completion timestamp causes the seven-day badge to remain unavailable, never falsely earned.
9. Read-only badge calculations and UI do not mutate `xp_ledger`, quest statuses, or lifetime XP.
10. Phase 2 weighted XP does not change badge counts based on distinct completed instances.

## Deferred

- Character titles, cosmetics, and domain skills remain Phase 2 work.
- Reward tokens and a real-life reward shop wait until **after** weighted XP and skills are implemented and their anti-farming rules are established.
- No badge-related migration, cron job, privileged route, or live UI is part of this document.

**Implementation requires a separate post-launch review and explicit approval.**
