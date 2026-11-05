# Consolidated candidate evidence — November 5, 2026

Integration increment over Visual107 aeb0a9705a4cd7545100d420a9c965d74d03b16c. Only the workflow, receipt verifier, regression tests and this document change. No application, gameplay, UI, World, save, XP, auth or hosting implementation changes.

## Required execution identity

A valid receipt now requires the exact full candidate SHA **and** canonical string `runId` / `runAttempt`, matching the explicit expected execution. IDs come from GitHub runner variables; expected values come from the gate's GitHub context. Missing/numeric/noncanonical metadata is never inferred from SHA. The verifier reports execution identity but always returns `releaseAuthorized:false`.

Baseline local reproduction: the old verifier accepted four green same-SHA receipts while one said a different run and another a different attempt. This is a verified verifier gap, not proof of a forged live run or a reason to retroactively invalidate the parent107 run's inspected jobs. New unit/CLI tests reject cross-run, mixed-attempt, missing and malformed identity even with green actual jobs.

## Parallel jobs, complete evidence

| Family | Required scope |
|---|---|
| source-build | TypeScript, isolated guarded synthetic QA build and bundle scan |
| unit-tests | Full unit/source suite, including any failing regressions |
| browser-smoke | All19 current sandboxed localhost suite receipts |
| boss-boundary | All3 boss suite receipts |

All four execute independently, check out explicit PR head, and attempt a receipt upload. The final gate requires successful actual job results plus successful receipts and every manifest-listed suite. Missing, duplicate, failed, skipped, cancelled, wrong-file, wrong-head or nonclean child exit remains blocking. An upload/later-job failure overrides an earlier successful receipt. Browser children continue after a failure so later results remain available; no assertion is skipped or optional.

## Artifacts and reruns

Receipt artifacts are `receipt-<family>-attempt-${{ github.run_attempt }}`; screenshot artifacts also carry the attempt suffix. GitHub already scopes artifacts to the workflow run. No overwrite/delete is added, preserving earlier evidence and avoiding reuse of a prior attempt's artifact name. The final download pattern selects only receipt artifacts for the current attempt, and receipt JSON independently checks the run and attempt.

**Use “Re-run all jobs” for a complete candidate verification.** Rerunning only failed jobs or the final gate reuses some prior successful jobs but does not regenerate all current-attempt receipts. Such a partial rerun deliberately cannot certify this gate. Missing old metadata or missing current-attempt families stays red; no fallback to older artifacts. Older evidence remains readable under its original IDs and attempt names. Real rerun execution must be reported separately from regression simulations; no scheduled run or enabled workflow is counted as execution.

CLI requires `EXPECTED_RUN_ID`, `EXPECTED_RUN_ATTEMPT`, `RELEASE_JOB_RESULTS` plus full SHA / receipt-directory arguments. These are nonsecret execution metadata and actual job outcomes, not deployment credentials. Direct callers must provide the fourth execution argument; there is no SHA-only compatibility path.

## Current scope and ownership

Latest inspected parent107 run42090784848 passed881units, build and22browser suites. It includes Gameplay104 dirty-save retry, QA105 native conflicts, World106 hydration-ready mode links and Visual107 recap presentation. These are inherited owner changes; integration does not rewrite them or self-approve them. The older intermittent native-lock recovery timeout remains unexplained despite later passes.

Integration owns this workflow/verifier/docs. Gameplay owns Brain Rot engine/checkpoint behavior; World owns Hub/Town/Lantern navigation/progression; Visual owns presentation; QA owns independent rejection coverage. The Issue60 checkpoint contains current full heads, exact run/jobs, outcomes, deployment identity and next verification. No assignment is made by this document.

Existing permissions stay `contents:read`, checkout credentials are not persisted, backend values stay blank in browser/unit jobs, and build fixtures keep invalid credentials plus protected bundle checks. No hosted configuration, deployment protection, production data, native simulator, merge or manual deployment. Passing localhost Chromium/CI is not hosted Preview, iPhone Safari/VoiceOver, natural full-run or Founder/independent acceptance.

References: https://docs.github.com/en/actions/reference/workflows-and-actions/contexts and https://github.com/actions/upload-artifact (run/attempt context and immutable artifact naming). No provider behavior is inferred from CI passing; inspect actual artifacts on any real rerun.
