# QA backup and isolated restore runbook (Release 0.3)

## Purpose and safety boundary

This runbook defines how to prove that a backup of the existing QA Supabase project is recoverable without overwriting the source QA project or touching Production.

**Do not use the Supabase project-restore operation on the source QA project as a test.** It causes downtime and rewinds that project's data. Do not run commands against Production. Do not place access tokens, database passwords, connection strings, dumps, or player data in GitHub artifacts or issue comments.

Target QA project reference: `njqwwimzrsunheehnnnt` (`life-ascension-restore-test`). Confirm this against the current project inventory before starting. A project reference alone does not prove that the application Preview routes to it.

## Supported recovery options

Supabase documents daily Dashboard backups for eligible plans and logical exports via the Supabase CLI. Availability depends on the project's plan and configuration. Inspect **Database → Backups** in the Supabase Dashboard or the Supabase Management API backup-list endpoint using an authorized operator credential. Do not print or share the credential.

For a portable logical backup, use a PostgreSQL client compatible with the hosted server and a QA-only connection string obtained through the approved secret manager. Store the dump in an encrypted, access-controlled location outside the repository. Do not commit it or upload it to public CI artifacts.

## Procedure

1. **Confirm scope.** Two people verify the QA project reference and the source connection target. Explicitly confirm it is not Production.
2. **Inventory recovery options.** Record backup timestamp/type, project ref, database major version, extensions, and whether Storage object contents require a separate backup. Database backups contain Storage metadata, not the Storage API objects themselves.
3. **Create the backup.** Prefer an available provider-managed backup for the QA project or create a logical dump with the approved PostgreSQL client. Capture the command/tool version and exit status in the internal run record, never the connection string or dump contents.
4. **Restore only to a disposable local PostgreSQL instance.** Use a clean local container/instance isolated from hosted networks. Restore the dump there; do not point restore commands at either hosted project. If the dump includes Supabase-managed schemas or extensions that cannot be restored locally, document the exact limitation and use a separately authorized isolated restore target rather than improvising on the source project.
5. **Validate integrity.** Compare migration ledger entries, table/row counts for required player-progress tables, constraints, RLS enablement and policies, receipt-v2 objects, earned-equipment tables/RPCs, and representative non-sensitive fixture invariants. Do not export actual player rows into logs.
6. **Prove recovery.** Record the backup identifier/checksum, restore command and exit status, validation results, and limitations. A backup listing without a completed restore is not a pass.
7. **Clean up.** Destroy the disposable local instance and securely remove temporary dumps according to the approved retention policy.
8. **Report.** Update Issue #42 and Release Issue #46 with evidence only—never credentials, raw connection strings, or player data.

## Pass criteria

- Source target confirmed as QA, not Production.
- Backup exists and is readable.
- Restore completes into an isolated target without connecting to the source for writes.
- Schema, migration ledger, RLS/policies, receipt-v2 and earned-armor objects validate.
- Evidence identifies exact tool versions, timestamps, exit statuses and any unsupported objects.
- No hosted migration, source-DB write, environment change, or deployment was needed for this recovery test.

## Current status

This is a procedural artifact, not evidence that a backup or restore has already succeeded. As of the latest Alpha audit, recovery remains **UNVERIFIED**. Hosted migration/deployment gates remain closed until the safety checks and separate authorization requirements are satisfied.

## Official documentation

- [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase CLI `db dump`](https://supabase.com/docs/reference/cli/supabase-db-dump)
- [Supabase Management API — list database backups](https://supabase.com/docs/reference/api/v1-list-all-backups)
