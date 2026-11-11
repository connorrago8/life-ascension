# Handoff

Evidence is from this repository, GitHub, Vercel deployment records, and the cloud VM that produced PRs #125–#128. Durations were not timed. ChatGPT's private error strings are not in the repo; those gaps are named.

## Part 1 — What this agent actually does

The speed is mostly the environment. This session had a full checkout, a shell, `git`, `npm`, file search, and HTTP APIs for GitHub, Supabase TEST, and Vercel. Edits were applied to the working tree and checked with `npm run lint` and `npm test` before push. That loop is not a Grok-only model feature. It is a coding agent with a machine. A session that can only call the GitHub contents API one file at a time cannot match it, regardless of which model writes the prose.

Hypothesis, not a measurement: once both sides have the same sandbox, remaining gaps are batch size and when they stop to ask. There was no A/B test of model quality on this repo.

1. Repository access. `git fetch` / `git checkout` against `https://github.com/connorrago8/life-ascension`. The VM already had the checkout. ChatGPT can do this in any sandbox that can clone. GitHub API file reads are the fallback and are slower.
2. Filesystem, terminal, git, and APIs together. Browser was not required for the companion SQL or the unit suite. Vercel CLI `inspect` hung; the Vercel HTTP API returned the deployment record. ChatGPT should use a sandbox plus the GitHub connection, not the API alone.
3. Inspection. Search for the symbol (`companion_state`, `PROTECTED_QA_BRANCHES`), then read that function. Do not start at `app/` and read downward.
4. Which files. The failing assertion or the call site names them. Companion role is `lib/companionAccess.ts` plus `components/useCompanionRole.ts`. A new page that reimplements the redirect is the wrong file.
5. Architecture. `architecture.md` plus the one module you will edit. Reread a file only after it changes.
6. Multi-file edits. Change the helper and every caller the typechecker names. Land them in one commit when they are one behavior.
7. Batch size. One player-visible behavior or one closed defect. Companion 2.0 was the shell (nav, role, four pages), not a new XP system. PR #66 is the counterexample: a roadmap file and a promise to implement later.
8. Tests. `npm run lint`, then `node --test tests/<file>.test.mjs`, then `npm test` before the reported commit.
9. A red test. Rerun that file. If the error is `ERR_MODULE_NOT_FOUND`, `npm ci` once. If it is an assertion, fix the code or the stale assertion. Do not reopen every PR.
10. TypeScript, React, Next, Supabase, Vercel. TypeScript: read the diagnostic. React: the test or the page. Next: this app is the App Router under `app/`. Supabase: security-definer RPC, owner RLS, TEST only. Vercel: if the log says `Blocked preview build: not the protected QA branch`, stop. That happened on `dpl_6arVqdVfwUjLuDa4yyhb8nrVeags`.
11. Git. Branch from `origin/beta/crypt-intro-exit-accessibility-20261029`. Commit. `git push -u origin HEAD:<branch>`. Draft PR with the GitHub UI integration, not a force-push. Never push the beta branch unless the task says to.
12. Verification. Unit tests plus reading the diff. Not a two-account playthrough unless you did one. This agent did not.
13. Enough. Protocol in `development-workflow.md`. One full suite on the commit you name. Stop.
14. Tool failure. Classify, then switch tools (Vercel API instead of a hung CLI; `npm run lint` instead of `npx tsc`). Retry once only for a network blip.
15. Between conversations. Git is the memory. These docs are the index. Chat history is not.
16. Context. Keep `current-state.md` and the files in the diff. Do not paste the overnight log back into the prompt.
17. Failed approaches. `known-failures.md`. Do not widen `PROTECTED_QA_BRANCHES`. Do not `npx tsc` on an empty `node_modules`.
18. Blocker versus chore. Missing install, a type error, and a red unit test are chores. Production SQL, a secret, and a share link are blockers.
19. Authorization. The task already allows draft code on beta. Ask for production, `main`, workflow edits, RLS changes, and share links.
20. Large changes. The machine applies a multi-file diff and the test runner checks it in one pass. The model still has to aim at one behavior. Aiming at "improve the game" without a file list is how sessions stall.

Grok-specific: this VM, this GitHub credential, Supabase MCP on the TEST project, Vercel MCP. Alternative: Cursor cloud agents (cursor.com) or a Codex cloud task with a clone of the same repo. Both can run the loop. A chat box with GitHub file APIs cannot.

## Part 2 — Failure modes, evidenced as far as the repo allows

### A. Planning loops

