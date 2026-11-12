# Integrated TEST verification — November 11, 2026

Application candidate: `deb3c71a3c1aed18af4af868b099c91eb5450600`.

Immutable TEST preview: https://life-ascension-osckdnvma-r6r6bsfbkm-9616.vercel.app

Integrated PR: https://github.com/connorrago8/life-ascension/pull/136

## Evidence

- CI: https://github.com/connorrago8/life-ascension/actions/runs/43150300257 — unit/types/build, mock Chromium confirmation tests, complete Postgres 16 migration/smoke/concurrency/rollback checks passed.
- 725 unit tests passed. Production-mode build isolation scan had zero production references.
- Hosted signed-in walkthrough: https://github.com/connorrago8/life-ascension/actions/runs/43150300343 — PASS against the immutable preview and candidate above.
- Real, isolated TEST identities signed in through the deployed login form in separate Chromium contexts.
- Shield cancel did not spend; explicit use persisted across refresh; the other account retained its shield.
- Normal quest completion persisted after refresh; pharmacy pack repeated without duplicates.
- Both accounts marked a shared quest; the receipt awarded Connor normal streak-scaled XP and Izzy exactly 10 XP.
- Izzy logged a small activity, refreshed History, and retained it. Her wardrobe total was 15 XP (10 couple + 5 activity). Wearing an earned cosmetic survived refresh and did not change XP.
- Additional real Auth/REST check: Izzy assigned a quest immediately to Connor without acceptance or companion XP.

## Bugs found and repaired

The activity-v2 RPC only allowed the inviter, so the companion's own form could never save. The forward migration now accepts either active bond member while keeping the companion as the fixed XP subject. Request/title/day duplicate protection, tier validation, and ownership stay enforced.

Couple XP was absent from the lifetime sum used for the companion's level and cosmetics. The sum now includes her account-scoped companion ledger. No historical ledgers, worn gear or earned ownership rows were rewritten.

The activity migration has a rollback restoring the preceding functions; execute it before rolling back the couple tables. The disposable runner tests this ordering.

## Migration history

Integration combines #132, #133 (which includes #128/#130), #134 and #135. Conflicts in the quest page and SQL runner were resolved by retaining both features; both design test suites remain.

Duplicate version prefixes were renamed consistently to unique chronological versions for pharmacy, dark catalog, headset, content, couple, activity-guide and design files. Existing TEST migrations were applied through several differently named/split management migrations. Do not run blind `supabase db push`, rewrite hosted migration history, or replay the complete baseline on TEST/production. The local chain is verified on disposable databases; use reviewed forward migrations for existing environments.

Only `explicit_streak_shield_confirmation` and `companion_self_activity_logging` were applied by this takeover, to TEST `njqwwimzrsunheehnnnt`. Production `ugcvhmrriazbbymjxvch` was not changed.

## Hosted test credentials

The hosted workflow generates an ephemeral RSA key; only its public key is uploaded. An agent encrypts isolated TEST credentials and the exact preview/candidate to that key using RSA-OAEP plus AES-256-GCM, and supplies a run-ID-scoped ciphertext. The runner rejects other commits/projects. No plaintext credentials or browser auth state are committed or uploaded. The temporary ciphertext is removed after the run, and the test identities are revoked and deleted after verification. For a rerun, provision fresh isolated identities, obtain the new public-key artifact, and supply a fresh envelope for that run and its immutable deployment. Never use real player credentials.

PR #136 remains draft for founder review. Nothing was merged into main or promoted.
