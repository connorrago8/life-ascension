# LIFE ASCENSION — Phase 2 Progression Pacing (docs-only proposal)

**Status:** Proposed for review, not approved for implementation. This branch starts at `main`; implementation must target the approved PR #1 schema after launch and a compatibility review. No changes to launch +1 XP, existing ledger, production, or migrations.

## Already settled — do not reopen

Phase 2 XP tiers: **1 / 2 / 5 / 10 / 25**; server assigns and locks a quest's tier at creation; repeatable habits limited to **1–2 XP**, with repeat caps/anti-farming; ledger records the **exact awarded amount and ruleset**. Historical launch ledger entries remain unchanged. Domain names in PR #1: `hygiene`, `home`, `mental_health`, `personal_growth`, `finance`, `career`, `relationships`, `physical_health`.

## Target feel

- **Every week:** show actual completed quests, ledger XP, progress bars, and progress toward thresholds, even if no level or stat changes. Never invent gains.
- **Roughly monthly:** aim for a meaningful unlock (cosmetic, equipment, or ability) for a typical sustained player. This is a **calibration target**, not a guaranteed calendar reward. Unlocks happen only when a real threshold is crossed.
- **Roughly quarterly:** larger character milestone tied to verified cumulative progress. No automatic quarterly gifts.
- Missed or low-activity weeks never punish the player or erase progress.

## Candidate overall level curve (NOT approved)

At overall level L (starting at 1), XP needed for next level = `20 + 5 × (L - 1)`. Cumulative XP to reach level N = `20 × (N-1) + 5 × (N-1) × (N-2) / 2`.

| Level reached | Cumulative XP |
|---|---:|
| 2 | 20 |
| 3 | 45 |
| 4 | 75 |
| 5 | 110 |
| 6 | 150 |
| 10 | 360 |

**Compatibility warning:** Launch already has a level curve (prior launch level 50 threshold: 1,396 XP). This candidate would substantially change displayed levels. Do **not** implement or relabel existing levels without explicit approval and migration-free historical compatibility analysis. A safer alternative may retain the launch overall curve and tune *cosmetic/ability milestone thresholds separately*. Benchmark actual post-launch XP/week before selecting a curve.

## Worked examples: three consecutive weeks

Illustrative, not user activity. Assume new character level 1, 0 cumulative XP, valid server-locked tiers and all repeat caps satisfied.

**Week 1 — light (11 XP):**
- Hygiene routine ×3 @1 = 3 (hygiene)
- Tidy home ×2 @1 = 2 (home)
- Short walk ×2 @1 = 2 (physical_health)
- Budget review ×1 @2 = 2 (finance)
- Friend check-in ×1 @2 = 2 (relationships)
- End: 11 cumulative XP, level 1, 11/20 to level 2. No unlock invented.

**Week 2 — normal (24 XP):**
- Hygiene routine ×4 @1 = 4 (hygiene)
- Home upkeep ×3 @1 = 3 (home)
- Exercise ×3 @2 = 6 (physical_health)
- Journal ×2 @1 = 2 (mental_health)
- Skill-building session ×1 @5 = 5 (personal_growth)
- Career task ×2 @2 = 4 (career)
- End: 35 cumulative XP, level 2 (threshold 20), 15/25 toward level 3. Every one of the eight domains appears across the three weeks.

**Week 3 — big-goal (36 XP):**
- Major financial goal ×1 @25 = 25 (finance)
- Meaningful relationship milestone ×1 @5 = 5 (relationships)
- Exercise ×2 @2 = 4 (physical_health)
- Hygiene routine ×2 @1 = 2 (hygiene)
- End: 71 cumulative XP, level 3 (threshold 45), 26/30 toward level 4 (threshold 75). A 25 XP goal does not imply an automatic stat or equipment unlock.

Across three weeks: 71 ledger XP, 30 completed instances (9 + 15 + 6), assuming each activity above is a distinct eligible completed instance. Weekly reveal must compute counts from real records, not from these illustrative totals.

