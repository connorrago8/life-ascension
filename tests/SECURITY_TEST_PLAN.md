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
Local throwaway checks live in `tests/sql/scheduling_auth_smoke.sql`, `tests/sql/two_user_mcp_auth.sql`, and `tests/mcpToolIsolation.test.mjs`. `tests/sql/run-local.sh` applies migrations `0001` through `0005` and runs the SQL smokes. They are not a production release gate. On 2026-10-24 that script passed on local PostgreSQL 16, and `npx tsc --noEmit` plus `npm run build` passed. Deployed sign-in, a hosted two-user Supabase project, and mobile checks are still open.

- `create_scheduled_quest` stores a one-time chore on the next Thursday (Chicago) after today, with a matching instance.
- That future chore cannot be completed yet.
- A daily habit dated tomorrow cannot be completed.
- A deadline goal (`quest_type = goal`) can be completed before its date.
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

## Quest edit/archive (not merged)
`feature/quest-edit-archive` at `f5dccf1` was checked by applying `0001`–`0005` and then `supabase/migrations/202610240006_quest_edit_archive.sql` from that branch on a throwaway database (`tests/sql/run-archive-compat.sh`). It was not merged and was not pushed. Required cases in `tests/sql/archive_compat_smoke.sql` passed: an archived quest cannot be completed and earns no XP; archiving keeps the existing completion and XP; a daily habit can be rescheduled after an earlier completion; moving that habit's start into the future defers today's open instance and awards no XP; a scheduled chore cannot be moved earlier to today and then completed; rename stores the trimmed title. `set_quest_instance_status_as_user` still completes an active quest once and rejects an archived one.

Should-fix before that branch is merged here:

- `202610240006_quest_edit_archive.sql:79` changes the future-daily error from `Future daily quests cannot be completed` to `Daily quest not eligible`. `tests/sql/scheduling_auth_smoke.sql` then fails. The completion is still rejected.
- `202610240006_quest_edit_archive.sql:76` rejects a second complete of an already completed archived quest with `Active quest not found` before the idempotent return on line 77. XP does not change.
- `202610240006_quest_edit_archive.sql:37` treats a null `scheduled_for` as today. A one-time chore with a null start and a future instance can be moved to today and completed for 1 XP. `create_scheduled_quest` always sets `scheduled_for`. Rows from before `0003` can still be null. Authenticated users cannot insert those rows directly.
- `202610240006_quest_edit_archive.sql:56-61` grants rename, reschedule, and archive to `authenticated` only. There is no `*_as_user` wrapper, so an API key cannot call them until that is added. Existing wrappers keep working.

`feature/login-otp` is not merged and was not part of this check.

## API keys and progress notes
- Apply `supabase/migrations/202610230002_api_keys_progress.sql` on a development database before these checks. The integration database also applies `0003`, `0004`, and `0005` after it.
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
