# Engagement push (TEST)

Web push, the status pill, and the Scriptable widget run on the TEST project only
(`njqwwimzrsunheehnnnt`). Do not add these variables to Production.

## Preview environment variables

Add all of these to the Vercel **Preview** environment for branch
`grok/engagement-pwa-push-20261114`. Do not add them to Production.

- `VAPID_PUBLIC_KEY`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (same value as `VAPID_PUBLIC_KEY`)
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (`mailto:` address or `https://` URL)
- `CRON_SECRET` (long random ASCII string)

Generate a VAPID pair locally with `npx web-push generate-vapid-keys`. Do not commit or paste the private key into git, logs, or the pull request.

If any of the VAPID variables are missing, `/settings/notifications` shows **Push is not configured on this server** and quest actions keep working.

The branch is on the protected TEST allowlist so a Preview build can reach the TEST database. It still must not receive a service-role key. Push sending uses the signed-in session and security-definer RPCs, which is what Preview allows.

## Quiet hours and the evening reminder

Defaults are 10:00 PM to 7:00 AM in the account's quest time zone. That zone is America/Chicago unless a profile timezone is stored. Each person toggles:

- partner assigned you a quest
- partner completed a quest you assigned
- evening streak reminder (only if that person's own streak would break, and only from 7:00 PM to 10:00 PM)
- one daily progress notification (`tag: daily-progress`, `renotify: false`)

Partner text names the quest. It does not include the other account's XP, level, or streak.

Sends are idempotent per user, type, and game day. Daily progress may send again only when that person's own snapshot changes, and the new notification replaces the previous one.

## Cron

`vercel.json` schedules `GET /api/push/cron` at `0 2 * * *` (02:00 UTC). That is 8:00 PM CST and 9:00 PM CDT, inside the evening window and before the default quiet hours. The Hobby plan allows one run a day. The route requires `Authorization: Bearer $CRON_SECRET`.

After `CRON_SECRET` is set on Preview, bind its SHA-256 on TEST once, in the SQL editor. Replace the placeholder locally. Do not commit the secret.

```sql
update private.engagement_config
set cron_secret_hash = encode(extensions.digest(convert_to('YOUR_CRON_SECRET', 'UTF8'), 'sha256'), 'hex')
where id = 1;
```

Until that row is set, the evening reminder sends only when that person's app is open during the evening window. Quest completion and assignment still enqueue immediately and flush while the app is open.

## More frequent reminders without GitHub Actions

If a daily Vercel cron is not enough, TEST can call the same route from `pg_cron` + `pg_net`. Do not add a GitHub workflow for this. Example, run in the TEST SQL editor only, with the real preview URL and secret:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'engagement-streak-reminder',
  '0 2 * * *',
  $$select net.http_get(
      url := 'https://YOUR_PREVIEW.vercel.app/api/push/cron',
      headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET')
    )$$
);
```

Keep the schedule at or after 7:00 PM America/Chicago and before 10:00 PM. The route drops streak reminders outside that window.

## Migration

Apply `supabase/migrations/202611140001_engagement_pwa_push.sql` on TEST only.
Roll back with `supabase/rollbacks/202611140001_engagement_pwa_push_down.sql`.

Settings live at `/settings/notifications` and in `components/NotificationSettings.tsx`, ready to mount under More.
