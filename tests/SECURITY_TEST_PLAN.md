# LIFE ASCENSION — required release tests

Status: **NOT YET EXECUTED**. Do not invite players or upload sensitive evidence before these pass.

## Authentication
- Logged-out users cannot read quest, instance, event, or XP rows.
- Email sign-in works from the deployed URL.
- Sign-out clears access to private data.

## Two-user isolation
- Create users A and B in a development Supabase project.
- A cannot select, insert, or mutate B's quest data.
- A cannot call `ensure_quest_instance` on B's quest.
- A cannot call `set_quest_instance_status` on B's instance.
- B cannot see A's XP or event records.
- Attempt direct inserts/updates to protected instance, event, and ledger tables; all must be denied.

## Exactly-once XP
- Complete the same instance twice; XP remains 1.
- Submit two simultaneous completion requests; XP remains 1.
- Defer/resume does not award XP.
- A daily quest creates a separate instance for each date.
- A one-time quest does not create a second instance on a later date.
- Multiple concurrent ensure calls do not duplicate instances.

## Mobile and usability
- Daily quest completion works at iPhone viewport width.
- Quest actions are usable by keyboard and screen reader.
- Failed database requests show a useful error.

## Scheduling, XP, and the MCP user context
Local throwaway checks live in `tests/sql/scheduling_auth_smoke.sql`, `tests/sql/two_user_mcp_auth.sql`, `tests/sql/archive_compat_smoke.sql`, `tests/sql/daily_late_window_smoke.sql`, and `tests/mcpToolIsolation.test.mjs`. `tests/sql/run-local.sh` applies migrations `0001` through `0007` in order and runs the SQL smokes. They are not a production release gate. Deployed sign-in, a hosted two-user Supabase project, and mobile checks are still open.

- `create_scheduled_quest` stores a one-time chore on the next Thursday (Chicago) after today, with a matching instance.
- That future chore cannot be completed yet.
- A daily habit dated tomorrow cannot be completed.
- A daily habit dated today, yesterday, or 2 Chicago days ago earns 1 XP once. A daily instance dated 3 days ago is rejected and earns no XP.
- A daily habit created with a start 30 days ago keeps that `scheduled_for`, opens its first instance on today minus 2 days, and can earn at most 3 XP.
- An overdue one-time chore can still be completed. A deadline goal (`quest_type = goal`) can be completed before its date.
- Completing that goal twice leaves exactly one XP row and one completion event.
- `add_quest_progress` saves a note and does not change XP or instance status, including on the API-key wrapper.
- `authenticate_api_key` returns no row after `revoke_api_key`. `/api/whoami` and `/api/mcp` map that miss to HTTP 401 with `WWW-Authenticate: Bearer` (`tests/mcpAuthContract.test.mjs`).
- `INSERT` into `public.quests` is denied for `authenticated`.
- `anon` and `authenticated` cannot execute the `*_as_user` wrappers, even if `request.jwt.claim.role` is set to `service_role`.
- `service_role` without a `service_role` JWT claim is rejected. With the claim, the wrapper writes as `p_user_id` and the pin does not leak into the next statement.
- One user's wrapper cannot complete another user's instance.
- `list_quests` loads the caller's active quests, then loads instances only for those quest ids. An inactive quest's instance is not returned. `get_character_progress` returns the caller's lifetime XP and completed-instance count, not instance rows. The count stays aligned with the ledger, including completions of quests that are later marked inactive.

## Two API keys
`tests/sql/two_user_mcp_auth.sql` and `tests/mcpToolIsolation.test.mjs` cover two users:

- Each user has a key and quests. Through `*_as_user`, A cannot create a quest owned by B, add a note to B, ensure B's instance, or complete B. The reverse holds.
- XP and `xp_ledger` stay one user's rows. A's note does not change that.
- A signed-in JWT sees only that user's quests under RLS.
- Revoking A's key makes `authenticate_api_key` return no row. B's key still authenticates. The route maps the empty row to HTTP 401.
- `list_quests` for A omits B's rows and A's inactive instance, including when history is requested.

## Daily late window
`supabase/migrations/202610240007_daily_late_window.sql` replaces the scheduling functions. It does not edit `0003`. Chicago today is `(now() at time zone 'America/Chicago')::date`.

- A daily instance earns XP only when `today - 2 <= due_date <= today`.
- `create_scheduled_quest` still accepts a daily start up to 30 days ago and stores it in `scheduled_for`. The instance it opens uses `greatest(start, today - 2)`.
- `ensure_quest_instance` rejects a daily date before today minus 2 days.
- One-time chores are not clamped and can be completed while overdue. Goals can be completed early.
- Apply `0007` after `0006` when both are used. `0006` also replaces `set_quest_instance_status`. Running `0006` later removes the window until `0007` is applied again. The `0007` function keeps `0006`'s return of `completed` before the inactive-quest check.

## Quest edit/archive
`202610240006_quest_edit_archive.sql` is applied before `0007`. `0007` is the final `set_quest_instance_status`. It keeps the completed-instance return before the active check and the 2-day daily window.

`tests/sql/archive_compat_smoke.sql` covers archive, rename, and reschedule. An archived open quest cannot be completed. An already completed archived quest returns `completed` and keeps its one XP row. Moving a daily start forward defers today's open instance and awards no XP for that instance. A scheduled chore cannot be moved earlier. A daily start moved into the past does not open or pay any instance older than today minus 2 days. A daily instance dated before `0007`, with its due date older than today minus 2, is rejected and awards no XP.

Rename, reschedule, and archive are granted to `authenticated` only. There is no `*_as_user` wrapper, so an API key cannot call them. `/api/mcp` `submit_completion` for a daily date three days ago returns the tool error the route publishes as a JSON-RPC error, and XP stays unchanged.

`feature/login-otp` is not merged and was not part of this check.

## API keys and progress notes
- Apply `supabase/migrations/202610230002_api_keys_progress.sql` on a development database before these checks. The integration database also applies `0003`, `0004`, `0005`, `0006`, and `0007` after it.
- A user can read `api_keys_safe` for their own keys and cannot select `api_keys.key_hash`.
- A user cannot insert into `api_keys` or `quest_progress` directly.
- `revoke_api_key` revokes only the caller's key. A second user gets `API key not found`.
- A revoked key fails `authenticate_api_key`. `last_used_at` stays unchanged on that failure.
- `add_quest_progress` stores a note for the caller's quest and rejects another user's quest or instance.
- After `add_quest_progress`, `xp_ledger` is unchanged and the quest instance status is unchanged.
- Notes longer than 1000 characters, percents outside 0–100, and unknown sources are rejected.
- `GET /api/whoami` without a bearer token returns 401 and `WWW-Authenticate: Bearer`.
- The plaintext key appears only in the create response. The `api_keys` row stores the SHA-256 hex hash.

## Release gate
- Run `npm install` and `npm run build`.
- Execute tests against a dedicated development database.
- Verify no secrets or personal records are committed to the public repository.
- Configure Supabase redirect URLs before live authentication.
