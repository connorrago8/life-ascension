# QA isolation and reliability audit — 2026-10-27

This branch is intentionally separate from the accepted release candidate `528d77d`. Do not merge or deploy before review.

## Verified
- Production Supabase project: `ugcvhmrriazbbymjxvch`.
- QA Supabase project: `njqwwimzrsunheehnnnt`; it has existing auth and quest/XP test records. Do not reset.
- Vercel default `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` entries target both production and preview.
- Four named preview branches have QA-specific URL overrides.
- Production has eight authenticated-callable SECURITY DEFINER function warnings; QA has eleven. This is an audit signal, not proof of exploitability.
- Production has five unindexed foreign-key warnings; QA has six.
- QA has `quest_progress_operations` absent from production. Schema must be aligned with the intended release, not blindly copied.

## Release gate
1. Restrict the existing shared public Supabase URL/key entries to **production only**, retaining their values.
2. Add **preview-only** URL and public client key for the QA project, retaining existing branch overrides.
3. Confirm there are no server-side privileged secrets in Preview or code paths that fall back to Production.
4. Verify the effective target in a *new* preview deployment; environment edits do not retroactively change already-built deployments.
5. Run authenticated two-user isolation, exactly-once XP, reload persistence and iPhone Quest Board checks.
6. Keep production untouched until the above passes.

## Security follow-up
Review every SECURITY DEFINER function for `auth.uid()` and ownership enforcement, safe `search_path`, EXECUTE grants, and API wrapper behavior before changing permissions. Four QA definitions reviewed (`add_quest_progress`, `log_quest_progress`, `revoke_api_key`, `set_quest_instance_status`) contain owner checks; further tests are still required.

## Performance follow-up
Prepare migration(s) for justified composite foreign-key indexes after inspecting existing indexes, query plans, and production load. Do not remove 'unused' indexes based only on a short observation window.

## Operational constraint
No hosted QA data writes, database migrations, Preview deployments, or Production changes are authorized by this document alone.
