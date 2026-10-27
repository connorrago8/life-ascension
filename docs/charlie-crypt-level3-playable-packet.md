# Crypt Level 3 — playable encounter packet (draft)

**Decision basis:** Founder-approved Level 3 Forgotten Crypt; use existing draft PR #22 mechanics, not a second combat engine. This is a game-design proposal, not a new XP/unlock rule, production content, or permission to deploy. Target a complete *typical* run in under two minutes, not a timed fail condition.

## Core experience

A tight four-beat expedition: **Crypt Rat → inscription → Ember Charm → Crypt Sentinel**. The player's choice is concentrated at each beat. If a run takes longer because someone reads, uses accessibility features, or needs a pause, there is **no penalty**.

| Beat | Target interaction budget (design target, not measured) | Player sees | Single primary action |
| --- | --- | --- | --- |
| 1. Rat encounter | 20–30 seconds | Clear foe silhouette; attack wind-up direction; HP | Choose one of existing four combat actions |
| 2. Inscription | 10–15 seconds | Short clue, route indicator | Read / Continue |
| 3. Ember Charm | 10–15 seconds | Charm acquired for this run; show effect text | Equip for this run / Continue, per existing engine |
| 4. Crypt Sentinel | 30–45 seconds | Distinct sentinel silhouette, clear wind-up, HP and escape | Choose existing combat action; Review result on win |

**Total target:** 70–105 seconds assuming normal interaction, no connectivity wait. This is a design estimate; real browser/on-device timed QA is required. Do not shorten narration by removing accessibility information.

## Telegraph language and states

Use the existing four-action combat system and state transitions from PR #22. Do **not** invent damage values, opponent timings, loot odds, equipment stats, or shortcuts.

| Signal | Visible noncolor cue | Text for assistive tech | Motion-safe treatment |
| --- | --- | --- | --- |
| Idle | Weapon lowered / stable silhouette | "Sentinel is watching" | Static pose |
| Wind-up | Weapon raised and directional attack arc | "Sentinel preparing a [direction] strike" where direction is authoritative | Static raised pose + persistent chevron |
| Active | Contact arc / impact marker | "Sentinel strikes" | Static impact outline |
| Recovery | Lowered guard / opened stance | "Sentinel recovering" | Static exposed-guard pose |

No cue may depend solely on red/amber coloring or animation. Announce **changes** via a polite live region without re-reading the entire screen after every button press. Preserve clear focus indication and never auto-focus an attack action.

## Nonpunitive failure

- A defeat or retreat must never deduct daily XP, consume permanent equipment, or erase unrelated habits.
- Offer clear **Retry** and **Leave** choices consistent with PR #22's implemented run state; no inferred persistent save if not implemented.
- Reset the *run-only* Charm and Sigil on fresh-run reset as supported by existing draft logic; keep previously-cleared nodes/retry state accurate.
- The text should not call a run-only Sigil an account reward; label it **Run-only Sentinel Sigil** in journal and conclusion.
- If completion receipt or level eligibility is unavailable, show a retryable state with no optimistic XP or gear display.

## Small-phone and accessibility acceptance

At 320 / 375 / 390 / 430 CSS px, test keyboard focus and genuine 200% browser zoom as well as touch targets and overflow. Every view must show current objective, enemy intent and one primary action without lateral scrolling. Verify reduced-motion setting and grayscale perception. In review videos/images, distinguish **static storyboard** from **working combat**, and distinguish local browser success from hosted app release.

## Implementation split

- **Beta:** Examine current PR #22 UI, choose minimum surface changes; no duplicate dungeon. Provide a two-minute on-device or sandboxed browser walkthrough with clear timing evidence.
- **Alpha:** Authoritative Level 3 eligibility and reward scope, preserved run-only items, no daily bonus double award or XP from retry.
- **Charlie:** Narrative clarity, telegraph poses and screen-by-screen readability, only propose additional art after real failure evidence.
- **CEO/Grok:** Named independent review on accessibility and temporary-vs-owned item language. No assumed Grok dispatch.

**STOP:** PR #22 stays draft, as do this PR and linked Belt work. No hosted writes, merges or deployments authorized by this packet.

## Sentinel keyboard and screen-reader acceptance scenario (proposed, unverified)

The phrase **one primary action** means one clearly prioritized *current task*, **not** removing the four existing combat choices. At 320 CSS px and actual 200% browser zoom, all four actions must remain discoverable and keyboard-operable with no horizontal overflow. The current enemy intent must remain visible as persistent text, not just a transient animation or aria-live announcement.

**Executable reviewer procedure:** (1) enter an isolated, nonauthenticated QA fixture at the Sentinel wind-up with the same four actions as PR #22; (2) use keyboard Tab and Shift+Tab to reach each of the four choices, recording the DOM focus target and visible outline; (3) activate one choice with Enter or Space, check that current attack intent stays present and the status live region announces the transition **once**, rather than repeating the full page; (4) reach defeat and verify Retry and Leave remain keyboard accessible in reading order; (5) repeat with `prefers-reduced-motion: reduce` and a screen reader, recording actual spoken text and focus behavior. Do not equate a Playwright DOM assertion with a real screen-reader result.

**Pass conditions:** No horizontal scroll or clipped action at 320px/200% zoom; heading/current intent/choice focus order is logical; focus does not jump onto an attack button; idle/wind-up/active/recovery each have enduring readable words and noncolor shape; Retry/Leave are independently identifiable; no XP or permanent Sigil/gear claims. **Fail closed** if the browser zoom method cannot be measured or actual screen-reader evidence is unavailable. This is design acceptance, not an implemented or verified test.
