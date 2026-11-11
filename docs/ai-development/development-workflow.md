# Development workflow

## LIFE ASCENSION — CHATGPT DEVELOPMENT ENGINE v1.0

1. Implementation first. If the task authorizes code and the tools exist, edit files in this session. A plan that is not followed by a diff is not progress.
2. No repeated authorization. Ordinary edits, tests, draft branches, and draft PRs into beta are already authorized by a development task. Ask again only for production, `main`, a destructive SQL change, a secret, a share link, or a scope the task did not name.
3. One coherent batch. Finish a behavior a player can see or a defect that is closed by a test. Do not open a PR whose only change is a comment, unless the task is documentation.
4. Audit once. Read the files the task touches. Do not re-list every PR in the repository after a typecheck fails.
5. Recover by changing the approach. If the same command fails twice for the same reason, stop retrying it. Use `known-failures.md`.
6. Preserve working behavior. Do not delete a screen to make a type error go away. Companions do not gain Play. Floor 1's generator stays deterministic.
7. Evidence in the report. Name the command, the exit, and the full SHA. "Tests passed" without that is a failed report.
8. Continue to the next authorized task when the first is committed and the tools still work. Do not idle for praise.
9. Leave a checkpoint. The PR body states what is done, what is not, and the head SHA. Update `current-state.md` only when the authoritative SHA changes.
10. Escalate a real blocker in one paragraph: the command, the error, the SHA, and the single action Connor must take. Do not ask him to debug a missing `node_modules`.

## The loop

Inspect → Implement → Test → Fix → Commit → PR → Report.

Stop only when a rule in `release-process.md` forbids the next step, or a tool you cannot replace is actually down. "I should think more" is not a stop.

### Inspect

```bash
git fetch origin beta/crypt-intro-exit-accessibility-20261029
git checkout -B cursor/<short-task>-8c36 origin/beta/crypt-intro-exit-accessibility-20261029
```

Cloud agents in this project have been required to use `cursor/<name>-8c36`. If you are not that agent and Connor named a branch, use his name. Never commit on `cursor/home-hub-v1-8c36` or `cursor/companion-finish-8c36`.

Search with the repository, not with memory. Open the function you will call. Read the test that already pins it.

### Implement

Edit the existing module. Companion UI goes through `companion_state` and `lib/companionAccess.ts`. Quest rewards go through SQL, not a client XP formula. A new floor does not call the floor-1 generator with extra rows.

Example, Companion 2.0: the shell was a role helper, a nav, a redirect, and four pages. It reused `companion_state`. It did not fork the quest board.

### Test

See `testing-guide.md`. Focused test, then `npm run lint`, then `npm test` before the commit you will report.

### Fix

Stay in the same branch. Do not open a "fix the fix" branch for a type error you just made.

### Commit and PR

```bash
git add <paths>
git commit -m "Why this change exists."
git push -u origin HEAD:cursor/<short-task>-8c36
```

Draft PR, base `beta/crypt-intro-exit-accessibility-20261029`. Do not merge.

### Report

PR URL, full `git rev-parse HEAD`, commands and results, what the player can see, what you did not verify.

## Minimal verification protocol

Do these. Do not add a second pass unless the first pass found a new SHA or a new failure.

1. `git rev-parse HEAD` and `git status -sb` after the commit. The status should be clean except ignored build junk.
2. `npm run lint` and `npm test` on that same tree. Save the pass count.
3. If the change is SQL, say whether TEST was migrated, and the migration name. Do not migrate production.
4. If you need a preview, check the branch against the allowlist first. If it is not listed, skip Vercel. Do not poll.
5. One `gh pr view <n> --json url,isDraft,headRefOid` after creation.

Stop. A moving branch alias is not a candidate. Quote the full SHA.

## Worked example — companion quests cap

Task: "Her Quests page hides quests after six, and a failed nudge looks like success."

- Inspect: `app/(app)/companion/quests/page.tsx` on beta (`mine.slice(0, 6)` and `.then(() => reload())` with no error). `tests/companionRelease1.test.mjs`. Do not open the delve.
- Preserve: Just type, send, the companion nav, RLS.
- Done: every non-declined quest she sent is listed; a failed nudge sets a visible message; a test reads the source or the behavior; draft PR; no migration; no edit to PR #128's branch.
- Tests: `npm run lint` and `node --test tests/companionRelease1.test.mjs tests/companionFinish.test.mjs` if that file exists on your branch, then `npm test`.

## Environment this workflow assumes

A checkout, a shell, `git`, Node, and `npm`. GitHub API alone can open the PR and cannot run the tests. If you only have the API, say so in the first message and do not pretend the suite passed.
