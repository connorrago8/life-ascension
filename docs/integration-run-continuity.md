# Integration checkpoint — November 4, 2026

## Scope and ownership

| Area | Current source / boundary |
| --- | --- |
| Brain Rot gameplay | PR #73 at `93ed0e5818d586285929515946c51228d3c53ecd`; simulation, difficulty and boss rules left to gameplay owner |
| Integrated release | Grok PR #74, then smoke fixes #75 and weekly autopilot #76; no writes to those branches |
| This isolated integration batch | `integration/release-evidence-20261104`, based on #76 `3cc9ecbc39b67a724f4ad9035558e83d444765a3`; local checkpoint lifecycle and browser verification only |
| Independent QA | Candidate acceptance remains separate from this implementation's tests; no merge or production release |

## Player-facing change

Brain Rot previously saved on document visibility changes and every 60 simulation
frames. An App Router link can unmount the game while the document remains
visible; the last fraction of a second was therefore not flushed by that path.
The existing pause/save callback now also runs on page hide and component
cleanup. Returning or reloading stays paused until an explicit Resume action.
This concerns on-device state only; it awards no XP and writes no account data.

`lib/localRunLifecycle.ts` owns listener installation/removal. Cleanup is
idempotent and removes listeners before flushing. It makes no promise that a
browser process killed without any lifecycle event can save its final frame;
the periodic checkpoint remains the fallback. Existing storage-failure behavior
is unchanged and there is no cloud-save success claim.

## Verification

- Local `npm test`: 778/778 passed after the lifecycle change.
- Local `npx tsc --noEmit`: passed.
- Browser harness syntax checked locally. Actual Chromium execution is recorded
  in the candidate's GitHub Actions run, not inferred from unit tests.
- New unprivileged, sandboxed browser job runs on PRs targeting
  `grok/weekly-autopilot`; it uses an unauthenticated local server, empty hosted
  credentials and refuses external requests or HTTP writes.
- Harness covers 320/390px, sub-second route exit, Hub return, paused reload and
  synthetic pagehide. Synthetic pagehide is not an operating-system close test.
- No native simulator, iPhone Safari, VoiceOver or Founder acceptance claimed.

Reproduce locally with a sandbox-capable non-root Chromium installation:

1. Install app dependencies and ephemeral `playwright@1.64.1`.
2. Start `npm run dev -- --hostname 127.0.0.1 --port 3136` with both public
   Supabase variables empty.
3. Run `QA_BASE_URL=http://127.0.0.1:3136 CHROMIUM_BIN=/path/to/chromium node tests/browser/brain-rot-navigation.qa.mjs`.

## Deployment evidence and release boundaries

PR #73 CI run `41280104547` succeeded for its exact head. The newer #76 run
`41329123138` passed build and both SQL jobs; its existing quest-browser job was
skipped. Neither run certifies this new candidate.

The #76 Preview `dpl_Gmp7bQyYgUtQNAatDYQPquAgy4eo` at the same #76 SHA failed
before Next compilation: required Supabase public URL and client key were
missing. Do not weaken the guard or copy Production credentials to make it pass.

The older #75 Preview `dpl_ByL6w19gXxkYZ1xoePweEAM5TT4P` is READY at
`4b867c322bcdaeee9cb6fed4b1ab8beeacd6c024`. A direct Brain Rot route request
redirects to Vercel authentication, so actual hosted gameplay was not inspected.
It does not contain this candidate merely because its platform state is READY.

Next: independent review of the lifecycle candidate and its browser evidence;
separately restore the verified branch-scoped nonproduction Preview configuration
through the environment owner. Production, shared branches and data untouched.
