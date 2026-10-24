# LIFE ASCENSION — Go-live checklist (owner walkthrough)

**Do not start until Grok and ChatGPT approve PR #1, the login branch, and migration 0006.** The steps below are production changes. Supabase Free has **no automatic database backups or point-in-time recovery**. Make and verify your own off-site dump before changing SQL; otherwise you have **no reliable restore**. Do not paste secrets into chat, screenshots, issues, or logs.

## 1. Confirm the starting point
1. Open [Supabase](https://supabase.com/dashboard) and select the LIFE ASCENSION project.
2. Open **SQL Editor**. Confirm migration `202610230001_core.sql` was already applied: run this **read-only** check:
   ```sql
   select to_regclass('public.quests') as quests,
          to_regclass('public.quest_instances') as instances,
          to_regclass('public.xp_ledger') as xp_ledger;
   ```
   All three must show table names, not `null`. Also verify row-level security and core RPCs:
   ```sql
   select relname, relrowsecurity from pg_class where oid in
     ('public.quests'::regclass,'public.quest_instances'::regclass,'public.xp_ledger'::regclass);
   select proname from pg_proc where pronamespace='public'::regnamespace
     and proname in ('ensure_quest_instance','set_quest_instance_status');
   ```
   Confirm RLS is enabled on the protected tables and the two functions exist. These checks do **not** prove all 0001 statements ran. Compare the actual schema with 0001; **SQL Editor execution does not automatically populate Supabase CLI migration history**. If switching to CLI-managed migrations, reconcile with `supabase migration repair --status applied <version>` **only after** verifying the exact version is already applied. Otherwise use SQL Editor consistently and track each completed file yourself. Do **not** rerun 0001 blindly.
3. Confirm the approved commits are in the intended PRs, and that migration 0006 follows 0005. Check the Vercel deployment currently serving the site and save its URL/commit for rollback.
4. **Required manual backup on Supabase Free:** install Supabase CLI and PostgreSQL client tools on a trusted computer. Start Docker Desktop (the Supabase CLI database dump uses Docker), verify it is running, authenticate the CLI and link the project, then export **schema and data separately** using the project's authorized database connection. Example commands (review your CLI version and connection method first):
   ```bash
   supabase db dump --linked -f backup-schema.sql
   supabase db dump --linked --data-only -f backup-data.sql
   ```
   Store both files encrypted **off-site**; they can contain private information. Verify files are nonempty and perform a **test restore to an isolated Supabase environment** (a separate Supabase project or `supabase start` locally with Docker), **not a plain empty PostgreSQL database**: Supabase-specific `auth` schemas, roles and extensions must already exist. After provisioning the test environment, apply the reviewed dump files with `psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f backup-schema.sql` followed by `psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f backup-data.sql`, using the **test environment's** connection string only. Check row counts. A CLI dump may omit Supabase-managed schemas/roles or certain settings; **do not treat this as a complete project snapshot**. Document anything it does not cover. If you cannot verify a restorable backup, **do not proceed**.

## 2. Apply database migrations in order — **same sitting as deployment**
**Important downtime:** Migration 0003 revokes direct quest INSERT from the current live frontend. From the moment 0003 runs until the updated PR #1 code is deployed, **quest creation on the live website can fail**. Reserve an uninterrupted maintenance window, have the approved PR and Vercel access ready, tell yourself not to use the site during the window, and complete §§2–5 together. Do not start SQL if you cannot finish deployment immediately.
Free Supabase projects may pause after a period of inactivity; confirm the project is active and responding **before** the maintenance window. In the approved GitHub branch, open each file, copy its **entire SQL**, and run **one migration per SQL Editor query**. For migrations that do not already control their own transactions, wrap the whole file in `BEGIN;` and `COMMIT;` to make it atomic; **review each file first**, since nested or non-transactional statements may require another approach. Click **Run** and confirm success before the next file. Read the result before moving on. **Do not execute the same migration twice just because a page was refreshed.**

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
 '_bind_service_role_user','create_scheduled_quest_as_user',
 'ensure_quest_instance_as_user','set_quest_instance_status_as_user',
 'add_quest_progress_as_user','get_lifetime_xp_as_user','rename_quest','reschedule_quest','archive_quest')
 order by proname;
