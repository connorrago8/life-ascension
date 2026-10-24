# LIFE ASCENSION — Achievements v1 (post-launch design)

**Status:** Design only. Branch `feature/achievements-design` starts from `main`. No PR #1, production, migration, or XP changes.

## Principles
- Achievements are **display-only**, award **0 XP**, grant no currency, and do not trigger any quest completion.
- Only server-recorded, owner-scoped completed quest instances corroborated by `xp_ledger` qualify. Neither AI messages, self-claimed milestones, progress notes, templates, nor client state can unlock badges.
- Use **distinct instance IDs**, not XP sums or ledger-row counts alone. One instance can qualify only once even if completion is retried.
- Unlocks are **retroactive**: calculate from existing historical records without replaying completions or writing XP. Archived quests and completed archived instances retain earned progress.
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
2. Build a qualifying set from instances with `status='completed'` and a matching `xp_ledger` entry for the **same owner and instance**. Verify actual column names, uniqueness constraints, and timestamps against final production schema before implementing. Do not assume a ledger entry is one XP forever: Phase 2 may add weighted amounts.
3. Count unique `instance_id` for volume badges. Count distinct domains across those qualifying instances for breadth badges. A repeated daily quest instance counts on each distinct completed day, but retries of the same instance do not.
4. For the streak badge, derive dates from a **server-recorded completion event timestamp** converted using `America/Chicago`, **not** the instance due date or the user's browser clock. Late completions count on the day the action actually occurred. If the current schema does not retain a reliable completion timestamp, **defer this badge** until a trustworthy source exists; do not substitute `due_date` or approximate it.
5. If an instance is completed but its ledger record is missing or inconsistent, exclude it and flag for diagnostics rather than awarding a badge from an unsupported claim.
6. Badge earned date is the earliest trustworthy timestamp when the rule became true, computed from chronological qualifying records. If historical timestamps are insufficient, show `Unlocked` without an invented date.
7. Retroactive calculation is read-only. If persistence is added later, key unlock records uniquely by `(owner_id, badge_id)` and recompute from authoritative records; never insert XP as a side effect.
8. Displaying progress should not require fetching all private quest history into the browser. Prefer a future owner-scoped read-only server function or view with correct RLS/security review. Validate query plans and pagination.

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
