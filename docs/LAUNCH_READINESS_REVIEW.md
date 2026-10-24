# LIFE ASCENSION — Pre-launch review packet

**Status:** Read-only preparation; not a security approval or authorization to deploy. Prepared while Grok retests 0006 and implements 0007. No production changes or test executions in this packet.

**Baseline:** PR #1 `feature/shared-ai-quest-mcp` previously reviewed at `313f38b`; quest-edit/archive `feature/quest-edit-archive` latest documented fix `2ad2635`; approved deployment instructions in [DEPLOY.md](DEPLOY.md). Re-fetch final merged commits before sign-off; branch names and prior commits do not establish final contents.

## A. Final security audit — reviewer worksheet

Record for each row: **PASS / FAIL / NOT TESTED**, exact commit or environment, evidence (test output or code path), and reviewer/date. A previous conditional approval is **not** a final production sign-off.

| Gate | Required evidence |
| --- | --- |
| Integration integrity | Review actual final diff of PR #1, login OTP, 0006, and 0007 in merge order; no unreviewed changes or accidental migrations. 0006 retest and 0007 tests must finish before final approval. |
| Authentication | Valid Supabase JWT accepted; invalid/expired tokens rejected; OTP login, redirect allowlist and safe-next protections verified; no open redirect or unauthenticated write. |
| API keys | Keys hashed at rest, scoped `quests:read`/`quests:write`, revoked keys rejected on `/api/whoami` and `/api/mcp` with 401 and Bearer challenge, no plaintext secrets in logs or browser bundles. |
| Two-user isolation | Repeat A/B tests for API-key and JWT paths: no cross-owner quest list, progress, completion, XP, archive/edit, or key management. Service-role-backed reads explicitly filter owner. |
| Privileged RPCs | Inspect every `SECURITY DEFINER` function: fixed `search_path`, explicit grants/revokes, authenticated owner derived from verified credentials, no caller-controlled `p_user_id`, no public EXECUTE bypass. Verify `_as_user` wrappers are service-role-only. |
| RLS and schema | RLS enabled for exposed tables; SELECT/INSERT/UPDATE policies and WITH CHECK constrain ownership; grants match intended API access; no unrestricted view or privileged function. Review SQL migrations in exact execution order. |
| XP integrity | Partial progress yields zero XP; explicit confirmation required; same quest/day cannot award XP twice across concurrent/retried requests; ledger unique constraints enforce once-only behavior; read lifetime XP from ledger. |
| Scheduling and archive | Future scheduled chores/daily dates blocked; early goals and overdue one-time chores work; archive excludes quests from AI listing, prevents new completion, and preserves idempotent historical completion; edit/reschedule cannot bypass eligibility. |
| Migration 0007 | **Pending Grok's implementation.** Review separately after pushed, including date-boundary/ownership/duplicate behavior. **Do not add or execute 2-day-window tests in this branch.** |
| Runtime/secrets | `SUPABASE_SERVICE_ROLE_KEY` server-only in Vercel Sensitive env; no `NEXT_PUBLIC_` exposure; approved auth configuration and production domains; dependencies/lockfile reviewed. |
| Operational recovery | Verified export and isolated restore before SQL deployment; rollback plan recognizes migration 0003 is incompatible with pre-PR #1 direct INSERT. |
| Post-deploy | Live smoke test only with explicit owner opt-in, separate test key and acknowledgment of permanent +1 XP; verify revocation and archive test quests. |

**Sign-off record (leave blank until tests complete):** Final reviewed commit(s): ____; 0006 result: ____; 0007 result: ____; RLS/privilege review: ____; backup restore result: ____; reviewer decision: ____.

## B. Backup dry-run verification (no rewrite of DEPLOY.md)

Use [DEPLOY.md §1](DEPLOY.md) as the authoritative owner walkthrough. **Do not execute the following until the owner explicitly authorizes the dry run.** Never restore to production.

