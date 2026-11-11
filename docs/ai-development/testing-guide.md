# Testing

Install once per machine, from the repository root, Node 22 to match CI (the Vercel project setting is 24.x; do not "fix" a green Node 22 suite by switching versions mid-task):

```bash
npm ci
```

If `npm ci` is impossible because the lockfile and tree already match, `npm install` is what CI runs. Prefer `npm ci` locally.

## Commands

| Purpose | Command |
| --- | --- |
| Typecheck | `npm run lint` |
| Unit tests | `npm test` |
| One file | `node --test tests/companionRelease1.test.mjs` |
| Production build | `npm run build` |

`npm run build` runs `scripts/verify-deployment-env.mjs` first. On a laptop without `VERCEL_ENV`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_PUBLIC_KEY_SHA256`, the build exits before `next build`. That is expected. Do not export a production URL to get past it. CI injects a synthetic preview identity for the allowlisted branch name `audit/qa-isolation-and-reliability-20261027` and a synthetic anon key. Read `.github/workflows/build.yml` before copying that block. Never put a real key in the workflow.

There is no Playwright script in `package.json`. Browser QA in CI is the job `quest-browser-qa` in `build.yml`: it installs Playwright ephemerally, starts `npm run dev` on `127.0.0.1:3128`, and only on push to the two beta branches (or a PR into `beta/quest-ui-clean-review`). It is not part of a feature-branch PR into the crypt beta branch.

SQL files in `tests/sql/` are not executed by `npm test`. They are evidence and manual checks. Run one only against TEST `njqwwimzrsunheehnnnt` or a local database, as a role that is allowed to compile the functions, and never against `ugcvhmrriazbbymjxvch`. Do not claim a SQL smoke passed unless you paste the statement and the assertion result.

## What to run when

After a code edit, before the next edit in the same area:

```bash
npm run lint
node --test tests/<the files this edit can break>.test.mjs
```

Before commit, when the diff is more than a comment:

```bash
npm run lint && npm test
```

Do not run the full suite after every keystroke. Do not skip it before the commit you are going to report.

A docs-only change still typechecks nothing useful, but run `npm test` once if you are unsure you stayed out of code. A pure `docs/` commit does not need a Vercel preview.

## How to read a failure

TypeScript: the file and line are the task. Fix that. Rerun `npm run lint`. Do not reopen the architecture doc.

A unit test: rerun that file only until it passes, then `npm test` once before commit.

`ERR_MODULE_NOT_FOUND` for `react` or `typescript`: `npm ci`, then rerun the same file.

`Blocked preview build`: stop. See `known-failures.md`. The code is not broken.

A red action on a push to beta: open that run, read the failing job log, fix the cause, push a new commit. Do not re-request a green historical SHA.

## What not to claim

A local pass is not a hosted two-account walkthrough. Say you did not do one. A READY deployment is not acceptance of a different SHA.
