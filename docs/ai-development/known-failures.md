# Known failures

Each entry is something that actually happened, or a repo fact you can open. ChatGPT's private tool traces are not here. Where a transcript of ChatGPT's run does not exist in the repo, the entry says so and gives a diagnostic.

## 1. Preview build blocked on a feature branch

- Operation: Vercel preview build of `cursor/companion-finish-8c36` at `03bc50960bd885594ddf27f96edba226cd025f5e`.
- Tool: Vercel build, `npm run build` → `scripts/verify-deployment-env.mjs`.
- Error: deployment `dpl_6arVqdVfwUjLuDa4yyhb8nrVeags` state ERROR. Log text: `Blocked preview build: not the protected QA branch`.
- Cause: `PROTECTED_QA_BRANCHES` does not include feature branches. The guard is intentional.
- Avoidable: yes, if you expected a feature-branch preview. The failure is not avoidable if you need the guard.
- Recovery: run `npm run lint` and `npm test` locally. Use the beta deployment id only for commits that are on an allowlisted branch. Do not add the branch to the set.
- Prevention: treat a feature-branch Vercel ERROR with that sentence as success of the guard. Do not retry the deployment hoping it will pass.

The same allowlist is repeated in `scripts/verify-qa-browser-bundle-after-build.mjs` (`QA browser bundle scan blocked: not the protected QA branch`).

## 2. GitHub Actions does not run on pull requests into this beta

- Operation: open a draft PR whose base is `beta/crypt-intro-exit-accessibility-20261029`.
- Tool: `.github/workflows/build.yml`.
- Evidence: `pull_request.branches` is `main` and `beta/quest-ui-clean-review` only. Push to the crypt beta branch does run. [Run 42935014786](https://github.com/connorrago8/life-ascension/actions/runs/42935014786) is the push of merge `eb7f143`, not a pull_request event.
- Recovery: local `npm test`. Do not edit the workflow to add the beta branch to `pull_request`.
- Prevention: report "CI will not run until this merges to beta" instead of polling checks.

## 3. `npx tsc` installed the wrong compiler

- Operation: typecheck when `node_modules/.bin/tsc` was absent after a branch switch, in this cloud VM.
- Tool: `npx tsc`.
- Error: npm fetched package `tsc@2.0.4` ("not the tsc you are looking for").
- Cause: `npx` resolves a package named `tsc`, which is not TypeScript.
- Recovery: `npm ci`, then `npm run lint` (`tsc --noEmit` from the project's TypeScript).
- Prevention: never typecheck with `npx tsc`. The CI workflow uses `npx tsc` after `npm install`, which is safe only because `typescript` is already installed. Locally, prefer `npm run lint`.

## 4. Unit tests fail with `ERR_MODULE_NOT_FOUND` before install

- Operation: `npm test` immediately after a branch switch on a VM whose `node_modules` was incomplete.
- Error: missing `typescript` / `react` modules. After `npm ci`, the same suite passed.
- Recovery: `npm ci` once, then rerun the one test file that failed. Do not start a new audit.
- Prevention: if `node_modules/.bin/tsc` is missing, install before any test claim.

## 5. Vercel CLI `inspect` hung

- Operation: `vercel inspect` on a deployment, this cloud VM.
- Tool: Vercel CLI.
- Symptom: the process was still waiting after several minutes and was killed. No conclusion was taken from it.
- Recovery: Vercel API `get_deployment` / deployment events. Do not start a second CLI inspect in parallel.
- Prevention: one lookup, by deployment id, then stop.

## 6. A background `npm test` was stale

- Operation: a full test run was backgrounded, then more files were edited, then the old run exited 0.
- Cause: the exit code belonged to the tree at start time.
- Recovery: rerun after the last edit. The companion handoff suite that counts is the one run after the last save.
- Prevention: do not cite a test run that started before the diff you are reporting.

## 7. Issue #60 is a coordination log, not a defect ticket

- Evidence: [issue #60](https://github.com/connorrago8/life-ascension/issues/60) "Overnight Work Log" is open. Its body records immutable SHAs, CI run ids, deployment ids, and QA rejections from 2026-10-29/30. It tells agents not to re-audit a moving branch head and not to treat a newer green run as acceptance of an older rejected SHA (`4761ec8` failed tests; later greens do not erase that).
- Use: when a check fails, bind the failure to the full SHA. Do not rerun the whole overnight log.

## 8. ChatGPT's own tool errors — evidence missing

The repo does not contain ChatGPT's runtime logs. What is in git:

- [PR #66](https://github.com/connorrago8/life-ascension/pull/66) is one documentation commit (60 additions, 1 file) whose body says the next step is to reconcile heads and implement persistence later. It is still draft.
- [PR #62](https://github.com/connorrago8/life-ascension/pull/62) is one file, 42 additions, still draft.
- [PRs #61–#67](https://github.com/connorrago8/life-ascension/pull/61) remain open from 2026-10-31 under `chatgpt/*`.

That shows planning and isolated slices that did not land on beta. It does not show the text of a GitHub API exception inside ChatGPT. Diagnostic if a tool fails now:

1. Copy the tool name, the exact error string, and the SHA you were on.
2. Classify: auth, missing binary, guard (entry 1 or 2), rate limit, or product bug.
3. If it is entry 1 or 2, stop retrying.
4. If it is auth, ask Connor once, with the exact click. Do not guess a token.
5. Write one line into the PR body. Do not open a second investigation PR.

## 9. Share links

No share token is stored here, and this handoff did not create one. `docs/apple-health-shortcut.md` documents that Preview protection returns Vercel's 401 without a login or share cookie, and that a share cookie still does not make a personal API key work on Preview (`503`). SSO protection on the project is on for all except custom domains. Diagnostic: compare the deployment id in the Vercel URL with the SHA you tested. If they differ, the old share link is the wrong artifact. Ask Connor before minting a new one.
