# LIFE ASCENSION — Weekly Growth Reveal & Progress Dashboard (design only)

**Status:** **Approved with notes (design only); implementation not approved.** Branch `feature/weekly-growth-recap-design` based on `main`. This is a post-launch design, not a launch blocker. Phone-board and achievements designs are approved with minor notes. Next launch operation remains the Supabase backup/restore dry run in a separate test project, with explicit deployment approval later.

## Product goal and staged scope

**Core moment:** Show the user exactly how verified real-life activity contributed to progress, without invented gains or pressure. A weekly Sunday–Saturday recap should be useful before character stats exist.

- **Launch-safe recap v1 (post-launch implementation candidate):** read-only weekly completed quests, ledger XP, domains, and prior-week comparison using the current **+1 XP per server-confirmed completed instance** rule. No new XP, schema, or writes required by this design. Character-stat fields display **“Not available until Phase 2”** rather than fabricated numbers.
- **Phase 2 data foundation:** validated weighted tiers, domain skills, owner-scoped server-derived stats, and reproducible weekly before/after skill/stat snapshots. A snapshot may be a derived query result; whether persistent snapshot storage is necessary must be reviewed later. Never modify historical XP.
- **Phase 4+ visual evolution:** same recognizable character, evolving equipment, aura, and animations. Dungeon only showcases the growth.

## Data contract — read only

