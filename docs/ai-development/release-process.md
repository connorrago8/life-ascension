# Release process

These are standing rules. They are not hints.

- Do not merge to `main`, and do not deploy or migrate production, unless Connor writes that instruction in the task. "Ship", "finish", and "open a PR" are not that instruction.
- Production Supabase is `ugcvhmrriazbbymjxvch`. Never run SQL against it. Never point a migration tool at it.
- TEST Supabase is `njqwwimzrsunheehnnnt` (`life-ascension-restore-test`). Migrations that are authorized are additive, reversible, and applied there only. Commit the SQL and a matching file under `supabase/rollbacks/`.
- Do not edit `.github/workflows`. GitHub Actions on this beta branch is already a push-only gate. Changing the workflow to make a check look green is a weakened guard.
- Do not force-push.
- Do not weaken RLS, auth, or the deployment guards. Do not add a feature branch to `PROTECTED_QA_BRANCHES` in `scripts/verify-deployment-env.mjs` or `scripts/verify-qa-browser-bundle-after-build.mjs`.
- Do not change the Crypt XP cap. `record_crypt_floor_clear` stays as it is.
- Permanent combat power comes only from real-life quests. The dungeon does not grant it.
- Wear is explicit. Do not auto-equip.
- No secrets, tokens, share tokens, service-role keys, or personal data in git, PR bodies, or these docs.
- `AGENTS.md` at the repo root is one sentence: build cleanly, and stop to say so if the clean path is a refactor. Do not bolt a feature on because it was requested.

## Where a change is allowed to go

Draft PR into `beta/crypt-intro-exit-accessibility-20261029`. Leave it draft. Report the PR URL and the full head SHA.

A green local `npm test` is not a production deploy. A file in `supabase/migrations/` is not an applied migration. A Vercel ERROR on a feature branch is the guard working.

## Environments, by variable name

Public client: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Build identity: `VERCEL_ENV`, `VERCEL_GIT_COMMIT_REF`, `SUPABASE_PUBLIC_KEY_SHA256`. Privileged names the preview guard rejects: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`, `DATABASE_URL`, `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `SUPABASE_DB_PASSWORD`.

Preview maps to TEST `njqwwimzrsunheehnnnt`. Production maps to `ugcvhmrriazbbymjxvch`. The mapping is in `scripts/verify-deployment-env.mjs`.

## Rollback

Code: revert the PR. Do not reset a shared branch. SQL: run the matching file in `supabase/rollbacks/` on TEST only, and read what that file refuses to undo. Example: `202611110001_companion_finish_down.sql` drops the wardrobe and the trigger, and it does not reopen companion quests whose instance is already completed.
