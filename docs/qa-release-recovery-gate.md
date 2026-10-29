# LIFE ASCENSION 0.3 — QA Recovery and Migration Gate

**Status:** preparation checklist only; not authorization to deploy, write hosted data, run migrations, merge, or change Production.  
**Owner:** Alpha (database/recovery evidence); CEO-designated platform operator (deployment/recovery-point evidence); Founder (explicit authorization for any hosted migration).  
**Protected QA project:** `njqwwimzrsunheehnnnt`. Verify the project identity independently immediately before any operation. Never infer target identity from a branch name alone.

## Stop conditions

Stop without executing writes if any condition is true:

- The approved candidate SHA is not the exact SHA reviewed by QA and Architect.
- The deployment for that exact SHA is not **READY**.
- Browser, server, or privileged connection target is ambiguous, mismatched, or not demonstrably QA-only.
- A privileged service-role credential is present in Preview or exposed to browser code.
- A current, non-empty QA recovery point cannot be identified, or its retention and restore procedure are unknown.
- Migration checksums/order, expected preconditions, or post-migration acceptance queries are uncertain.
- The operator cannot distinguish the QA project from Production using independent project identifiers.
- A gate requires Founder approval that has not been explicitly granted.

## Before the single coordinated QA deployment

- [ ] Architect records the exact candidate SHA and approved QA destination.
- [ ] Alpha reviews the effective branch-scoped Preview configuration without exposing secret values.
- [ ] CI is green for the exact candidate SHA; record links and test counts.
- [ ] Platform operator confirms deployment quota/policy permits the single coordinated deployment.
- [ ] Do not trigger repeated deployment attempts to probe configuration.

## Recovery point evidence — required before risky hosted migration

The platform operator records in the release issue (without credentials or sensitive user data):

- [ ] QA project identifier independently confirmed as `njqwwimzrsunheehnnnt`.
- [ ] Recovery point / backup identifier and creation timestamp.
- [ ] Confirmation that the recovery point contains the existing non-empty QA data and is retained for the required recovery window.
- [ ] Documented restore method and responsible operator.
- [ ] Restore feasibility evidence appropriate to the platform (for example, a verified restore test or an explicit platform limitation and approved alternative).
- [ ] Clear statement that this is QA recovery evidence, not a Production backup.

**A backup label or a successful source-level test is not proof of recoverability.** If restore feasibility is unknown, stop before the migration.

## Migration review and execution gate

For each proposed migration, record:

- [ ] Exact migration filename, checksum, and intended order.
- [ ] Read-only preflight result against the confirmed QA project.
- [ ] Objects changed, expected existing schema, constraints, indexes, RLS policies, grants, and RPC signatures.
- [ ] Idempotency/re-run behavior and lock/availability implications.
- [ ] Data backfill scope and expected row counts, without copying personal data into logs.
- [ ] Reviewed post-migration acceptance queries and expected results.
- [ ] Forward-repair strategy for partial failure; do not assume destructive rollback is safe.
- [ ] Explicit Founder authorization scoped to the named QA project and named migrations.

Execute only the reviewed, explicitly authorized QA migrations. Never run these steps against Production. A migration passing on disposable PostgreSQL does not prove compatibility with the hosted QA schema.

## Post-migration acceptance

- [ ] Read-only schema checks pass for the exact expected receipt-v2 and earned-armor objects.
- [ ] RLS/ownership checks prove one user cannot read or mutate another user's quest, progress, XP, or equipment.
- [ ] Repeated completion requests award exactly one +1 XP receipt.
- [ ] Partial progress survives authenticated reload and cannot award XP before valid completion.
- [ ] Equipment ownership/equip checks persist and reject unowned items.
- [ ] Forgotten Crypt preview and trusted reward paths remain distinct; previews do not mint permanent rewards.
- [ ] Exact-head CI and relevant regression tests remain green.
- [ ] Runtime browser/server/privileged routing evidence is bound to the deployed SHA.
- [ ] Authenticated iPhone Safari acceptance is recorded separately; do not infer it from CI or desktop browser tests.

## Failure handling

1. Stop the release sequence; do not retry blindly.
2. Preserve logs and the exact SHA, migration, failed check, and timestamp. Do not log credentials or personal data.
3. Determine whether the failure is source, configuration, schema, permission, data, or deployment-related.
4. Prefer a reviewed forward repair when safe. Do not drop tables, reverse a backfill, reset QA, or restore over live data without a separately reviewed recovery plan and explicit authorization.
5. Notify Architect and the Founder with the evidence, blast radius, recovery options, and the exact decision needed.
6. Resume only when the failed gate has new evidence and the responsible owner confirms readiness.

## Release evidence record

- Candidate SHA:
- QA deployment ID / state:
- Browser bundle routing evidence:
- Server and privileged routing evidence:
- Recovery point ID / timestamp / retention:
- Migration filenames + checksums:
- Post-migration acceptance result:
- Exact-head CI:
- Authenticated iPhone Safari result:
- Remaining risks / owner:
- Founder authorization reference:

**Boundary:** this document is a procedural safety gate, not a claim that a backup exists, that a restore has been tested, that QA is isolated at runtime, or that any migration/deployment has occurred.
