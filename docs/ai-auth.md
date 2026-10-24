# AI auth: hashed API keys and quest progress notes

Personal API keys and quest progress notes are integrated on `feature/shared-ai-quest-mcp` (PR #1). `/api/mcp` accepts an API key or a Supabase user JWT.

Nothing in this pull request is applied to production. The migrations are files until Connor runs them.

## How API keys work

- A key looks like `la_live_` plus 32 random bytes encoded as base64url (43 characters). The server generates it with `crypto.randomBytes`. The browser never generates the secret.
- The create response shows the full key once. The database stores `prefix` (the leading `la_live_` plus 8 characters, so you can recognize the key) and `key_hash` (lowercase SHA-256 hex of the full key). The plaintext is not stored and cannot be recovered.
- Default scopes are `quests:read` and `quests:write`.
- Revoking sets `revoked_at`. A revoked key fails authentication. `last_used_at` updates only after a successful lookup.
- Lookup hashes the bearer token, then calls the `SECURITY DEFINER` function `authenticate_api_key(text)` with the service-role client. The function rejects a missing or revoked row. Application code compares the digests with `crypto.timingSafeEqual` and does not log the key, the hash, or the `Authorization` header.
- Clients read `api_keys_safe` (name, prefix, scopes, created, last used, revoked). `key_hash` is not granted to `anon` or `authenticated`. Inserts happen only in the server route. Revocation is `revoke_api_key(uuid)`, which updates a row only when `auth.uid()` owns it.

`SUPABASE_SERVICE_ROLE_KEY` is read on the server. Do not prefix it with `NEXT_PUBLIC_` and do not import the service-role client from a client component.

## Create and revoke a key

1. Sign in on the deployed site.
2. Open `/settings/api-keys` (also linked from the quest board footer).
3. Name the key and choose **Create API key**.
4. Copy the key and store it outside the app, then choose **I have saved this key**. Leaving the page clears it from the page state.
5. To revoke, choose **Revoke** and confirm. The list shows **Revoked**. Create a new key if you still need access.

Listing and revoking use your signed-in Supabase session. Creating a key and calling `/api/whoami` with a key also need `SUPABASE_SERVICE_ROLE_KEY` on the server.

## Call `/api/whoami`

`/api/whoami` does not read the browser session cookie. Send a bearer token: a personal API key or a Supabase user access token.

Missing or rejected credentials return **401** with `WWW-Authenticate: Bearer realm="life-ascension"`.

```bash
curl -i https://life-ascension.vercel.app/api/whoami \
  -H "Authorization: Bearer la_live_PASTE_THE_KEY_ONCE"
```

A valid key responds with JSON:

```json
{"user_id":"...","auth_method":"api_key","scopes":["quests:read","quests:write"]}
```

A Supabase user access token uses the same header and returns `"auth_method":"supabase_jwt"`. User JWTs expire; a personal key works until you revoke it.

Check the header without a real key:

```bash
curl -i https://life-ascension.vercel.app/api/whoami
```

Expect `HTTP/1.1 401` and a `WWW-Authenticate: Bearer` header. Do not paste a real key into GitHub, chat, or logs.

## Quest progress notes

`quest_progress` stores a note (1–1000 characters), an optional percent from 0 to 100, and a source of `web`, `chatgpt`, `grok`, or `api`. `instance_id` is optional and must belong to the same quest and user.

Signed-in users insert only through `add_quest_progress(...)`. The function checks `auth.uid()` owns the quest (and the instance, when one is sent) and inserts a row. It does not write `xp_ledger`, quest events, or instance status. XP stays on the existing completion path: confirm completion on the quest board, which calls `set_quest_instance_status`.

Open **Quest notes** from the quest board footer, then open a quest to add a note. The quest board also links to **API keys**. Scheduling, overdue items, and the Upcoming list stay on the board.

Direct inserts and updates on `quest_progress` are not granted to browser roles. Users can read their own rows.

`/api/mcp` `update_progress` calls the same `add_quest_progress` function. See `docs/ai-connector.md` for the tool list.

## How API-key tool calls get a user

`auth.uid()` is null on a service-role connection. `/api/mcp` does not mint a user JWT. For an API key it calls `create_scheduled_quest_as_user`, `ensure_quest_instance_as_user`, `set_quest_instance_status_as_user`, `add_quest_progress_as_user`, and `get_lifetime_xp_as_user`.

Those functions live in `supabase/migrations/202610240005_api_key_user_context.sql`. They are granted only to `service_role`. Each wrapper checks that the JWT role claim is `service_role`, pins `request.jwt.claim.sub` to the key's user for the current transaction, and calls the existing function. A user JWT still calls the original functions with the anon client. The route always passes the user id from `authenticateRequest`, never a user id supplied by the model.

## Manual steps for Connor

This pull request does not run SQL against Supabase and does not change Vercel settings. Leave `feature/login-otp` unmerged.

1. In the Supabase SQL editor, confirm `supabase/migrations/202610230001_core.sql` is already applied.
2. Paste and run these files in order. Stop if any file errors.
   1. `supabase/migrations/202610230002_api_keys_progress.sql` — `api_keys`, `api_keys_safe`, `quest_progress`, `authenticate_api_key`, `revoke_api_key`, `add_quest_progress`.
   2. `supabase/migrations/202610230003_future_quest_scheduling.sql` — `scheduled_for`, `quest_type`, `create_scheduled_quest`, and the updated instance and completion functions. This revokes direct `INSERT` on `quests` for `anon` and `authenticated`.
   3. `supabase/migrations/202610230004_lifetime_xp.sql` — `get_lifetime_xp()`.
   4. `supabase/migrations/202610240005_api_key_user_context.sql` — service-role `*_as_user` wrappers required by `/api/mcp` when the caller uses an API key.
   5. `supabase/migrations/202610240006_quest_edit_archive.sql` — browser/JWT `rename_quest`, `reschedule_quest`, and `archive_quest`. No API-key wrappers for those three. This file also replaces `set_quest_instance_status`.
   6. `supabase/migrations/202610240007_daily_late_window.sql` — run this last. Daily habits earn XP only for today and the previous 2 Chicago days. A daily start can still be up to 30 days ago; the instance created with it is dated no earlier than today minus 2 days. One-time chores stay completable while overdue. Deadline goals stay completable early. This is the final `set_quest_instance_status`: it keeps `0006`'s completed-first return and inactive-quest rejection, plus the 2-day window.
3. Leave `feature/login-otp` unmerged. Do not run `0006` after `0007`. If that happens, run `0007` again.
4. If the API does not see the new objects, reload the schema under Project Settings → API. The migrations already run `NOTIFY pgrst, 'reload schema';`.
5. In Supabase → Project Settings → API, copy the `service_role` secret.
6. In Vercel → Project → Settings → Environment Variables, set `SUPABASE_SERVICE_ROLE_KEY` to that secret for Production, and for Preview if you test a preview URL. Do not use the `NEXT_PUBLIC_` prefix. Do not commit the value. The name is listed in `.env.example` and `docs/.env.example`.
7. Redeploy so the server can read the variable.
8. Sign in, create a key at `/settings/api-keys`, and run the `/api/whoami` curl above. Revoke the key and run curl again. Expect 401 and `WWW-Authenticate: Bearer`.
9. Repeat the `/api/mcp` curls in `docs/ai-connector.md` with the same key, then again after revoke. Expect 401 after revoke.
10. Save a quest note and confirm the quest board XP and completion status stay the same until you explicitly complete the quest.

Optional local schema check (PostgreSQL 16, not CI, not production):

```bash
tests/sql/run-local.sh
```

That script loads `0001` through `0007` in order and runs the API-key, scheduling, two-user, archive, and daily-window smokes. The handler checks in `tests/mcpToolIsolation.test.mjs` cover the same split for `list_quests`: A does not see B's rows or A's inactive instances. An API-key `submit_completion` for a daily date three days ago fails and does not change XP.

## Out of scope here

- OAuth, PKCE, refresh tokens, and dynamic client registration
- `feature/login-otp`
- Applying the migrations or setting the Vercel secret from this repository
