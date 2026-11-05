# Consolidated candidate evidence — November 5, 2026

Base: gameplay86 debb36f87d221785ed57e9faf6741003a740f75a.
This isolated integration branch changes verification glue only. It does not
repair or alter gameplay, UI, quest progression, persistence implementation,
environment, authentication or hosted protection.

## Why this gate exists

Candidate86's scoped CI is green, while QA87's later boss-boundary browser
contract fails. These are different scopes. The consolidated workflow imports
QA87's two test files byte-for-byte and runs the current source/build, the
existing browser journeys and boss-boundary checks as three required families.
The failure is not marked optional and is not converted to a passing TODO.

Verified QA87 reproduction (run41967066913, browser job127046416469):
at Level31/tick60/15s switch the raw checkpoint reports index1, selected
rune-fusion, but active goblin-jetpack. No renderer error or forbidden request.
Loss-before-credit and Rune-idle controls passed. Severity: Medium checkpoint
consistency defect. Visible progress loss and crash/reload impact are still
unproven; clean pagehide may repair the record. Gameplay owns the repair.

## Evidence contract

Every family checks out the explicit PR head and uploads a JSON receipt with
its actual git HEAD, family and outcome. The final job rejects:

- another checkout SHA, abbreviated/malformed expected SHA;
- missing, duplicate or unexpected families;
- failed, skipped or cancelled receipts;
- a later job/upload failure even if the earlier receipt says success.

The final verifier also reads actual GitHub needs results. It reports
releaseAuthorized:false even when all evidence passes: CI is not independent
QA, Founder approval or permission to merge/deploy.

The three families are source-build, browser-smoke and boss-boundary. Source
runs TypeScript, the full suite and the repository's guarded synthetic build.
Browser smoke covers the unchanged Rune/malformed-save cases, lifecycle,
Jetpack controls, Lantern failure/retry, cross-feature storage and four-width
Hub checks. Boss tests are a separate job so its failure cannot hide successful
controls or be hidden by them. All are local sandboxed Linux Chromium with
blocked external/write requests, not hosted Preview, Safari, VoiceOver,
native simulator or Founder playtest.

## Ownership and next verification

Integration owns workflow/receipt verifier/tests here. Gameplay owns the boss
snapshot ordering; QA owns its unchanged regression contract; UI and
World/Systems retain their existing source ownership. No self-approval of
earlier authored PRs is implied.

Smallest next step is a coherent next-run/next-active save in Gameplay's owned
branch, then rerun this unchanged boss test and the consolidated evidence.
Keep this integration draft red until that behavior is repaired and reviewed.
No branch-protection setting is changed; this is a CI evidence gate, not an
assertion that GitHub has made it a protected-branch required check.

Current candidate SHA, exact run/jobs, actual outcomes and deployment identity
belong in the GitHub checkpoint. Tests authored here are not claimed executed
until that evidence is retrieved.
