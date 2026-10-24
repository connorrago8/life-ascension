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
Local throwaway checks live in `tests/sql/scheduling_auth_smoke.sql` and run from `tests/sql/run-local.sh` after migrations `0001` through `0005`. They are not a production release gate. On 2026-10-24 that script passed on local PostgreSQL 16, and `npx tsc --noEmit` plus `npm run build` passed. Deployed sign-in, a real two-user Supabase project, and mobile checks are still open.

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
- `list_quests` in `app/api/mcp/route.ts` filters `.eq('active', true)`.

`feature/login-otp` and `feature/quest-edit-archive` are not merged into this branch and are not covered here.

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
