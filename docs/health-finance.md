# Health and Finance on TEST

Draft branch `grok/health-finance-20261125`. Reference only: draft PR #146 at `c0cb08f`. That draft is not merged. This branch does not use its 1 XP quest credit, its midnight rollover, or its money fields.

Not in this branch: Emberhaven, level-cap changes, and Izzy activity-log fixes.

## Locked rules that stay as they are

The game day still starts at 5:00 AM America/Chicago (`public.quest_game_day`). Connor's normal quests still use the existing award: the first quest of a game day is 10 XP, and later ones are `round_half_up(10 × (1 + 0.1F))` through `public.quest_streak_xp` and `public.set_quest_instance_status_v2`. Refresh, double tap, and retry still pay once because the ledger is unique per instance. Izzy's 5/10/20 activity tiers, 30-day window, and couple rewards are unchanged. The Shield is still one per month, still needs confirmation, and still awards no XP. Scheduling a quest or accepting a follow-up does not award XP.

## Lights out

`Lights Out by 11 PM` is the only required nightly Health quest.

```
LIGHTS_OUT_BASE_XP = 5
LIGHTS_OUT_STREAK_BONUS_XP = 1
award = 5 + 1 × prior consecutive lights-out nights
```

The night being recorded is not part of the prior count. This formula lives in `public.lights_out_xp` and `lib/ascension/lightsOut.ts`. It does not call `quest_streak_xp`, and the row is not an `xp_ledger` completion, so it does not take the flat 10 XP first quest of the day. `get_lifetime_xp` adds the lights-out total to the existing ledger sum.

A night can be recorded for the current game day or the previous two game days. That window is Health-only. It is not Izzy's 30-day activity window. The same night and the same request id pay once (`health_lights_out` primary key and unique request id, plus an owner lock).

The screen shows how many of the last 7 game nights were recorded, against a goal of 6.

Meal flags (`balanced`, `protein`, `produce`, `delivery`) are nullable. All null is rejected and stays unlogged. Any explicit yes or no is a log and awards 0 XP. Sleep and recovery notes are owner-only under RLS. There is no pharmacy or patient data.

## Finance

`Complete my payday money check` runs biweekly from 2026-12-03 through 2027-05-20.

The decision is `minimum_only`, `review_needed`, or `extra_payment`. Every decision calls the same existing quest completion, including when the extra payment is nothing. There are no amount, balance, account, or currency columns in the finance tables, API, or UI.

`Pay Down a Card` and `Check the Cash Buffer` are created only when accepted. Accepting them schedules a one-time quest and awards 0 XP. Skipping stores nothing and has no penalty.

Payday checks and follow-ups are owner-only under RLS, as are the Health tables. Another account cannot read them.

Prefilled links `/?quest=…` and `/quests?quest=…` show a banner whose button reads `Schedule quest`. Scheduling uses `create_scheduled_quest` and does not complete the quest.

## TEST migration history repair

The TEST database `njqwwimzrsunheehnnnt` had applied two changes without matching history versions:

- `public.quest_streak_xp` already used the half-up base-10 formula from `supabase/migrations/202611060001_quest_base_xp10.sql`, and `schema_migrations` had no `202611060001` row.
- Push tables from `supabase/migrations/202611140003_engagement_pwa_push.sql` were already present. History had recorded that apply as version `202611140001` named `engagement_pwa_push`. The repo file at version `202611140001` is `replace_cook_dinner_pack`, which was applied separately as `20261114160250`.

`supabase/repairs/20261125_test_history_repair.sql` inserts only the missing versions `202611060001` and `202611140003` after checking that the formula and push tables are already present. It does not re-run those migrations, and it does not delete or rename `202611140001`. Deleting that row would make a later push treat the cook-dinner file as unrecorded.

The Health and Finance migration is `supabase/migrations/202611260010_health_finance.sql`. On TEST it was applied as history version `20261126002648` (`health_finance`). Version `202611260010` was then recorded as the same already-applied file so a later push does not run it again. Neither row rewrote player data.

Its down file drops only the new tables. Do not run the down file once real lights-out nights or payday checks exist. It does not delete quests, `xp_ledger`, streaks, unlocks, gear, or quest history.

On 2026-11-25 the TEST game day was still before 2026-12-03, so a payday completion correctly refused with "This payday check is not open yet." That award path was not executed against a real account. Lights-out recording, the second create, nullable meal flags, and owner RLS were executed on synthetic users inside a rolled-back transaction, plus one committed double-create on a synthetic user that was deleted afterward.

Production project `ugcvhmrriazbbymjxvch` is not a target.
