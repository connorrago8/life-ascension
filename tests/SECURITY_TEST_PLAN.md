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

## Release gate
- Run `npm install` and `npm run build`.
- Execute tests against a dedicated development database.
- Verify no secrets or personal records are committed to the public repository.
- Configure Supabase redirect URLs before live authentication.
