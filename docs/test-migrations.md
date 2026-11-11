# Apply TEST migrations (PR #130)

All migrations below are additive and reversible. Apply only on the disposable TEST database.

## Order
1. `supabase/migrations/202611110002_companion_pass.sql` (Izzy Style Track catalog)
2. `supabase/migrations/202611110003_adventurer_cosmetics.sql` (Connor catalog)
3. `supabase/migrations/202611110004_adventurer_wear.sql` (Connor Wear persistence)
4. `supabase/migrations/202611110005_companion_log_activity_v2.sql` (authoritative activity tiers)

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

Production must not receive these.