1. **Prerequisites check:** Confirm the Supabase project is responsive, Supabase CLI and PostgreSQL client versions are known, Docker is running for CLI dump/local workflows, and a separate Supabase test project or `supabase start` environment is ready. Check the installed CLI's `db dump --help` before use.
2. **Export plan:** With authorized access, dump schema and data separately as documented. Protect credentials and dumps; record UTC timestamps, file sizes and cryptographic checksums without revealing contents. Save encrypted copies off-site.
3. **Restore plan:** Restore **only into an isolated Supabase-compatible environment**, not a plain empty PostgreSQL database (which may lack Supabase roles, `auth` schema and extensions). Check target connection identity **before** executing `psql`; stop if target cannot be conclusively distinguished from production.
4. **Validation plan:** Require both SQL files to load with `ON_ERROR_STOP=1`, inspect non-secret errors, compare key table row counts and schema/function presence, and verify owner-scoped access in the test environment. A dump may omit managed schemas/roles, auth identities, storage objects or configuration; list gaps explicitly rather than claiming a full-project restore.
5. **Go/no-go:** Do not approve production migration if the backup is incomplete, encrypted off-site copy missing, or test restore/validation fails. Document recovery owner and a safe disposal plan for the isolated copy.

**Dry-run evidence placeholders:** Export time ____; CLI/version ____; isolated target identifier ____; dump checksums ____; schema/data restore results ____; row-count comparison ____; exclusions ____; owner approval ____.

## C. Launch acceptance scenarios (test specifications only)

Do not run these against production without explicit consent. Prefer a dedicated test account. The approved `tests/smoke.sh` remains the executable smoke test; each run creates two quests and permanently adds +1 XP. Never paste API keys in chat or logs.

| Scenario | Action | Expected result |
| --- | --- | --- |
| Authenticate | Call whoami with valid scoped key | Correct own identity and scopes, no key disclosure |
| Unauthorized | Call MCP without/with invalid key | 401 with appropriate Bearer challenge |
| Laundry create | Create one-time laundry chore due today | One owned quest, XP unchanged |
| Partial laundry | Record 50% progress and note | Progress stored, XP unchanged |
| Explicit completion | Confirm laundry finished | Status completed, exactly +1 XP |
| Duplicate submission | Repeat confirmed completion, including retry | No additional XP |
| Future chore | Schedule Thursday chore, attempt before Thursday | Completion rejected, no XP |
| Early goal | Create goal with future deadline, finish today | Eligible completion, exactly one award |
| Overdue chore | Finish an older scheduled one-time chore | Eligible completion once |
| Archived quest | Archive completed quest and list active quests | Archived quest hidden; historical XP remains; no new award |
| Edit/archive ownership | User B attempts to read/edit/archive user A quest | No access or mutation |
| Key revocation | Revoke test key; retry whoami and MCP | 401, Bearer challenge; other user's key unaffected |
| OTP redirect | Login with safe internal next and malicious redirect payload | Only safe internal redirect accepted |
| Time zone | Exercise Chicago midnight/DST boundary in isolated test environment | Date decisions use America/Chicago, not client clock |
| Multi-user XP | Two accounts complete separate quests | XP and progress remain isolated |

**Deferred on purpose:** All acceptance cases specific to migration **0007's two-day daily-habit XP window** (today/yesterday/day-before, older dates, backdated 30 days, and future-date boundaries). Add only after Grok pushes 0007 and its tests, then review those tests against the final implementation. Existing streak design review does not imply 0007 is implemented.

**Execution record (not yet run):** Environment ____; final commit ____; test account ____; each scenario result ____; failures/links ____; reviewer ____.

## D. Release boundaries

- Documentation-only branch. No code, SQL, test script, environment variable, branch integration, production database, or Vercel deployment changes.
- Grok owns PR #1 and 0007. Await 0006 retest and 0007 implementation/test results.
- Final sign-off requires inspection of final merged code, not just these checklists.
- Backup dry run and isolated restore are the first **operational** go-live prerequisite after review and before production SQL changes.
