# Local progress integration candidate — November 4, 2026

Draft composition only. No independent acceptance, shared-branch merge or
Production deployment. Base PR80 at a626ddc4e61c47559b9e179643e0c1d8d99d9cb4
already includes Grok PR76 at 3cc9ecbc39b67a724f4ad9035558e83d444765a3.

## Incorporated source, without gameplay redesign

| Source PR | Exact source head | Scope |
|---|---|---|
| 80 | a626ddc4e61c47559b9e179643e0c1d8d99d9cb4 | Brain Rot route/pagehide checkpoint flush |
| 81 | 3d4d0120ba3ead16a15c062a2c930e1cf386cd2b | Jetpack pickup lanes and held Space controls |
| 83 | 128d87730bec9a2c42a661401eeeca4eada131f4 | Immediate Lantern saves, honest failure/retry |

The two BrainRotDungeon changes compose cleanly: the shared lifecycle effect
and held-input handlers both remain. Game rules come unchanged from PR81;
Town behavior comes unchanged from PR83. This branch does not edit owners'
source branches, visual assets or protected deployment configuration.

## New integration verification

The isolated exact-head workflow runs TypeScript, the complete source suite,
a guarded synthetic build/bundle scan, and all three source browser suites.
It then runs a fourth combined journey at 320/390px:

1. Hold Space in a new seeded Jetpack run for less than its periodic-save interval.
2. Leave for Hub; capture its complete saved state.
3. Visit Town, start the Lantern story and record a Hearth clue; return to Hub.
4. Confirm the Brain Rot checkpoint stayed unchanged.
5. Return to Jetpack without Resume, wait and reload; confirm its saved position
   and paused state remain, and Lantern storage is unchanged.

Only localhost GET/HEAD requests are permitted by these browser fixtures.
No account credentials, permanent XP, equipment writes or Production requests.
Browser evidence is sandboxed Linux Chromium, not iPhone Safari, native
simulator, VoiceOver, hosted Preview or Founder playtest.

## Unresolved release blockers and ownership

- Gameplay owner: QA82 exposed checkpoint-only Rune Resume resetting the board,
  malformed active state crashing rendering, and validator inconsistencies.
  Combining these PRs does not repair or accept those cases. QA82 remains a
  separate failing regression PR against PR73, not silently converted to green.
- Independent QA: review the combined exact SHA, including the interaction of
  held input, route exit and each storage key. Passing author-run CI is not
  independent approval of PR80/81/83 or this composition.
- Environment owner: latest isolated candidates hit the protected Preview branch
  guard. This candidate does not expand that allowlist or alter auth/security.
- World/Systems: concurrent Lantern tabs remain last-writer-wins; storage denial
  is disclosed and cannot promise durable progress.
- Integration: keep this candidate draft. Recheck every source head before any
  refresh; no force push. Do not apply it to a protected branch without Founder
  approval and independent QA.

Final candidate SHA, CI run/job and deployment identity belong in the single
GitHub checkpoint. The three source CI runs cannot certify this new composition.
