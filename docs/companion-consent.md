# Companion consent and private quest delivery

Draft for issue115, based on PR116 eeeda20151cc76700113d76be80e76ad85412851.
No hosted migration, merge or release authorization.

## Server contract

public.companion_command(action,payload) is an authenticated SECURITY INVOKER RPC
wrapper. Its non-exposed companion_private implementation checks auth.uid() on
EVERY invocation; client-supplied actor/recipient/XP values are not trusted.
No service-role key is required by the browser.

Invitation: choose sender or recipient role, generate a high-entropy private code,
review the proposed role, request to join, then the inviter confirms the requested
account. Until that second confirmation, neither side can deliver quests. Verify
the other account ID privately before confirming; display names are not identity
proof. Invitations expire in7days, cannot self-join, and either member can revoke.
Revocation removes shared reads/actions immediately without deducting earned XP.

Sender: one free-text title, optional category/difficulty/deadline/reward promise.
A stable request UUID makes delivery retries idempotent; changing a sent retry's
contents is rejected rather than silently delivering a different offer.
All promises are voluntary, not purchases or guaranteed fulfillment.

Recipient: pending offers live in a private inbox, not automatically on the Board.
Accept or decline. An accepted offer links to an explicitly selected eligible
personal instance or an exact-title current-day overlap. Exact-title personal
quests without an instance reuse ensure_quest_instance; differently-worded overlap
requires the recipient to choose the matching task. No semantic AI match is claimed.
New accepted offers create one normal, recipient-owned one-time goal instance.
Rain checks defer without XP changes; completion uses set_quest_instance_status.

Mystery rewards are stored ONLY in a non-exposed, non-client-readable table.
Pending/declined recipient dashboard JSON has reward:null, never hidden text or
hidden DOM attributes. Accepted recipients and authors may read the promise while
membership is active. A recipient cannot forget a promise already revealed before
revocation; server revocation prevents subsequent reads.

XP: the existing xp_ledger unique instance_id remains authoritative. A BEFORE
trigger selects1 for ordinary quests,2 for accepted companion-attributed instances.
A previously completed1-XP overlap upgrades that one row to2, not1+2. Accepted
qualification survives revocation so legitimate earned credit is not deducted.
Pair→offer→instance locks, an owner/day/title advisory lock and unique attribution
prevent duplicate acceptance or credit. No streak or level formula is replaced.

## Evidence and boundaries

SQL smoke tests use3synthetic accounts and actual RPCs/RLS in isolated PostgreSQL.
They cover consent, role assignment, pre-accept secrecy in full JSON and direct
SELECT denial, overlap upgrade, retries, exactly-one completion event/ledger row,
separate actor totals, rain checks, decline, revocation and anonymous denial.
Results are pending until the exact-head CI runs; source assertions are not tests.

No live Izzy account, hosted production data, simulator or prior private documents
were opened. Relevant prior conversation/spec excerpts were retrieved, including
manual logging/separate XP, optional consensual Secret Curses and explicit shared
membership. Full source documents were not reviewed. Current exclusive contract
controls this slice. Manual companion activity history/weekly profile and opt-in
Secret Curses remain follow-up work, not implied implementation.

## Browser path and honest scope

The new /companion page uses the real authenticated RPC (no application mock
adapter). It includes onboarding/request/confirmation, creation, incoming/sent
status, explicit accept/reveal, overlap selection, rain check, real-life completion,
refresh and revocation. Private drafts and stale responses are cleared/discarded
on account changes. No global Home/navigation ownership files are edited.

CI's browser gateway exists ONLY under tests/browser. Its authentication identities
are synthetic and unsigned; it is not Supabase Auth validation. Each browser RPC
is passed to the actual migration running as the authenticated PostgreSQL role
with that fixture's auth.uid(), never to a canned RPC response. Browser evidence
therefore covers UI→actual PostgreSQL/RLS with fixture authentication, not live
Supabase Auth/PostgREST, hosted two-account onboarding or iPhone acceptance.
The gateway binds localhost, refuses nonlocal PGHOST, accepts only known fixture
tokens, and is never imported by application code or deployed as an app route.

A second SQL test observes a real lock wait between overlapping completion
transactions and requires one ledger row,2 XP and one completion event. The
browser journey creates a pair, sends HTML-like text and a hidden promise, checks
ALL pre-accept response bodies for secrecy, accepts/reveals, attempts repeat
completion, reloads and checks separate actor totals/shared status. Four widths
and200% root text produce screenshots. These tests are pending until final-head CI.

Hosted boundary: a restore-test project exists in account metadata, with no listed
development branches. No schema/data or isolation was asserted from that name;
no hosted SQL or auth account mutation was performed. An explicitly isolated,
reviewed deployment migration and independent live-auth QA remain required.
Home entry placement is an integration/UI-owner dependency; /companion includes
an explicit Back to Home link and retains the existing app navigation shell.
