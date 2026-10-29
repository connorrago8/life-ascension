# ALPHA P0 — Effective Preview-to-Supabase destination evidence (operator form)

**Status:** BLOCKED / NOT ISOLATED. **Checked:** 2026-10-27 ~10:04 UTC, read-only. **Task:** A-P0-PREVIEW-TARGET-PROOF. **First observed:** 2026-10-27 02:42 UTC. **Owner:** Alpha (evidence); authorized Vercel/Supabase dashboard operator **UNASSIGNED**. **Approval:** CEO review of this form is not authorization to modify any environment.

## Exact subject of proof

| Field | Observed evidence |
| --- | --- |
| Vercel team | `team_JszaPbNUcmlkQz7bwvskvapY` |
| Vercel project | `life-ascension` / `prj_drhDCaDXEbDTAzDHEr4orf8xyVBf` |
| GitHub repository | `connorrago8/life-ascension` |
| Alpha branch | `alpha/xp-receipt-contract` (draft PR #31; NOT merged) |
| Branch commit at inspection | `da75753f53558ead7488b64f96bb9b62f2af8046` |
| Matching Vercel deployment | `dpl_Ag5xL5Fk3EzdHqpkZe1vYLiGM641`; Vercel branch/SHA metadata match; state `READY`; `target=null` in list response |
| Deployment inspector | https://vercel.com/r6r6bsfbkm-9616/life-ascension/Ag5xL5Fk3EzdHqpkZe1vYLiGM641 |
| Production Supabase project | `life-ascension` / `ugcvhmrriazbbymjxvch` (ACTIVE_HEALTHY) |
| Available restore-test project | `life-ascension-restore-test` / `njqwwimzrsunheehnnnt` (ACTIVE_HEALTHY) |
| Required safe destination for future authenticated Preview testing | Dedicated nonproduction Supabase project, explicitly approved and independently proven; restore-test is a **candidate**, not assumed safe or authorized |
| Operator identity and confirmation timestamp | **UNASSIGNED / UNKNOWN** |

## Current nonsecret Vercel variable scope evidence

Read-only `filter_project_envs(decrypt=false)` for the project lists the following two variable names. Their **default** entries each target **both Production and Preview**:

- `NEXT_PUBLIC_SUPABASE_URL` — default entry ID `Wnxv4BpgNY3OI9gC`; target `[production, preview]`; branch unset.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — default entry ID `2IcB7SSEqkSGgcrA`; target `[production, preview]`; branch unset.

There are branch-specific Preview entries for **both** variable names on exactly three other branches: `feature/reward-feedback-phase1`, `feature/crypt-sentinel-loot-preview`, and `feature/partial-progress-phase1`. A branch-filtered read for `alpha/xp-receipt-contract` returned **zero entries**. This establishes **no Alpha branch-specific override was found**, not that the default values are safe. Decryption was NOT requested; no variable values or secrets were inspected or published.

**Important distinction:** a `READY` deployment and an existing restore-test Supabase project do **not** prove where Alpha's Preview client or server would connect. The default URL/key entries may be production-targeted, and their values remain unverified. The effective Preview destination is **UNKNOWN**. No authenticated Preview database writes are allowed.

## No-write evidence procedure for the authorized operator (not executed)

1. Open the exact Vercel deployment inspector above. Record deployment ID, source Git branch, full commit SHA, environment/target, and whether this is the same deployment being proposed for QA. If target cannot be established from `target=null`, mark **UNKNOWN**; do not infer Preview from the hostname or `READY`.
2. In Vercel project settings, inspect **scope and precedence only** for `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for this exact branch/deployment. Record default `production+preview` entries and any exact-branch Preview overrides; do **not** paste, reveal, decrypt into logs, or transmit either key.
3. In an authorized dashboard session, privately compare the effective **URL's Supabase hostname project ref** with the intended nonproduction project's ref. Record only `expected_ref`, `observed_ref` (project refs are nonsecret), `MATCH / MISMATCH / UNKNOWN`, and evidence timestamp. If the effective URL cannot be inspected without revealing credentials to an agent, the operator may make the comparison privately and report only the refs and result. Do not claim the encrypted metadata alone proves the ref.
4. Separately confirm that the **effective anon key belongs to the same intended nonproduction project** using the respective provider dashboards, without posting the key, hashes derived from secrets, or credentials. Record `KEY_PROJECT_MATCH: YES / NO / UNKNOWN`. If there is no safe, authorized way to compare, mark **UNKNOWN**.
5. Cross-check production `ugcvhmrriazbbymjxvch` is **not** the effective Preview destination. A match to production is an immediate **STOP**. A test-project URL alone with an unknown key is still **STOP**.
6. Attach only redacted screenshots or text of deployment ID, branch/SHA, variable **names/scopes**, project refs, match verdicts, operator identity, and timestamp. Avoid screenshots of variable values, headers, access tokens, browser storage, API keys, or private account information.
7. Have Alpha/CEO independently re-read Vercel nonsecret scopes and deployment metadata after any **separately authorized** configuration correction. Mark `VERIFIED ISOLATED` only if branch/deployment, URL ref, anon-key project, and production non-match are all proven. Even then, separate Founder approval is required for authenticated Preview DB-writing tests, hosted migrations, env edits, merges, or deployment actions.

### Fillable operator attestation (currently intentionally incomplete)

- Authorized operator: **UNASSIGNED**
- Check time (UTC): **UNKNOWN**
- Deployment environment target: **UNKNOWN** (listing reports `target=null`)
- Deployment SHA matches draft PR #31 head: **YES at 2026-10-27 ~10:04 UTC**
- Effective URL project ref: **UNKNOWN**
- Expected nonproduction project ref: **njqwwimzrsunheehnnnt**, subject to explicit selection/authorization
- Effective URL ref matches expected: **UNKNOWN**
- Effective anon key belongs to same nonproduction project: **UNKNOWN**
- Production ref `ugcvhmrriazbbymjxvch` excluded: **NOT PROVEN**
- Exact-branch Preview override pair: **NOT FOUND** in read-only branch filter
- Independent Alpha/CEO confirmation: **PENDING**
- Decision: **BLOCKED — DO NOT RUN AUTHENTICATED PREVIEW DATABASE-WRITING TESTS**

## Safe alternative while operator is unassigned

Use the existing isolated GitHub Actions PostgreSQL smoke tests and local, unauthenticated browser/static UI tests. A further **read-only** deployment artifact/source inspection may determine which public Supabase hostname was compiled into a static bundle, but this is only supplementary evidence: it cannot establish server runtime secret precedence, key/project match, or authorize writes. Never fetch or expose keys to perform this check. A different safe route is a dashboard-only, nonsecret scope attestation by an authorized operator; do not silently change the Vercel settings.

## Decision gate / review request

CEO: review the target-specific identifiers, the missing key/project proof, the operator dependency, and the stop conditions. Recommend keeping P0 marked BLOCKED, asking the authorized dashboard operator for a **no-write, redacted ref/key-match attestation**, and continuing isolated CI while awaiting it. This is a documentation-only draft change, not an environment correction.
