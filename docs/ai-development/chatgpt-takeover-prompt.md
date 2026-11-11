# CHATGPT — TAKE OVER LIFE ASCENSION DEVELOPMENT NOW

You are the developer for `connorrago8/life-ascension`. Connor is out of the other agent's usage. You will ship a draft pull request in this session. An explanation without a diff is a failed session.

## What was learned

The other agent was faster because it had a checkout, a shell, git, and a test runner, and because it batched one behavior through implement → test → commit → draft PR. That is not a special model privilege. If you only have the GitHub API, say so immediately and do not claim tests passed. The realistic fix is a sandbox: a Cursor cloud agent at cursor.com, or a Codex cloud task that clones this repo. A GitHub-API-only workflow can open PRs and cannot compile or run `npm test`.

ChatGPT-named work that stalled in public: draft [PR #66](https://github.com/connorrago8/life-ascension/pull/66) is a roadmap file (+60) whose body defers implementation. [PRs #61–#67](https://github.com/connorrago8/life-ascension/pull/61) are still open. Do not add another roadmap.

## Engine

1. Implement in this session if the tools exist.
2. Do not ask again for a draft branch, a draft PR into beta, or a unit test. Do ask before production, `main`, a secret, a share link, a workflow edit, or an RLS change.
3. One player-visible behavior or one closed defect per PR.
4. Inspect the files named below once. Do not re-audit the repository after a type error.
5. If a command fails twice for the same reason, change approach. Do not retry a Vercel build that printed `Blocked preview build: not the protected QA branch`.
6. Do not delete working screens. Companions have no Play button. Wear stays explicit. Real-life quests are the only permanent combat power.
7. Report the full SHA and the test command output.
8. After this task's PR exists, stop unless the tools are healthy and the next task is still inside this prompt. The next task is not "start floors 2–3."
9. The PR body is the checkpoint.
10. A blocker is one paragraph: command, error, SHA, and the single human action. Missing `node_modules` is not a blocker.

## Repository state (re-fetch before you branch)

- Default `main`: `ddd9918ffe3cc51e825a1dd5aaf28cf1c1cf3ed3`. Do not touch.
- Beta `beta/crypt-intro-exit-accessibility-20261029`: `eb7f143dedc6ca9ce24b5a1f9f55ef06b1472607`. This is the base. Push CI for that SHA: GitHub Actions run `42935014786`, success. Vercel preview `dpl_BkFcnrsHw6nWTUHMZhnDC7oSdMS9` is READY for that SHA only.
- Do not commit on `cursor/home-hub-v1-8c36` (draft PR #127, `56a4e3a30a864b9ee81993faf7183ddf3cc66234`) or `cursor/companion-finish-8c36` (draft PR #128, `03bc50960bd885594ddf27f96edba226cd025f5e`).
- Companion 2.0 merged as PR #125, merge `09c334a015535c6a816a38d181a8e5ee5332d7d8`.
- Production Supabase `ugcvhmrriazbbymjxvch` is forbidden. TEST is `njqwwimzrsunheehnnnt`. Migration `202611110001_companion_finish` is already applied on TEST and lives only on PR #128. Do not apply it again. Do not apply anything to production.
- Vercel project `prj_drhDCaDXEbDTAzDHEr4orf8xyVBf`, team `team_JszaPbNUcmlkQz7bwvskvapY`. Feature-branch previews are supposed to fail. Deployment `dpl_6arVqdVfwUjLuDa4yyhb8nrVeags` failed with `Blocked preview build: not the protected QA branch`. Leave `PROTECTED_QA_BRANCHES` alone.
- Pull requests into this beta branch do not run `.github/workflows/build.yml`. Absence of that check is not a failure.
- Do not mint a share link. Do not print secrets. Variable names only, if you must mention them: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `VERCEL_ENV`, `VERCEL_GIT_COMMIT_REF`, `SUPABASE_PUBLIC_KEY_SHA256`.

Read `docs/ai-development/README.md` if this branch is in your checkout. If it is not merged yet, this prompt is sufficient for the first task.

## Commands

```bash
git fetch origin beta/crypt-intro-exit-accessibility-20261029
git checkout -B cursor/companion-quests-list-8c36 origin/beta/crypt-intro-exit-accessibility-20261029
npm ci
npm run lint
npm test
```

`npm run lint` is `tsc --noEmit`. Do not run `npx tsc` before install; npm will fetch an unrelated package named `tsc`. `npm test` is `node --test tests/*.test.mjs`. SQL files in `tests/sql/` are not part of that command.

## First task

On Companion Quests, list every non-declined quest she sent, and show a failed nudge instead of swallowing it.

Beta file `app/(app)/companion/quests/page.tsx` contains `mine.slice(0, 6)` and a nudge button that does `.then(() => reload())` without reading `error`. `CompanionHome.tsx` already surfaces `error.message`. Match that behavior on the quests page. Add or extend a unit test so the cap cannot return unnoticed.

Do not change role detection, XP, RLS, workflows, the Crypt XP cap, or PR #128's branch. Do not add a migration.

Done when:

- A draft PR into `beta/crypt-intro-exit-accessibility-20261029` exists.
- `git rev-parse HEAD` is in the report, and `git status` is clean.
- `npm run lint` and `npm test` exited 0 on that commit. Include the pass count.
- The PR says you did not run a two-account browser test, and you did not change production.

## If something breaks

- `ERR_MODULE_NOT_FOUND`: `npm ci`, rerun the same test file.
- TypeScript: fix the cited line, rerun `npm run lint`.
- `Blocked preview build`: stop. The guard is correct. Your evidence is the local suite.
- No GitHub Actions on the PR: expected. Do not edit the workflow.
- You only have the GitHub API: stop and say the sandbox is missing. Do not invent test results.

## After the PR

Report the URL, the full SHA, the test counts, and any risk you left in place. Known risks you must not pretend to have fixed: an `companion_state` error is classified as adventurer (`components/useCompanionRole.ts`); overlapping role requests have no generation counter; drafts are lost on navigation; the off-day planner still lives on `/companion`.

Then stop.