[PR #66](https://github.com/connorrago8/life-ascension/pull/66) (`chatgpt/life-ascension-roadmap-contract-20261031`) is one file, +60 lines, still draft. The body says implementation is a later branch. That is a planning stop with a ChatGPT branch name on it. [Issue #60](https://github.com/connorrago8/life-ascension/issues/60) shows the same shape from the coordination side: repeated SHA tables and "recheck live state" while items stay OPEN. The issue is a shared log, not proof that every paragraph was written by ChatGPT.

Break the cycle with the engine's rule 1. The definition of done is a draft PR with a test, not a contract.

### B. Excessive verification

Necessary: lint, unit tests, the full SHA, and one deployment lookup when the branch is allowlisted. Redundant: polling a feature-branch Vercel build that the guard will reject; re-reading CI for an unchanged SHA; treating a branch alias as the candidate. [Issue #60](https://github.com/connorrago8/life-ascension/issues/60) already says a later green run does not rehabilitate rejected `4761ec8`. Bind the result to the SHA and stop.

### C. Tool failures

Documented in `known-failures.md`. ChatGPT-internal exceptions: no log in the repo. Diagnostic is in that file, entry 8.

### D. Repeating mistakes

Write the failure into `known-failures.md` once. The next session reads it before touching Vercel. Tests pin the behavior (`tests/companionRelease1.test.mjs` pins the nav). Do not add a second allowlist.

### E. Tiny changes

PR #62 is +42 lines in one file and is still draft. That can be a correct guard, and it is not a playable change. Prefer a batch like Companion 2.0: 14 files, one behavior, merged as `09c334a`.

### F. Stopping at a recommendation

The loop is the process. If you can name the file, edit it.

## Part 3 — Comparison

| Capability | This agent | ChatGPT, where evidenced | Why the fast path is faster | What to change | Procedure |
| --- | --- | --- | --- | --- | --- |
| Discover the repo | `git fetch`, search | GitHub API and `chatgpt/*` branches exist | Local index is instant | Clone | `git fetch origin beta/crypt-intro-exit-accessibility-20261029` |
| Read files | Working tree | API blobs, one at a time | No round trip per file | Use a checkout | Open the path from search |
| Search | ripgrep | GitHub code search, if enabled | Local search sees uncommitted work | Same | Search the symbol, not the product name |
| Edit | Multi-file patch on disk | A commit per file via the API is possible and slow | One tree, one typecheck | Batch one behavior | Edit, then `npm run lint` |
| Refactor | Helper plus callers | Not shown landing on beta | Typecheck lists the callers | Don't fork a second quest board | Follow `AGENTS.md` |
| Branch | `git checkout -B` from beta | `chatgpt/*` branches exist and stayed open | Isolated from #127 and #128 | Branch from beta, not from an owned head | See workflow |
| Commit | `git commit` after tests | PRs #61–#67 have commits | Tests run before the message is trusted | Commit only a green tree | `npm test` then commit |
| PR | Draft into beta | #61–#67 still open; #66 is docs | A PR is the checkpoint, not the goal | Finish the behavior the body promises | Draft, do not merge |
| Install | `npm ci` | Not visible | Recovers `ERR_MODULE_NOT_FOUND` | Install before claiming tests | `npm ci` |
| Typecheck | `npm run lint` | Unknown | Avoids the fake `tsc` package | Never `npx tsc` on an empty tree | `known-failures.md` §3 |
| Unit tests | `npm test` (693 on the companion branch before this docs commit) | Not attached to #66 | Seconds, not a redeploy | Run them | `testing-guide.md` |
| Browser | Not used for companion unit work. CI job `quest-browser-qa` exists for allowlisted pushes | Not evidenced here | Most regressions are unit-level | Don't block on a phone | CI job only after merge to beta |
| Screenshots | Not a gate | Not evidenced | Pixel diffs are slow and flaky here | Skip unless the task is visual | Say you skipped them |
| CI | Push workflow on beta. PRs into this beta do not run `build.yml` | Easy to misread as "CI is broken" | Knowing the trigger saves hours | Don't edit the workflow | `known-failures.md` §2 |
| Supabase | TEST SQL via the project API, ref `njqwwimzrsunheehnnnt` | Not shown | Migrations can be applied and queried | TEST only, additive | `release-process.md` |
| Migrations | `202611110001_companion_finish` is on TEST and on PR #128, not on beta | No matching ChatGPT migration on beta | Source and database can diverge | Say which side you changed | current-state |
| Vercel | API by deployment id | Feature branches ERROR on purpose | The guard is one log line | Do not retry it | `dpl_6arVqdVfwUjLuDa4yyhb8nrVeags` |
| Auth testing | Role helper unit tests. No second real account | Not evidenced | A second account is Connor's | Don't claim a walkthrough | Say so |
| Regression | Full `npm test` once per reported commit | Not attached to the open chatgpt PRs | One suite catches the shell | Run it | testing-guide |
| Context | These docs plus the diff | Long chats, evidenced by #60's repeated tables | An index beats a transcript | Read `README.md` | Five files, then code |
| Priority | The task's first behavior | Roadmap PR #66 lists 30 tasks and implements none | A list is not an order | Do the challenge, then stop or continue | Part 9 |
| Recovery | Switch tool, don't loop | Not in logs | A hung CLI is not a product bug | Entry 5 | Vercel API |
| Release | Draft PRs, no prod | #66 says no production merge | The rule is the same | Keep it | `release-process.md` |
| Production protection | Guards in `scripts/verify-deployment-env.mjs` | Must not weaken them | The fast path still refuses prod | Copy the refusal, not the speed | Never `ugcvhmrriazbbymjxvch` |

Evidence versus hypothesis. Evidence: the sandbox ran the suite, applied TEST SQL, and read a Vercel log that a chat-only session would have called a mystery failure. Evidence: ChatGPT-named PRs #61–#67 are open and #66 stopped at a document. Hypothesis: the model is not the main bottleneck. Untested: that the same model in this VM would match the throughput. Realistic options: keep using Cursor cloud agents from cursor.com, or give ChatGPT a Codex-style cloud task that clones the repo and runs `npm test`. A GitHub-API-only workflow can read, commit, and open PRs. It cannot compile, run the suite, or tell a guard failure from a game bug without guessing.

## Part 7 — Companion 2.0 case study

Branch `cursor/companion-2-release-1-8c36` at `133d75ba2a241995f0757599c262c0110ec52950`. Merged as [PR #125](https://github.com/connorrago8/life-ascension/pull/125), merge commit `09c334a015535c6a816a38d181a8e5ee5332d7d8`. Push CI [run 42745591245](https://github.com/connorrago8/life-ascension/actions/runs/42745591245) succeeded. A feature-branch preview was not a reliable signal then and is not now (allowlist). No share link.

The branch was created off beta, not off `main`. Files came from searching for the companion route and `companion_state`. Wall-clock time was not recorded. Tools were the editor, shell, `npm`, and git. The commit adds 14 files (615 insertions): `lib/companionAccess.ts`, `components/useCompanionRole.ts`, `components/CompanionNav.tsx`, `components/RoleRedirect.tsx`, `app/(app)/companion/home/page.tsx`, `quests/page.tsx`, `rewards/page.tsx`, `character/page.tsx`, `useCompanionBoard.ts`, plus edits to `AppShell.tsx`, `page.tsx`, and `app/style.css`, and `tests/companionRelease1.test.mjs`.

Role: `roleFromCompanionState` plus `useCompanionRole` calling `companion_state`. Nav: `COMPANION_NAV` has Home, Quests, Rewards, Character, and the test forbids Play. Home: `app/(app)/companion/home/page.tsx` on that commit computed counts in the browser. Later PR #128 moves those counts to `companion_home_metrics` and is not merged. Draft source: `draftSourceLabel` maps `model` to "AI organized" and `fallback` to "Basic draft". Tests in the case-study commit are `tests/companionRelease1.test.mjs`. Errors worth remembering from later work, not from that commit's message: wrong `tsc` package, stale test process, blocked preview. They are in `known-failures.md`.

Incomplete after the merge, checked on beta `eb7f143` unless noted:

| Risk | Status in current code |
| --- | --- |
| RPC failure classified as adventurer | Still true. `useCompanionRole.ts` passes `bond: null` when `error` is set. `roleFromCompanionState` then returns `adventurer` for a signed-in user. |
| Role requests race on account switch | Still true. `resolve` has no generation counter. `active` only flips on unmount. A late response can overwrite a newer one. The cache is cleared when the user id changes, which closes only the cache half. |
| Quests list shows six | Still true on beta and on PR #128: `mine.slice(0, 6)` in `app/(app)/companion/quests/page.tsx`. |
| Scheduling and repeating chores not fully on the new shell | Still true on beta: the forms live in `CompanionHome` on `/companion`. PR #128 adds a link from the quests page to `/companion#off-day` and does not move the forms. |
| Drafts disappear on navigation | Still true. Drafts are `useState` in the quests page. Unmount drops them. |
| Nudge errors | Mixed. `CompanionHome.tsx` puts `error.message` on screen. The quests page calls `.then(() => reload())` and ignores `error`. Still true on beta and on PR #128. |
| Rewards and Character polish | Rewards and Character exist and are plain. PR #128 adds a wardrobe to Character and is not on beta. Visual polish beyond that was not done. |

Next, for a new branch off beta: remove the six-item cap and surface the nudge error. Do not reimplement the wardrobe on top of #128.

Regressions to watch: a companion sent through the adventurer home if the role helper changes; a second XP path if a new button calls anything other than the existing RPCs.

## Part 9 — 30-minute challenge

Task: on a new branch from `eb7f143` (or a newer beta SHA if you re-fetch), make Companion Quests list every non-declined quest she sent, and show the nudge RPC error on the page. Do not edit `cursor/companion-finish-8c36` or `cursor/home-hub-v1-8c36`. No migration. No production.

Files: `app/(app)/companion/quests/page.tsx`, and a test under `tests/` if you add an assertion. Read `components/useCompanionRole.ts` only if you are tempted to "fix role detection too." Do not. That is a second task.

Acceptance: source no longer slices the list at 6; a failed nudge is visible; `npm run lint` and `npm test` exit 0; draft PR into beta; report the full SHA and the pass count.

Commands: `npm ci` if needed, `npm run lint`, `npm test`.

Common failures: editing PR #128's branch; adding the branch to the Vercel allowlist; claiming CI on the PR (it will not run); `npx tsc`.

Recovery: `known-failures.md`. If tests fail, fix and rerun. If you notice the role-classification bug, write it in the PR body and leave the code alone.

| Category | Weight |
| --- | --- |
| Working code in a draft PR | 30 |
| Correctness, no extra product scope, tests green | 25 |
| Tool use: one branch, focused tests, no allowlist edit | 15 |
| Error recovery without a new plan | 15 |
| Report: full SHA, command results, risks | 15 |

Pass at 85. A confident explanation with no PR scores 0 on the first row.

If the test fails because there is no shell, the missing capability is a sandbox. Smallest fix: run the same task as a Cursor cloud agent or a Codex cloud task against this repo. Do not add more prompt text.

## Part 10 — Stop, and keep

| Stop | Why it fails | Do this | Check |
| --- | --- | --- | --- |
| Rewriting an approved plan | The plan was the work | Edit the file | A diff exists the same session |
| Asking a question the task answered | Connor already authorized draft PRs | Proceed | No "shall I open a PR?" |
| Rechecking an unchanged SHA | The result cannot change | Quote it once | One CI URL per SHA |
| Recommending the fix | The player sees nothing | Implement | PR is not docs-only unless the task is |
| Calling a type error a blocker | It is a chore | Fix it | `npm run lint` |
| A one-line PR as a milestone | It does not change play | Batch one behavior | The PR body names the behavior |
| Committing on someone else's branch | #127 and #128 get mixed | New branch off beta | `git status -sb` |
| Source file equals deployed | TEST can be ahead of beta, as with `202611110001` | Say which side changed | Migration name and SHA |
| "Tests passed" with no command | Unauditable | Paste the command and the counts | The report contains both |
| Retrying a guard failure | The second build fails the same way | Stop | No second deployment for that reason |
| No checkpoint | The next session rediscovers beta | PR body with SHA | `gh pr view` |

Keep: security review, RLS, the deployment guard, the Crypt XP cap, explicit Wear, refusing production, and saying when a walkthrough was not done. Speed does not retire those.

## Part 12 — Self-audit

1. Debt. `/companion` and `/companion/home` both exist. PR #128 links them instead of extracting one planner component. `AGENTS.md` would have preferred one module if the planner moved. The link is a shortcut.
2. Tests. Companion 2.0 has unit tests for role and nav. PR #128 was unit-tested (`npm test`, 693). Nobody in this session completed a two-account browser pass. Do not describe it as playtested.
3. Release protections. No workflow edits, no allowlist edits, no production SQL, no force-push. TEST did receive `202611110001_companion_finish` before the PR merged. That is allowed by the TEST rule and it means the database is ahead of beta. ChatGPT must not "repair" that by applying the file to production or by dropping it on TEST without the rollback notes.
4. Unfinished work that can look finished. The wardrobe and the status trigger are not on beta. The quests page still hides rows after six. Role errors still look like "this person is an adventurer."
5. Duplication. Home metrics were computed in the browser and, on #128, again in SQL. The browser copy should die when #128 merges. Do not keep both.
6. Production assumptions. Preview READY `dpl_BkFcnrsHw6nWTUHMZhnDC7oSdMS9` is beta `eb7f143` only. It says nothing about #127 or #128. SSO protection is on. No share link was minted, so a phone can still see Vercel's login page.
7. Security. The role-failure bug can show a companion the adventurer shell if `companion_state` errors. It does not grant XP by itself. The hood trigger skip and owner-only cosmetic rows are on TEST via #128, not on beta. Authenticated users have SELECT on their own cosmetic rows and no INSERT.
8. Branch cleanup. #127 and #128 are intentional drafts. `chatgpt/*` PRs #61–#67 are stale relative to beta. Do not delete them in a drive-by.
9. Copy: the loop, TEST-only SQL, one suite per reported SHA, guards left intact, `AGENTS.md`.
10. Do not copy: shipping a TEST migration and calling the feature on beta; leaving `slice(0, 6)` while adding a nearby link; treating a blocked preview as a build bug; starting floors 2–3 in the same PR as a docs handoff.
