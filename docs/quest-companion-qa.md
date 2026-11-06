# Quest and companion boundary QA

Test-only candidate on PR119 `b7a939af6073c878fd35fab52380e4f7a3671109`.
No application/migration implementation changes, hosted SQL, account access, merge or release approval.

## Independence boundary

PR117–119 were previously authored in this thread. These new tests are adversarial regression evidence, not independent approval of that code. A different reviewer must provide independent release acceptance. An unpublished Quest Systems implementation remains in its separate checkout and is excluded from this branch.

## Threat model / contracts

| Boundary | Expected | Evidence method |
| --- | --- | --- |
| Eligible daily day | New daily day begins05:00 America/Chicago | Published function bodies executed in isolated PostgreSQL with only now() replaced by a fixed instant in a rolled-back fixture |
| Exact once | Eligible task repeat activation yields one ledger row/event | Existing source/SQL/race suite retained; new boundary control repeats an eligible completion |
| Ownership | Other-user quest/instance and ledger writes denied; anonymous execution denied | Actual authenticated SQL role and per-request auth.uid() fixture |
| Mystery secrecy | Pending/declined promise never appears in recipient JSON or UI | Real keyboard send/decline at four widths; capture all recipient dashboard payloads |
| Revocation | Subsequent shared data/reward reads stop, earned account XP stays | Keyboard revocation and recipient refresh against real PostgreSQL/RLS |
| Keyboard access | Tab/typing/Space/Enter reach usable controls; following Tab retains local reading position | Actual sandboxed Chromium; no programmatic focus jumps or synthetic click handlers |
| Accounting dates | Impossible dates cannot become credit keys | Pure helper negative tests; not a demonstrated database XP exploit |

## Reproductions

1. **05:00 contract:** fixture time Nov6 2026 00:30 CST (06:30Z), so logical quest day Nov5. Complete Nov5 once, then attempt Nov6. Required: reject new-day credit until05:00. The fixture only substitutes the clock in the published create/ensure/status functions inside BEGIN; rollback restores original definitions. It does not patch authorization or eligibility logic. This is deterministic SQL-fixture evidence, not a hosted midnight observation.
2. **Impossible dates:** call awardCredits with completed personal dates2026-02-30,2026-02-29,2026-13-01. Required: reject each. Valid2028-02-29 remains usable. Current helper guard accepts digit-shaped invalid dates; the server ledger does not currently rely on this helper for authorization.
3. **Keyboard/privacy:** after inherited two-account journey, tab/type a new mystery offer, send with Enter, refresh as recipient, verify absence of the secret, decline with Enter, record actual focus and next-Tab position. Repeat320/375/390/430. Revoke as sender, refresh recipient, verify reward removal and retained4 account XP. This test may establish a new focus failure or pass; inspect actual results before calling it a defect.

The new QA workflow keeps baseline72-unit/build evidence separate from negative-date and SQL/browser contract evidence. Failing contracts remain failing; no continue-on-error release pass, expected-failure suppression or production-code fixes.

## Limits and remaining verification

Browser authentication is synthetic; actual PostgreSQL/RLS handles calls. Real Supabase Auth/PostgREST, two-device identity switching, hosted migration/protection/access, VoiceOver and iPhone are unverified. Existing Preview status does not prove account-backed deployment readiness. Streak/grace,5-of25 generation and weekly lifecycle remain incomplete implementation scope; optional curses/milestones have no implemented path to certify. Missing flows are not reported as passing security tests.
