# Crypt cloud-save QA rollout

Cloud saves are **off by default**. Set `NEXT_PUBLIC_CRYPT_CLOUD_SAVE_ENABLED=true` **only on the isolated QA Preview deployment** with its matching QA Supabase URL and publishable/anon key. Do not set this on production: the production database has not been migrated.

The QA project `life-ascension-restore-test` has the `adventure_run_saves` table and `save_adventure_run` RPC. The cloud adapter requires an authenticated session. Signed-in users load their own saved run and save with expected-revision compare-and-swap. Unauthenticated preview users retain browser-local saves. A cloud read error blocks starting a new run to prevent overwriting inaccessible progress.

## Required acceptance before promotion

1. Verify exact commit and CI TypeScript/build/unit test results.
2. Verify QA Preview points to the isolated QA project and that authentication works there.
3. Account A starts a run, advances to map, refreshes and resumes at the same state.
4. Account A signs in on a second device and resumes the same seed and phase.
5. Two tabs load the same revision; one saves first; the other gets a conflict and cannot silently overwrite.
6. Account B cannot read Account A's save; unauthenticated calls cannot read or invoke save RPC.
7. Disable network and confirm save failure is visible; verify no false 'saved' status.
8. Inspect security advisor findings for the exposed SECURITY DEFINER RPC; independently audit input validation and owner scoping.
9. Verify defeat and restart behavior and prior Crypt Chromium journey tests.

**Known limitations:** Browser-local saves are not automatically migrated to accounts; no merge UI for conflicts; no authenticated account-switch handling without remount; no verified browser run yet. These are release blockers, not accepted behavior.
