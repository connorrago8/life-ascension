# Shared ChatGPT and Grok connector

This branch wires `/api/mcp` to the scheduling, XP, and API-key migrations. It is review code. Nothing here has been applied to production, and this pull request should stay a draft until Connor finishes the manual steps below.

`feature/login-otp` and `feature/quest-edit-archive` are not part of this integration.

Live site: https://life-ascension.vercel.app

## Authentication

`POST /api/mcp` and `GET /api/mcp` use `authenticateRequest`.

- A Supabase user access token uses the anon client with that bearer token, so `auth.uid()` is the signed-in user. The route calls `create_scheduled_quest`, `ensure_quest_instance`, `set_quest_instance_status`, `add_quest_progress`, and `get_lifetime_xp`.
- A personal API key (`la_live_...`) is hashed and resolved with the service-role client. The route then calls the `*_as_user` wrappers from `supabase/migrations/202610240005_api_key_user_context.sql`, passing the user id from the key lookup. Tool arguments cannot choose a different user.
- Missing or rejected credentials return **401** with `WWW-Authenticate: Bearer realm="life-ascension"` and `Cache-Control: no-store`. A revoked key takes the same path: `authenticate_api_key` returns no row, and the route responds 401. It does not say whether the key was unknown or revoked.
- A key that lacks `quests:write` or `quests:read` for the tool being called returns **403**.

The wrappers are `SECURITY DEFINER` and executable only by `service_role`. Each one requires the JWT role claim to be `service_role`, sets `request.jwt.claim.sub` to the authenticated user for the current transaction only, and calls the existing function. The setting is not session-wide, so a pooled connection does not keep the user. The helper `_bind_service_role_user` is not executable by `anon`, `authenticated`, or `service_role`; only the wrapper bodies run it.

This does not mint a user JWT. Minting would require the project's JWT secret on the server and would be easier to get wrong. The service-role key stays in `SUPABASE_SERVICE_ROLE_KEY` and is never sent to the browser or the model.

OAuth, PKCE, refresh tokens, and dynamic client registration are still not implemented. ChatGPT's OAuth connector is not ready. A personal API key is the path for a client that can send a bearer token.

## Tools

- `create_quest` calls `create_scheduled_quest` (`p_quest_type` `scheduled` or `goal`). It does not insert into `quests` and it does not delete a row if a later step fails. The database creates the quest and its instance together. `goal` requires cadence `once`. A daily habit may still start as far back as 30 Chicago days, and `scheduled_for` stores that date. The instance opened at creation is never older than today minus 2 days. One-time chores and goals are not clamped.
- `update_progress` calls `add_quest_progress`. The note is a journal entry. It does not award XP and does not change instance status.
- `submit_completion` requires `confirmed_complete` to be exactly `true`, then calls `set_quest_instance_status` with action `complete`. A daily habit earns 1 XP only when its instance date is today or one of the previous 2 Chicago days (`today - 2` through today, from `(now() at time zone 'America/Chicago')::date`). An older day and a future day are rejected and award no XP. `ensure_quest_instance` also refuses to open a daily instance before that window. An overdue one-time chore can still be completed. A deadline goal can still be completed early. A second completion returns success and does not add XP.
- `list_quests` returns the caller's **active** quests (`active = true`). Instances are loaded only for those quest ids, so an inactive quest's instance is not returned. `due_date` defaults to the Chicago calendar date. `include_history` skips the instance date filter and still omits inactive quests. The instance list is capped at 500 rows.
- `get_character_progress` reads `get_lifetime_xp` and the caller's completed instance count. It returns those two numbers, not quest or instance rows. The count includes every completed instance that user owns, so it stays aligned with lifetime XP after a quest is marked inactive.

Dates use `America/Chicago`. The database accepts a scheduled date from 30 days ago through 366 days ahead. Daily XP is limited to today and the previous 2 days. A daily created with an older start can earn at most 3 XP from the instances inside that window.

## Manual steps for Connor

Do these yourself. This pull request does not run SQL against Supabase and does not change Vercel.