```
Expected after 0002–0005: both tables and the scheduling, XP and API-key wrapper functions; **rename/reschedule/archive exist only after 0006**. Also check `_bind_service_role_user` and `create_scheduled_quest_as_user`, `ensure_quest_instance_as_user`, `set_quest_instance_status_as_user`, `add_quest_progress_as_user`, `get_lifetime_xp_as_user` against the approved 0005 definitions. Do not create test quests using privileged SQL; use the app after deployment. If a migration fails, **stop**, capture the non-secret error, and use the rollback section. Never skip a failed migration.

## 3. Configure the server-only Vercel secret
1. Open [Vercel](https://vercel.com/dashboard) → LIFE ASCENSION project → **Settings → Environment Variables**.
2. In Supabase → project settings → API keys, copy the **service_role** secret key (or the current `sb_secret_` server secret, **only if the reviewed server client supports that key type**) using the protected reveal/copy UI.
3. In Vercel, add name `SUPABASE_SERVICE_ROLE_KEY` and paste its value. Select **Production** (and Preview only if intentionally testing previews) and mark it **Sensitive** in Vercel. **Never** name it `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`.
4. Verify only the variable **name** and environment are shown; never print or share its value. A redeploy is required for the new variable.

## 4. Configure Supabase Auth (after confirming your account exists)
1. Supabase → **Authentication → Users**: confirm your own account already exists.
2. **Authentication → URL Configuration**: set Site URL to `https://life-ascension.vercel.app` and add Redirect URL `https://life-ascension.vercel.app/auth/callback**`. Verify it appears in the allow-list.
3. **Authentication → Email Templates → Magic Link**: include **`{{ .Token }}`** for the six-digit code and **`{{ .ConfirmationURL }}`** for link fallback. Save the template.
4. Check Email OTP token length is **6 digits** in your Auth configuration. If the UI does not expose it, verify using a real test email and the current Supabase docs; do not assume the default.
5. Turn **off** “Allow new users to sign up” only **after** confirming your existing account. Verify the setting stays off.
6. Email delivery: Supabase's default sender is rate-limited. For reliable production delivery, configure custom SMTP and verify the sending domain before depending on login. See a separate email-sender setup guide if available.

## 5. Merge and deploy only after approval
1. Ask both reviewers to approve PR #1 and the login branch. Merge/rebase the 0006 branch **after** PR #1, because 0006 depends on 0003; include it only if compatibility tests passed.
2. Merge the approved changes into `main` in the agreed order. Do **not** merge a draft automatically.
3. In Vercel → **Deployments**, wait for the `main` production deployment to show **Ready**. Redeploy after changing environment variables if necessary.
4. Visit `https://life-ascension.vercel.app/login` in a private browser window. Request a code, read the email, enter it, and verify the board opens. Check that visiting `/login` while signed in returns home.
5. Visit `/settings/api-keys`; create a test key, store it privately in your local shell's secret environment variable. **Each smoke-test run permanently adds two quests and +1 lifetime XP to the account; archiving does not undo XP.** Run only if you accept this, with `CONFIRM_PROD=1 bash tests/smoke.sh`. Prefer a dedicated test account/project if available. **Never send the key in chat.**
6. Confirm the board loads today's quests, Upcoming, XP, and that archived quests are not shown. After migration 0006 is deployed, **archive the two smoke-test quests** using `/quests/manage`; this hides the quests but **does not remove the +1 XP**.

## 6. Rollback / stop plan
- **SQL error before merging:** Stop. Record the migration filename and sanitized error. Do not run later migrations. Some SQL statements may already have committed; inspect the actual schema before deciding whether to retry. Ask for a reviewed forward-fix SQL or restore the database from a verified backup. **Do not assume re-running or deleting tables is safe.**
- **Website broken after merge:** **Do not blindly roll back to pre-PR #1 code after 0003**: that code uses direct quest INSERT, which 0003 revokes, so quest creation would remain broken. Vercel rollback restores code only, **not database schema**. Prefer a reviewed forward-fix deployment compatible with the migrated database, or coordinate a verified database restore and matching code version.
- **Authentication failure:** Check Supabase Auth settings, redirect allow-list, email delivery and Vercel env variable names. Do not disable authentication to work around the failure.
- **Leaked key:** Revoke the personal API key immediately; if the service-role secret leaked, rotate it in Supabase, update Vercel and redeploy.
- **After a failed migration:** Prefer a tested forward fix; restore from backup only with an explicit recovery plan because it can erase subsequent data.
