# Quest Board 2.0 — release verification handoff

Candidate preserved: **528d77d909e0df01287f839c5a408c682f33e146**. Design Accepted. No application changes in this package.

## 1. Independent-session execution package

Included: exact candidate archive, checksum-validated Docker runner, and supplemental lock-contention proof. Both scripts pass `bash -n`. **Neither PostgreSQL test was executed here.** This runtime has no PostgreSQL/Docker and changing to an unprivileged UID returns EINVAL.

Execution owner: Development. Infrastructure/access owner: CEO. Required runner: Linux with Docker available and permission to start an expendable local container. No Supabase credentials, repository push, deployment, host ports or host-volume mounts are needed.

Run after extracting this package:

```bash
bash run-isolated-postgres.sh
```

The runner validates archive SHA-256, creates a networkless PostgreSQL 16 container, applies the exact candidate migrations, runs all seven regression suites and the preserved candidate concurrency test, then runs an additional contention check. The additional test requires different backend PIDs and observes session B actually waiting on a lock held by A via `pg_stat_activity` / `pg_blocking_pids`. It then releases A and verifies one `awarded:1`, one `already_awarded:0`, and one ledger row totaling 1 XP. Return the complete `concurrency.log`, image identity/version, command, and exit status; do not report a pass from preparation or syntax alone.

The container and temporary extraction are removed on exit. All fixture writes stay inside it. The archive is pinned to the accepted candidate; uncommitted files are excluded.

## 2. Read-only Vercel findings

Current connected-project inspection returned **zero deployments for the exact candidate SHA**. There is consequently no immutable candidate Preview URL to certify or test yet.

Environment scope metadata shows:

| Variable | Scope finding | Limit |
| --- | --- | --- |
| NEXT_PUBLIC_SUPABASE_URL / ANON_KEY | Shared defaults target both Production and Preview | Values and effective runtime destinations were not decrypted or established |
| Same pair, branch overrides | Overrides exist for four older feature branches | None shown for development/quest-board-m1; older branch evidence cannot certify this candidate |
| SUPABASE_SERVICE_ROLE_KEY | Metadata says Production only | Does not prove absence from a future immutable QA deployment |

No configuration changed and no credentials were retrieved. The evidence is **scope metadata**, not isolation proof. In particular, do not push the candidate to an automatically deployed branch and assume its database destination is safe.

## 3. Concrete hosted-test procedure — not authorized for execution

Recommended destination: a dedicated disposable Supabase QA project and Vercel QA project within the existing connected accounts. Do not silently repurpose restore-test or its existing data. If CEO instead chooses restore-test, first obtain a preserved snapshot, a fixture-only scope, and separate explicit authorization.

Before requesting test writes, the operator must fill in and attach:

- Exact QA Supabase project ref, confirmed distinct from production ugcvhmrriazbbymjxvch.
- Exact Vercel QA project/deployment ID, candidate SHA and URL.
- Effective browser and server public-client project refs and their matching credential roles, without key values.
- Effective privileged-client state: absent, or QA-only. No production service-role key, database URL, integration or fallback connection.
- Confirmation that branch/default precedence and build-time versus runtime bindings were checked for that immutable deployment.
- Backup/disposability status, supported QA auth redirect URLs and a cleanup owner.

Separate Founder authorization must enumerate project creation (if needed), QA environment settings, candidate deployment and QA migrations. After read-only isolation evidence passes, request a separate bounded integration-write authorization:

> Authorize integration tests only on deployment [ID/URL], candidate 528d77d, Supabase [QA_REF]. Allow at most two synthetic auth users, eight quest templates, twenty occurrences/ledger awards and four notes, plus their auth sessions and cleanup. No production access or changes; no use of existing real user data. Stop on any production destination or cross-account visibility.

Test login/session refresh, four recurrence labels and anchored occurrence identity, Main/Side, highlights across reload, guarded v2 completion and retries, Journal/archived history, account isolation, and logout/reopen persistence. Record response receipts and redacted database evidence by fixture owner/occurrence ID; never log auth keys or real user data.

Cleanup: record both synthetic owner IDs before testing; remove only those test users/rows after evidence capture and verify their absence. Decommission the QA resources only if that operation is explicitly included in authorization. On a failure, suspend testing and preserve the exact deployment/logs; avoid broad deletes or production rollback operations.

**Not ready for an execution approval request yet:** QA destination, immutable candidate deployment and effective server isolation evidence are still missing. No hosted writes have been performed.

## 4. iPhone Safari / VoiceOver checklist

Access prerequisite: an authorized immutable candidate URL whose isolation has passed. The production URL currently does not establish access to this candidate. Do not enter real data or production credentials into QA.

Record iPhone model, iOS/Safari version, orientation, text size, VoiceOver state, candidate SHA and deployment ID. Use synthetic fixture accounts A/B.

- First open: identify three highlighted Main/Side actions and recurrence within ten seconds. Titles remain readable; no horizontal scrolling, clipped actions or bottom-navigation obstruction.
- Detail: tap each title, confirm matching action/occurrence, instructions/metadata, readable due dates and a reachable completion button. Reading Detail must not complete anything.
- Completion: tap once; pending feedback is beside the initiating control. Repeated taps cannot award twice. Verified confirmation remains visible after the actionable card disappears.
- Recovery: use controlled connection loss on QA. Pending/uncertain UI must not invent earned XP. Reload and retry the same occurrence; verify one ledger award and durable Journal entry.
- History: verify Chicago completion date differs correctly from due date for a late quest. Reload/reopen Journal; archive retains history. On the next Chicago day, previous completions remain in Journal and newly due recurring occurrences follow their anchors.
- Account isolation: sign out of A and sign into B. No A titles, pending actions, receipts or Journal entries appear under B.
- VoiceOver: rotor headings/links/buttons find Board, Detail and Journal; quest-specific completion labels are unambiguous; reading order follows the screen; pending/error/confirmation announcements are understandable; focus is not lost after completion; all actions work without hover or swipe-only gestures.
- Native accessibility: test larger iOS text/native zoom, portrait/landscape, reduced motion, touch target usability, keyboard visibility and focus return after Detail. CSS desktop text enlargement is not proof of these checks.
- Ordinary identify → record an already completed activity → confirm flow should take about thirty seconds, excluding doing the real-world activity.

Defect report:

```text
Candidate SHA / deployment URL:
Device / iOS / Safari / VoiceOver / text size:
Fixture account alias (no credentials) / occurrence ID:
Steps:
Expected:
Observed:
Reproducibility and severity:
Screenshot or screen recording:
Redacted receipt / request ID, if available:
```

Design evaluates only contract defects. No new artwork, narrative features or Milestone 2 implementation belongs in this release-verification work.
