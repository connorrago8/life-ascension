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

## API keys and progress notes
- Apply `supabase/migrations/202610230002_api_keys_progress.sql` on a development database before these checks.
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
