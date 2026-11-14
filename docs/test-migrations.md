# Apply TEST migrations (PR #130)

All migrations below are additive and reversible. Apply only on the disposable TEST database.

## Order
1. `supabase/migrations/202611110002_companion_pass.sql` is already applied on TEST as the pastel catalog. Do not edit or reapply it.
2. `supabase/migrations/20261112013453_companion_dark_catalog.sql` replaces those 16 rows with the dark catalog.
3. `supabase/migrations/20261112014116_nightcat_headset.sql` adds the Nightcat Headset at level 30.
3b. `supabase/migrations/20261112014926_content_pack_v1.sql` renames both tracks to the founder pack and sets activity duration bands. It does not delete cosmetic ids.
4. `supabase/migrations/202611110003_adventurer_cosmetics.sql` (Connor catalog)
5. `supabase/migrations/202611110004_adventurer_wear.sql` (Connor Wear persistence; `level_for_xp`; select-only RLS)
6. `supabase/migrations/202611110005_companion_log_activity_v2.sql` (Izzy activity tiers 5/10/20, no quest streak)

## How
From a machine with the Supabase CLI pointed at TEST:

```bash
supabase db push --db-url "$TEST_DATABASE_URL"
```

Or apply the four files individually with `psql "$TEST_DATABASE_URL" -f ...`.

## Verify
```sql
select count(*) from public.companion_cosmetic_catalog;
select count(*) from public.adventurer_cosmetic_catalog;
select proname from pg_proc where proname in ('companion_log_activity_v2','adventurer_set_worn');
```

## Rollback (if needed)
Run the matching files in `supabase/rollbacks/` in reverse order.

## Engagement push (2026-11-14)
`supabase/migrations/202611140003_engagement_pwa_push.sql` adds push subscriptions, notification preferences, the outbox, and widget tokens. Roll back with `supabase/rollbacks/202611140003_engagement_pwa_push_down.sql`. See `docs/engagement-push.md`. Production must not receive it. The SQL is already on TEST from the earlier `engagement_pwa_push` apply; this filename only keeps the local version unique.

Production must not receive these.