1. In the Supabase SQL editor, confirm `supabase/migrations/202610230001_core.sql` is already applied. Do not run it again.
2. Paste and run these files **in order**. Run the next file only after the previous one finishes without error.
   1. `supabase/migrations/202610230002_api_keys_progress.sql`
   2. `supabase/migrations/202610230003_future_quest_scheduling.sql`
   3. `supabase/migrations/202610230004_lifetime_xp.sql`
   4. `supabase/migrations/202610240005_api_key_user_context.sql`
   5. `supabase/migrations/202610240007_daily_late_window.sql` — daily habit XP window. Run this last. It replaces `create_scheduled_quest`, `ensure_quest_instance`, and `set_quest_instance_status`. The `*_as_user` wrappers from `0005` call those functions by name, so they pick up this definition.
3. `0005` is required for API-key tool calls. It does not replace the functions from `0003` or `0004`. It adds service-role wrappers that pin the authenticated user for one transaction. `0007` does not require `feature/quest-edit-archive`. Leave that branch and `feature/login-otp` unmerged. If you later apply `202610240006_quest_edit_archive.sql`, run it before `0007`. Both files replace `set_quest_instance_status`. If `0006` is applied after `0007`, run `0007` again so the daily window stays in the function. The `0007` body keeps `0006`'s completed-instance return and its rejection of an inactive quest.
4. If the API does not see the new functions, reload the schema (Project Settings → API) or run `NOTIFY pgrst, 'reload schema';`. The new migrations already send that notify.
5. In Supabase → Project Settings → API, copy the `service_role` secret.
6. In Vercel → Project → Settings → Environment Variables, set `SUPABASE_SERVICE_ROLE_KEY` to that secret for Production, and for Preview if you exercise the preview URL. Do not use the `NEXT_PUBLIC_` prefix. Do not commit the value.
7. Redeploy so the server can read the variable.
8. Sign in, open `/settings/api-keys`, and create a key. Copy it once. Then run the curls below. Revoke the key and run the 401 curls again.

## Curl checks

Replace the host if you are using a preview deployment. Do not paste a real key into GitHub, chat, or logs.

```bash
curl -i https://life-ascension.vercel.app/api/whoami
curl -i https://life-ascension.vercel.app/api/mcp
```

Both should be `401` with `WWW-Authenticate: Bearer`.

```bash
curl -sS https://life-ascension.vercel.app/api/whoami \
  -H "Authorization: Bearer la_live_PASTE_THE_KEY_ONCE"

curl -sS https://life-ascension.vercel.app/api/mcp \
  -H "Authorization: Bearer la_live_PASTE_THE_KEY_ONCE" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

curl -sS https://life-ascension.vercel.app/api/mcp \
  -H "Authorization: Bearer la_live_PASTE_THE_KEY_ONCE" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"create_quest","arguments":{"title":"Take out recycling","domain":"home","cadence":"once","quest_type":"scheduled","due_date":"2026-10-29"}}}'

curl -sS https://life-ascension.vercel.app/api/mcp \
  -H "Authorization: Bearer la_live_PASTE_THE_KEY_ONCE" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"update_progress","arguments":{"quest_id":"PASTE_QUEST_ID","note":"Bought bags"}}}'

curl -sS https://life-ascension.vercel.app/api/mcp \
  -H "Authorization: Bearer la_live_PASTE_THE_KEY_ONCE" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"submit_completion","arguments":{"quest_id":"PASTE_QUEST_ID","confirmed_complete":true}}}'
```

Expect `whoami` to return `auth_method` `api_key`. Expect `create_quest` to return a quest id. Expect `update_progress` to include `"xp_awarded":false`. Expect `submit_completion` for a future scheduled chore to return an error from `set_quest_instance_status`, not a new XP row. After you revoke the key, repeat `whoami` and `/api/mcp` with the same bearer token and expect `401`.

A Supabase user access token works in the same `Authorization: Bearer` header. Those tokens expire. A personal key works until you revoke it.