**Schema target:** draft launch PR #1 migrations `0001`–`0007`, not the older `main` branch schema. Verify deployment state before implementation. Use authenticated owner-scoped records:
- `quest_instances`: `id`, `owner_id`, `quest_id`, `status`, `completed_at`. Count **distinct** completed instances with valid completion timestamps. An archived/inactive parent quest must not erase legitimate history.
- `quests`: `id`, `owner_id`, `domain` for domain breakdown; never trust a client-provided domain. The eight allowed domain values are exactly `hygiene`, `home`, `mental_health`, `personal_growth`, `finance`, `career`, `relationships`, and `physical_health` (PR #1 migrations `0001`, `0003`, `0007`). Hygiene and Career are both real domains.
- `xp_ledger`: `owner_id`, `instance_id`, `amount`, `awarded_at`. Sum actual server-awarded amounts by award timestamp; do not calculate XP as a guessed multiple of completions. Deduplicate by the unique ledger instance. Reconcile counts without claiming they must match in every time window.
- **Achievements:** optional read-only earned badges if supported by the approved achievements design and authoritative eligibility rules; if no reliable earned timestamp exists, do **not** assert “earned this week.” The achievements system must not be changed by viewing the recap.

The recap must not write any of these tables, create quest completions, trigger XP RPCs, or grant badges. Protect every query by owner identity, including join keys, and do not expose other users' data.

## Time and attribution rules

- Weekly boundary: **Sunday 00:00:00 through next Sunday 00:00:00**, end-exclusive, in **`America/Chicago`**. UI labels show Sunday–Saturday.
- Completion attribution: actual `quest_instances.completed_at` instant converted to Chicago time, **not scheduled date**. Late completion of an older quest counts in the week actually completed.
- XP attribution: actual `xp_ledger.awarded_at` instant converted to Chicago time. In PR #1 migration `0007`, completion and ledger insertion occur in one transaction with `now()` timestamps, so `completed_at` and `awarded_at` are identical for current awarded completions. Keep metrics separate for integrity and future schema changes, not because cross-week attribution is possible today.
- DST transitions: compute local calendar boundaries first and convert to instants, rather than adding a fixed 168 hours. Weeks can be 167 or 169 hours.
- Compare like-for-like complete weeks; a current partial week must be clearly marked **“so far”**, not compared as a full seven days without qualification.
- Count only `status='completed'` instances with a valid `completed_at`. The current allowed statuses are `available`, `completed`, and `deferred`; completion is terminal, with no undo/reversal in v1. Duplicate joins or idempotent retries must not inflate counts. A completed instance missing its expected ledger row is a **data-integrity alert**, not a normal expected case.

## Weekly reveal layout

1. **Header:** default to **last completed week** (Chicago Sunday–Saturday) as the primary reveal; show **“This week so far”** in a separate secondary section with its own partial-week label.
2. **Verified activity:** count distinct qualifying completed instances; domain breakdown from trusted parent quests; optional list of real completed quests.
3. **XP earned:** actual ledger sum for the week, clearly distinguished from quest count; lifetime XP only if an authoritative read supports it.
4. **Before vs. after:** prior-week comparison of matching metrics, with neutral language and explicit dates. In Phase 2, show stat/skill changes only when reconstructable from server-authoritative data.
5. **Why you grew:** explain qualifying underlying completions and the specific skill/stat unlock thresholds. If no level increase, say **“No new stat level this week”** while still celebrating actual quests and progress toward next threshold, if available.
6. **Achievements:** only show earned-in-week badges when authoritative earned-at evidence exists; otherwise show eligible/owned badges without invented dates.
7. **Optional next steps:** link to existing incomplete quests or goals; no speculative “you should” judgments, pressure streaks, or XP incentives.

## Empty and edge states

- **No stat gains, some completions:** show actual quests/XP and “No new character stat increase this week”; never manufacture an ability or visual change.
- **No completions:** show zero and a neutral invitation to resume when ready. No shame or lost-progress language.
- **Missing/unavailable XP or domain records:** show “Unavailable” rather than zero or fabricated data; explain discrepancies.
- **Archived quest:** historical completion still counts, even when the quest is no longer active.
- **Network failure:** show a retry state; do not substitute cached guesses as confirmed current results.
- **Long-term growth:** a week-to-week zero delta must not hide lifetime progress, but lifetime totals must remain server-derived.

## Acceptance tests (proposed)

1. A qualifying completion Saturday 23:59:59 Chicago belongs to that week; Sunday 00:00:00 belongs to the next.
2. Spring/fall DST week boundaries remain correct with local Sunday–Saturday windows.
3. Completing an older scheduled quest on Tuesday is counted Tuesday's actual completion week, not the old due week.
4. If a completed instance lacks its expected ledger row, flag a **data-integrity alert** and do not fabricate +1 XP; this should not arise under the current same-transaction completion RPC.
5. **Future safeguard only:** if a later schema allows completion and XP award timestamps to differ, attribute each metric to its own timestamp's Chicago week; this is **not possible with the current PR #1 completion transaction**.
6. For each current ledger-backed completion, assert `completed_at = awarded_at` under PR #1 `0007` transaction semantics; any mismatch raises an integrity alert. Repeated reads, idempotent retries, and duplicate joins never inflate counts or XP.
7. Archived/inactive quests remain visible in historical totals.
8. Owner A cannot read any completion, ledger entry, domain, or achievement belonging to Owner B, including through joins.
9. A week with five completions and zero stat level-ups celebrates five real completions and explicitly shows no stat gain.
10. A week with no activity renders truthful zero metrics; missing records/service errors render **Unavailable**, not fabricated zero.
11. V1 with no Phase 2 skill tables works and does not claim any stat or cosmetic unlocks.
12. Badge “earned this week” is hidden unless authoritative earning-time evidence exists.
13. Reading or refreshing the recap causes zero database writes, XP changes, badge changes, or quest status changes.
14. The default view prominently shows the **last completed week**, with **“This week so far”** below it; partial and complete weeks are clearly distinguished and not compared as equivalent periods.
15. Reduced-motion and accessible text alternatives support future growth animations and charts.

## Open questions before any implementation

- **Resolved for PR #1:** all eight domain values are confirmed, including `hygiene` and `career`; Phase 2 display/skill names can still be designed later.
- **Resolved for v1:** completion is terminal and there are no reversals; any future reversal/correction feature would require a new design review.
- Decide if a weekly snapshot must be stored or can be reconstructed from authoritative event histories.
- **Resolved for v1:** last completed week is primary; this week so far appears below.
- Establish privacy-safe wording for sensitive domains and optional hiding of domain-level summaries.

**Cross-document note:** The current Endless Tower concept mapping already includes both **Hygiene → Recovery** and **Career → Mastery**; ensure all eight schema domains stay represented in any future skill mapping.

**Hard constraints:** No changes to `main`, draft launch PR #1, code, migrations, production, current +1 XP rules, or ledger history. Design only; the backup/restore dry run remains the next real launch step.
