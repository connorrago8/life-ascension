# Current state

Verified 2026-11-11 against `origin` and the Vercel project API. Re-fetch before treating a SHA as still current. A branch name is not a commit.

## Repository

`connorrago8/life-ascension`. Default branch `main` is `ddd9918ffe3cc51e825a1dd5aaf28cf1c1cf3ed3`. Do not develop on it.

Authoritative TEST line: `beta/crypt-intro-exit-accessibility-20261029` at `eb7f143dedc6ca9ce24b5a1f9f55ef06b1472607` (merge of PR #126). Push CI for that SHA: [run 42935014786](https://github.com/connorrago8/life-ascension/actions/runs/42935014786), conclusion success. Vercel preview `dpl_BkFcnrsHw6nWTUHMZhnDC7oSdMS9` is READY, target null, branch `beta/crypt-intro-exit-accessibility-20261029`, same SHA. Alias `life-ascension-git-beta-crypt-intro-exit-9afc4b-r6r6bsfbkm-9616.vercel.app`. That alias moves when beta moves. The deployment id does not. No share link was created for it.

## Pull requests that matter

| PR | State | Head | Base |
| --- | --- | --- | --- |
| [#126](https://github.com/connorrago8/life-ascension/pull/126) | Merged 2026-11-11. Merge `eb7f143dedc6ca9ce24b5a1f9f55ef06b1472607`. | `cursor/roguelite-release-1-8c36` | beta |
| [#125](https://github.com/connorrago8/life-ascension/pull/125) | Merged 2026-11-10. Merge `09c334a015535c6a816a38d181a8e5ee5332d7d8`. Branch head `133d75ba2a241995f0757599c262c0110ec52950`. | `cursor/companion-2-release-1-8c36` | beta |
| [#127](https://github.com/connorrago8/life-ascension/pull/127) | Open draft. Do not push this branch from a handoff session. | `56a4e3a30a864b9ee81993faf7183ddf3cc66234` on `cursor/home-hub-v1-8c36` | beta |
| [#128](https://github.com/connorrago8/life-ascension/pull/128) | Open draft. Do not push this branch from a handoff session. | `03bc50960bd885594ddf27f96edba226cd025f5e` on `cursor/companion-finish-8c36` | beta |
| [#123](https://github.com/connorrago8/life-ascension/pull/123) | Merged. 5:00 AM game day. | `cursor/quest-game-day-5am-8c36` | beta |

Older draft stacks (#100–#121 and others) are not the beta line. Do not revive them unless the task names one.

ChatGPT branches that are still open, and are not night branches: [#61](https://github.com/connorrago8/life-ascension/pull/61) through [#67](https://github.com/connorrago8/life-ascension/pull/67), heads under `chatgpt/*-20261031`. A full branch listing on 2026-11-11 found no `night/*` ref. If a later session expects `night/*`, search again; do not invent the ref.

## Owned branches — do not commit on these

- `cursor/home-hub-v1-8c36` (PR #127)
- `cursor/companion-finish-8c36` (PR #128)
- `cursor/companion-2-release-1-8c36` (already merged)

New work branches off beta. This documentation branch is `docs/ai-development-handoff`.

## Supabase

| Role | Project ref | Name |
| --- | --- | --- |
| Production | `ugcvhmrriazbbymjxvch` | `life-ascension` |
| TEST | `njqwwimzrsunheehnnnt` | `life-ascension-restore-test` |

TEST has migration `202611110001_companion_finish` applied (wardrobe, home metrics RPC, companion-quest status trigger, companion skip inside `grant_ashen_hood_from_xp`). That SQL is on PR #128, not on beta. Beta source does not contain the migration file yet. TEST is ahead of beta for that one migration. Do not reapply it. Do not apply it to production.

`adventure_run_saves` on TEST grants authenticated SELECT only. Do not write it from the client.

## Vercel

Project `life-ascension`, id `prj_drhDCaDXEbDTAzDHEr4orf8xyVBf`. Team id `team_JszaPbNUcmlkQz7bwvskvapY`. Team slug segment in hostnames: `r6r6bsfbkm-9616`. Node on the project is 24.x. CI uses Node 22.

Preview builds are allowed only when `VERCEL_GIT_COMMIT_REF` is one of `audit/qa-isolation-and-reliability-20261027`, `beta/quest-ui-clean-review`, or `beta/crypt-intro-exit-accessibility-20261029`. Any other branch fails in `scripts/verify-deployment-env.mjs` before `next build`.

Evidence: deployment `dpl_6arVqdVfwUjLuDa4yyhb8nrVeags` for `03bc509` on `cursor/companion-finish-8c36` is ERROR. The build log says `Blocked preview build: not the protected QA branch`. That is the guard. Do not "fix" it by widening the allowlist.

Project SSO protection is enabled for all except custom domains. `docs/apple-health-shortcut.md` says a Preview request without a Vercel login or a share cookie receives Vercel's login page (HTTP 401), not the app. This handoff did not mint a share link. There is no share token in git. A link copied for one deployment id is not evidence that a newer deployment is reachable. If a link 401s, stop and ask Connor; do not disable protection.

## GitHub Actions

`.github/workflows/build.yml` runs on push to `main`, `beta/quest-ui-clean-review`, and `beta/crypt-intro-exit-accessibility-20261029`. Pull requests run only when the base is `main` or `beta/quest-ui-clean-review`. A draft PR into the crypt beta branch does not start that workflow. Seeing "no CI" on PR #127 or #128 is expected. The check that does run is Vercel, and it fails the allowlist on purpose.

## Unfinished product work

On beta, Companion 2.0's shell is in. These are still true in beta source:

- `app/(app)/companion/quests/page.tsx` renders `mine.slice(0, 6)`.
- That page's nudge button ignores the RPC error.
- An RPC failure in `useCompanionRole` becomes role `adventurer`.
- Overlapping `resolve()` calls can apply an older response after a newer one. There is no request generation counter.
- Quest drafts on the companion quests page are component state. Leaving the page drops them.
- Off-day planner and repeating chores render on `/companion`, not in the companion nav.

PR #127 (not merged) is the home hub and `docs/roguelite-design.md`. Floors 2–3 are not started. PR #128 (not merged) is the status trigger, server home metrics, and wardrobe. It does not fix the six-quest cap or the swallowed nudge error.

Highest-priority next coding task for a new agent: the 30-minute challenge in `handoff.md`. Do not start it on the #127 or #128 branches.
