# Private manual companion journal

Candidate addition to PR118; no hosted migration or release approval.

## Scope and provenance

Connor can manually record a legitimate completed Izzy activity and see a Monday–Sunday Chicago weekly tally of1 manual companion XP per activity. The journal is private to the authenticated recipient-role member, scoped to the selected companionship. No client actor/XP values are trusted. New logs require active consented membership; revocation stops new logs. The owner can still inspect and correct their own earlier private history.

This is a **manual companion profile**, separate from Connor's permanent account XP and Izzy's real account XP. It does not sync accounts, infer wellness/routines, award bonus XP, or treat missing logs as evidence of inactivity. Both account XP ledgers remain untouched. The sender cannot read this private journal. Shared quest status continues through the existing consent RPC.

Prior context excerpts were retrieved for the accepted separate manual profile, +1 eligible manual activity proposal, privacy and correction history. The full referenced Master Specification PDF was not opened. Current two-account contract takes precedence over older single-player assumptions. This slice requires an agreed recipient-role companionship; standalone/pre-invitation manual profiles are not included.

## Data and authorization

Additive migration creates private, RLS-enabled activity_entries and activity_corrections. Neither table has client read/write grants. Public `companion_activity` is SECURITY INVOKER; its private SECURITY DEFINER implementation checks auth.uid(), derives recipient permission from the actual pair and projects only that owner's chosen week. Fixed empty search_path; no service-role browser key. Existing consent/reward RPC and permanent XP trigger are unchanged.

Log requests have owner-scoped stable UUIDs. Same-ID identical retry returns the original entry; changed retry payload fails. Normalized title/Chicago calendar date per pair cannot be credited twice while active. Pair lock plus owner advisory lock serialize concurrent writes. This is trust-based meaningful-task logging; differently worded semantic duplicates are not automatically detected.

Corrections are append-only, one per entry, with reason/timestamp/request UUID. The original title/date/recording identity stays inspectable. A corrected mistaken record is excluded from the manual weekly tally; permanent account XP is never deducted. To replace it, log the corrected real activity as a new entry. Replaying an old log request cannot resurrect a corrected record. No edit/delete grant or negative-XP event is introduced.

Weeks use activity_date, not creation time. Monday grouping is computed on the server, using America/Chicago for today's date; the browser only moves between server-provided Monday date keys. No quest refresh/05:00/streak/grace rule is changed: these are historical manual calendar dates.

## Verification plan

- SQL: recipient ownership, sender/outsider/anonymous denial; no direct table grants; server-fixed1/manual provenance; retry/different-ID duplicate guard; changed payload rejection; Sunday/Monday around Nov1 DST; future/invalid date rejection; append-only idempotent corrections; revocation; no account ledger writes.
- Browser: preserve full consent/mystery/2-XP and Home overlap journey; save a manual activity with a deliberately lost response, refresh and retry the same request ID; log a second activity, correct the first, reload and retain original history + one manual tally. Connor remains4 account XP, sender0. Literal HTML stays text.
- Existing four-width/normal/enlarged-text control checks include the journal. Results are pending until exact-head CI; source and unit success are not browser evidence.

## Hosted boundaries and remaining work

Local/CI authentication is synthetic; RPCs execute real PostgreSQL/RLS. Real Supabase Auth/PostgREST, isolated hosted migration, two-device persistence, VoiceOver and iPhone remain unverified. No hosted data/schema/auth/protection changes are made by this candidate. Independent QA must review author-written changes; do not self-approve.

Remaining companion scope: optional milestone promises, consent-based curses, explicit sharing policy for manual profiles, broader correction/edit UX, and independent live-auth acceptance. No automated weekly inference or notification is created.
