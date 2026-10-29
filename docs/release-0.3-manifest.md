# LIFE ASCENSION 0.3 — The Awakening Release Manifest

**Purpose:** One evidence-based release ledger. Keep implementation, tests, integration, QA, iPhone acceptance, and release as separate states. Update only with exact commit/run/deployment evidence; do not infer a pass from an agent report alone.

**Last checked:** 2026-10-29  
**Repository:** `connorrago8/life-ascension`  
**Canonical draft PR:** [#32](https://github.com/connorrago8/life-ascension/pull/32)  
**Candidate before current CI run:** `01a4093d5f3d88eb67f507fcbfba874b75c168eb` on `beta/quest-ui-clean-review` (superseded by the QA checklist commit; see current PR head before treating as release candidate)  
**Release decision:** **NOT RELEASED — keep PR draft.**

## Evidence ledger

| Gate | State | Evidence / exact reference | Remaining work |
|---|---|---|---|
| Quest Details date validation and bounded Quick-add | Implemented | Candidate `545da394`; `lib/preview/questDetailFacts.mjs`, `tests/questDetailCalendar.test.mjs`, `tests/questQuickStep.test.mjs` | Retain exact-head CI evidence below |
| Application build | CI verified | Actions run [40931100177](https://github.com/connorrago8/life-ascension/actions/runs/40931100177), candidate `545da394`, job `build` success | Re-run only when candidate changes |
| Unprivileged quest-progress browser QA | CI verified | Actions run [40931100177](https://github.com/connorrago8/life-ascension/actions/runs/40931100177), job `Quest progress browser QA (unprivileged, no backend)` success | Does not substitute for authenticated browser testing |
| Disposable PostgreSQL SQL smoke | CI verified | Actions run [40931100177](https://github.com/connorrago8/life-ascension/actions/runs/40931100177), job `SQL smoke tests (isolated Postgres)` success | Does not prove hosted QA schema or routing |
| Integration candidate | Draft / not released | PR #32 head `545da39436e72d83c575d6ee77ddd3ce568ab4aa` | Review distinct changes only; no wholesale merge of overlapping PR #50 |
| QA database identity | Read-only identity observed | Alpha reports QA project `njqwwimzrsunheehnnnt`, `life-ascension-restore-test` | Prove effective Preview/browser/server write routing to QA, not Production |
| Hosted QA schema/migration compatibility | Blocked / incomplete | Alpha reports receipt-v2 and earned-armor migrations absent from QA ledger; earned-equipment tables absent | Review migration order/compatibility using disposable SQL; no hosted migration yet |
| Recoverable QA backup + isolated restore | Unverified | Alpha reports no successful backup/restore evidence | Establish documented backup and restore proof before hosted migrations |
| Exact-candidate QA Preview deployment | Not deployed | Alpha reports no Vercel deployment for candidate `545da394`; latest READY Preview cited is older `9c0ac7aa` | After safety gates and separate authorization, deploy QA Preview only |
| Authenticated end-to-end player journey | Not verified | Acceptance script committed at `docs/qa-acceptance-0.3.md`; no executed acceptance evidence | Execute quest completion → exactly-once XP → gear ownership/equip → Crypt → refresh/sign-in persistence on one safe deployed SHA |
| Physical iPhone Safari / accessibility | Not verified | No accepted device evidence recorded | QA + Founder test exact deployed candidate |
| Production release | Not authorized / not released | PR #32 remains draft | Requires explicit Founder authorization after release gates |

## Status definitions

- **Implemented:** code exists at the referenced commit.
- **Tested:** a named automated test ran and passed against that exact commit.
- **Integrated:** included in the canonical PR #32 candidate.
- **QA verified:** authenticated application behavior was tested in the QA environment.
- **iPhone verified:** the exact candidate was exercised on a real iPhone Safari session.
- **Released:** explicitly approved and deployed to Production. None of these later states may be inferred from earlier ones.

## Safety and change control

1. Keep PR #32 draft until release gates are satisfied.
2. Do not modify Production, run hosted migrations, or deploy without separate explicit Founder authorization.
3. Never claim hosted QA isolation based solely on branch-scoped environment variables or a project ID; verify effective runtime routing and write paths.
4. Do not repeat CI on an unchanged SHA. Record exact SHA, run URL, job name, and result whenever the candidate changes.
5. Treat PR #50 and other role branches as sources for selective, non-duplicative changes only; preserve canonical coverage.
6. Dungeon replay must not grant permanent real-life quest XP.
7. Player-facing releases should bundle substantial coherent gameplay; small internal commits remain acceptable.

## Latest coordination artifacts\n\n- QA acceptance checklist: [`docs/qa-acceptance-0.3.md`](./qa-acceptance-0.3.md). It is a test plan, not evidence that acceptance passed.\n- Current manifest update commit will supersede earlier candidate SHA; use live PR #32 head and its exact-head CI run as the authority.\n\n## Next release-gate actions

1. Alpha: prove effective QA-only runtime routing; document recoverable backup and isolated restore; validate migration compatibility in disposable SQL.
2. Architect/Work: maintain one candidate SHA and exact-head CI; prepare QA Preview only after the safety gate and explicit deployment authorization.
3. QA/Beta/Charlie: prepare authenticated quest → XP → equipment → Crypt regression acceptance without duplicating existing test coverage.
4. Founder + QA: verify the exact QA deployment on iPhone Safari before release consideration.
