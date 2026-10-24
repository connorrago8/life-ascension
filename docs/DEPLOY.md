# LIFE ASCENSION — Go-live checklist (owner walkthrough)

**Do not start until Grok and ChatGPT approve PR #1, the login branch, and migration 0006.** The steps below are production changes. Save a backup before database changes. Do not paste secrets into chat, screenshots, issues, or logs.

## 1. Confirm the starting point
1. Open [Supabase](https://supabase.com/dashboard) and select the LIFE ASCENSION project.
2. Open **SQL Editor**. Confirm migration `202610230001_core.sql` was already applied: run this **read-only** check:
   ```sql
   select to_regclass('public.quests') as quests,
          to_regclass('public.quest_instances') as instances,
          to_regclass('public.xp_ledger') as xp_ledger;
   ```
   All three must show table names, not `null`. This verifies core tables exist, **not** that every 0001 statement ran; also check the migration history or compare the actual schema with 0001. Do **not** rerun 0001 blindly.
3. Confirm the approved commits are in the intended PRs, and that migration 0006 follows 0005. Check the Vercel deployment currently serving the site and save its URL/commit for rollback.
4. Make a restorable Supabase database backup/snapshot (check your plan's backup options). SQL migrations are not automatically reversible; a deployment rollback does not roll back SQL.

## 2. Apply database migrations in order
In the approved GitHub branch, open each file, copy its **entire SQL**, paste it into a **new** Supabase SQL Editor query, and click **Run**. Read the result before moving on. **Do not execute the same migration twice just because a page was refreshed.**

1. `supabase/migrations/202610230002_api_keys_progress.sql`
2. `supabase/migrations/202610230003_future_quest_scheduling.sql`
3. `supabase/migrations/202610230004_lifetime_xp.sql`
4. `supabase/migrations/202610240005_api_key_user_context.sql`
5. `supabase/migrations/202610240006_quest_edit_archive.sql` **only after its review and merge are complete**.

After each query, confirm SQL Editor reports success. For a read-only sanity check at the end:
```sql
select to_regclass('public.api_keys') as api_keys,
       to_regclass('public.quest_progress') as quest_progress;
select proname from pg_proc where pronamespace='public'::regnamespace
 and proname in ('create_scheduled_quest','get_lifetime_xp',
 'create_scheduled_quest_as_user','rename_quest','reschedule_quest','archive_quest')
 order by proname;
```
Expected: both tables and all six function names. Do not create test quests using privileged SQL; use the app after deployment. If a migration fails, **stop**, capture the non-secret error, and use the rollback section. Never skip a failed migration.

## 3. Configure the server-only Vercel secret
1. Open [Vercel](https://vercel.com/dashboard) → LIFE ASCENSION project → **Settings → Environment Variables**.
2. In Supabase → project settings → API keys, copy the **service_role** secret key using the protected reveal/copy UI.
3. In Vercel, add name `SUPABASE_SERVICE_ROLE_KEY` and paste its value. Select **Production** (and Preview only if intentionally testing previews). **Never** name it `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`.
4. Verify only the variable **name** and environment are shown; never print or share its value. A redeploy is required for the new variable.

## 4. Configure Supabase Auth (after confirming your account exists)
1. Supabase → **Authentication → Users**: confirm your own account already exists.
2. **Authentication → URL Configuration**: set Site URL to `https://life-ascension.vercel.app` and add Redirect URL `https://life-ascension.vercel.app/auth/callback**`. Verify it appears in the allow-list.
3. **Authentication → Email Templates → Magic Link**: include **`{{ .Token }}`** for the six-digit code and **`{{ .ConfirmationURL }}`** for link fallback. Save the template.
4. Check Email OTP token length is **6 digits** in your Auth configuration. If the UI does not expose it, verify using a real test email and the current Supabase docs; do not assume the default.
5. Turn **off** “Allow new users to sign up” only **after** confirming your existing account. Verify the setting stays off.
6. Email delivery: Supabase's default sender is rate-limited. For reliable production delivery, configure custom SMTP and verify the sending domain before depending on login. See a separate email-sender setup guide if available.

## 5. Merge and deploy only after approval
1. Ask both reviewers to approve PR #1 and the login branch. Ensure migration 0006 is included only if its compatibility tests passed.
2. Merge the approved changes into `main` in the agreed order. Do **not** merge a draft automatically.
3. In Vercel → **Deployments**, wait for the `main` production deployment to show **Ready**. Redeploy after changing environment variables if necessary.
4. Visit `https://life-ascension.vercel.app/login` in a private browser window. Request a code, read the email, enter it, and verify the board opens. Check that visiting `/login` while signed in returns home.
5. Visit `/settings/api-keys`; create a test key, copy it into your local shell's secret environment variable, and run the smoke test. **Never send the key in chat.**
6. Confirm the board loads today's quests, Upcoming, XP, and that archived quests are not shown.

## 6. Rollback / stop plan
- **SQL error before merging:** Stop. Record the migration filename and sanitized error. Do not run later migrations. Some SQL statements may already have committed; inspect the actual schema before deciding whether to retry. Ask for a reviewed forward-fix SQL or restore the database from a verified backup. **Do not assume re-running or deleting tables is safe.**
- **Website broken after merge:** In Vercel, redeploy the last known-good production commit or use Vercel's rollback feature. This restores app code only, **not database schema**. If older code is incompatible with new tables/functions, keep the app in maintenance mode and coordinate a reviewed fix.
- **Authentication failure:** Check Supabase Auth settings, redirect allow-list, email delivery and Vercel env variable names. Do not disable authentication to work around the failure.
- **Leaked key:** Revoke the personal API key immediately; if the service-role secret leaked, rotate it in Supabase, update Vercel and redeploy.
- **After a failed migration:** Prefer a tested forward fix; restore from backup only with an explicit recovery plan because it can erase subsequent data.
