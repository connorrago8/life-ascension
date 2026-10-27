# Preview isolation — read-only evidence and operator handoff

Status: **BLOCKED on independent proof of effective Preview destination**. No signed-in Preview writes are permitted. This document contains no credentials.

## Observed configuration (2026-10-27, Vercel environment metadata, values not decrypted)

Project: `life-ascension` (`prj_drhDCaDXEbDTAzDHEr4orf8xyVBf`).

- The default `NEXT_PUBLIC_SUPABASE_URL` targets **production and preview** (no branch override).
- The default `NEXT_PUBLIC_SUPABASE_ANON_KEY` also targets **production and preview** (no branch override).
- Separate Preview-only URL/key pairs are present for the branches `feature/reward-feedback-phase1`, `feature/crypt-sentinel-loot-preview`, and `feature/partial-progress-phase1`. Their presence alone does **not** prove their effective values.
- `SUPABASE_SERVICE_ROLE_KEY` is scoped to Production only.
- New branches such as `alpha/xp-receipt-contract` and `beta/quest-mobile-layout-cycle1` have no recorded branch-specific URL/key overrides and therefore require particular attention.

Known target refs (do **not** share keys): Production `ugcvhmrriazbbymjxvch`; isolated restore-test `njqwwimzrsunheehnnnt`.

## Approved operator work (Founder authorized Preview-only isolation)

1. Record current variable names, targets, and branch scopes without disclosing secret values.
2. Configure a **Preview-only default** `NEXT_PUBLIC_SUPABASE_URL` and matching anon/publishable key for the isolated restore-test project `njqwwimzrsunheehnnnt`. Obtain keys securely from the owning Supabase dashboard. Never paste them into chat, GitHub, or Google Docs.
3. Ensure Production receives **only** its unchanged Production URL/key. Preserve its service-role credential and all other Production settings.
4. Check all branch overrides; remove or replace any Preview override that is not safely proven to point at restore-test. Handle overrides deliberately, rather than assuming default settings replace them.
5. After changes, verify effective values for a newly created Preview deployment on an innocuous, unauthenticated route. Confirm its public Supabase URL's project hostname contains `njqwwimzrsunheehnnnt`; do not infer isolation from target scopes alone.
6. Independently verify the **Production** deployment continues to reference `ugcvhmrriazbbymjxvch` and has not been redeployed or reconfigured unexpectedly.
7. Record the nonsecret evidence: environment entry target/branch metadata, deployment ID + commit SHA, hostname/project ref observed for Preview, Production ref observed, reviewer and timestamp.
8. Only after Alpha signs off on independent evidence may the CEO consider allowing signed-in Preview database tests.

## Acceptance / failure

**PASS:** Default Preview and all branch-specific Preview overrides resolve to restore-test; production is unchanged; independent effective-ref proof is captured for relevant Preview builds; no secrets exposed.

**FAIL:** Any Preview build resolves to production; any key/URL pair mismatches, any unexamined branch override remains, or the actual deployed bundle's project reference cannot be proven. Keep authenticated Preview testing blocked.

This is an operator checklist only. It is **not** evidence that the environment changes have occurred.