## Overall level versus domain skills

- Overall level: computed from authoritative total awarded XP, across all domains, **once** per ledger award.
- Domain skill progress: allocate each qualifying ledger award to the **one server-authoritative quest domain**. This is a *view/allocation* of existing XP, **not an additional lifetime XP award**.
- Each domain has independent thresholds and progress. Finance milestones cannot directly raise Physical Health or Career.
- Proposed domain thresholds for further calibration: level 2 at 10 domain XP, level 3 at 25, level 4 at 45, level 5 at 70. These are illustrative only; may overreward a single 25 XP quest. Prefer threshold-gated *skill effects* and separately review whether one large goal may cross multiple skill levels.
- Derived character stats only change when an explicitly approved skill/stat threshold is reached. Weekly progress bars can change without any stat gain.
- Any domain skill logic must remain owner-scoped, server-derived, and read-only to the existing ledger.

## Five trivial tasks versus one big goal

Five distinct eligible 1-XP trivial tasks = **5 XP**, subject to repeat caps. One legitimately classified, server-locked 25-XP goal = **25 XP**. The goal produces 5× the XP; both count truthfully as five completions versus one. A 2-XP repeatable habit can contribute more but remains subject to repeat limits. No reclassification of already-created quests or retroactive awards.

## Unlock pacing options

A. **Preferred to test first:** preserve launch overall level curve; use independent Phase 2 milestone gates for a small monthly unlock and larger quarterly visual upgrade, calibrated against observed real-world weekly XP. Does not promise a reward in a week without threshold crossing.
B. Candidate new overall curve above; higher compatibility risk, requires explicit separate approval.

Quarterly milestones can be multi-domain and cumulative (e.g., documented milestones reached in several domains), but should not require all eight domains or punish low-activity periods. Final criteria TBD; don't pretend a stat change occurred if a milestone isn't earned.

## Fit with approved Weekly Growth Recap

Default **last completed Sunday–Saturday America/Chicago week** with **this week so far** beneath. Use `completed_at` for completion attribution, `awarded_at` for ledger XP. PR #1 `0007` uses `now()` in the same transaction, so current completion and award timestamps match. Show actual quests, XP, progress-to-next-level, domain skill progress if implemented, and unlocks **only when supported**. A week with no stat changes still celebrates genuine activity. No extra XP, automatic badges, or recap writes.

## Acceptance tests for eventual implementation

1. For XP awards of 1/2/5/10/25, total XP increases by exactly the ledger amount once; no double count from domain allocation.
2. Repeatables cannot exceed approved 1–2 XP tiers or anti-farming limits.
3. Existing launch +1 XP history is unchanged; no re-award or re-tier of old quests.
4. Worked sample weeks reconcile to 11, 24, 36 and cumulative 11, 35, 71; candidate levels 1, 2, 3.
5. All eight schema domains are accepted and correctly displayed; no nonexistent ninth domain.
6. Five distinct 1-XP tasks award 5 total; one valid 25-XP goal awards 25, without fabricated extra completion counts.
7. A domain's progress rises only from awards attributed to that domain; overall XP sums each ledger award once.
8. A no-level-up week shows truthful activity and unchanged stats; an empty week shows zero without punishment.
9. Unlock occurs only after verified threshold crossing; monthly/quarterly timing is aspirational, not calendar-triggered.
10. Recap reads only owner-scoped records and creates no XP, completion, achievement, or stat writes.
11. Historical and current week boundaries follow Chicago local Sunday–Saturday, including DST.
12. Compatibility analysis verifies launch level curve and existing user level before any change is authorized.

## Decision and pause

**Recommendation:** defer choosing a replacement overall level curve until actual post-launch usage exists. Prefer tuning unlock thresholds around the existing level system, with domain skills in Phase 2. This document concludes the design exploration; pause new design work until launch.

**Next real step:** Supabase backup/restore dry run into a separate test project when the user is home, followed by explicit production deployment approval. No code, migrations, PR #1, or production changes authorized.
