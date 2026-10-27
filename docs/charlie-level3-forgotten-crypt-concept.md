# Level 3 Forgotten Crypt — design and integration boundary

**Owner:** Charlie (concept/design); **reviewers:** CEO, Beta (UI), Alpha (progression integrity), Grok Dungeon/Quest Design when an actual response is available.  
**Status:** proposal for review only. No new game mechanics, equipment grants, XP, unlock RPC, production content, or release approval in this document.

## Founder-approved progression context

- **Level 2:** Traveler's Belt is first equipment appearance improvement.
- **Level 3:** Forgotten Crypt becomes available.
- **Daily bonus:** once-daily +1 XP after three eligible dailies; this is independent of the Crypt and must not be silently awarded through dungeon actions.
- **Level 4:** Wayfarer's Mantle is queued after Belt, not awarded by entering Crypt.
- No client-side claimed level may authorize content or reward ownership; Alpha must confirm a trusted progression readback. Exact level threshold mathematics and reward receipt are separate CEO/Alpha decisions.

## Existing implementation to reuse rather than replace

Draft PR #22, “Preview: Forgotten Crypt sentinel fight and run-only sigil loot,” already proposes the four-node adventure, Ember Charm gate, Crypt Sentinel, deterministic four-action combat engine, and **run-only Sentinel Sigil**. It stacks on PR #18 and PR #17, and remains draft. Its existing mechanics and run-only loot are the starting point: this spec is not approval to merge PR #22 or to turn run-only loot into a persistent item.

## A 30-second mobile entry flow (concept)

1. **Before eligibility:** Show a locked Forgotten Crypt card with descriptive Level 3 requirement, no Enter action or loot preview that implies ownership. Character remains unchanged.
2. **Trusted eligibility true:** Present a clearly actionable **Enter Crypt** button, route/map context and a short plain-language note that dungeon items belong to this run unless explicitly persistent in the backend.
3. **Within the run:** Reuse the existing rat → inscription → Ember Charm → Sentinel structure in the existing preview; preserve its combat and retry rules. One screen should communicate the *current* objective and one primary action, rather than four competing calls to action.
4. **On retreat/defeat:** Show a clear Resume/Retry or Leave option as supported by the existing state machine; do not silently reopen cleared nodes, mint XP, or restore permanent inventory.
5. **On completion:** Report the Sentinel result and run-only Sigil plainly. No persistent gear, Level 4 mantle, or XP notification without a server receipt expressly covering it.

### State-to-copy matrix

| State | Heading | Primary action | Guardrail |
|---|---|---|---|
| Locked | Forgotten Crypt — locked | None; show Level 3 requirement | Never unlock from browser-stored level |
| Available | Forgotten Crypt | Enter Crypt | Trusted server readback required |
| In run | Crypt expedition | Continue current node | Preserve current run and item scope |
| Defeat | Expedition ended | Retry or Leave (existing supported behavior) | No new awards on retry |
| Victory | Sentinel defeated | Review run / Leave | Sigil is run-only; no permanent reward inferred |

## Distinct readability and accessibility requirements

- At 320, 375, 390 and 430 CSS px, inspect complete entry card and current objective without requiring sideways scrolling.
- In the locked state, visually distinguish “requires Level 3” from a network error or disabled button.
- Focus order follows heading → requirement/status → primary action → secondary options; visible focus outline and 200% browser zoom are release checks.
- Telegraphs require **shape, contrast and a text alternative**, not color alone. Reduced-motion mode keeps the cue visible without animation. Charlie's frozen Ashen March enemy PR #30 is unrelated artwork and should not be reused as Crypt Sentinel canon without review.
- A run-only item must be visibly labeled **Run-only** in journal, reward and finish screens, never described as account inventory.

## Integration / QA gates — must be reviewed before engineering work

**Alpha:** Specify the trusted Level 3 eligibility source and failure behavior. Confirm that no dungeon/client event directly mints XP, daily bonus or equipment. Preserve legacy and versioned quest receipt compatibility.

**Beta:** Identify whether the existing Crypt preview already has entry-card, locked-state and resumed-run components; modify the minimum possible UI in a separate PR. Test mobile focus/zoom, stale eligibility, refresh, and retry as source-backed behavior. No claims of live device verification without screenshots.

**Charlie:** Review sentinel silhouette/readability only against the existing PR #22 design; supply precise changes only when evidence shows a defect. Avoid new art variants until CEO routes an approved request.

**Grok / CEO:** Challenge level-gating truthfulness, locked/available copy, temporary Sigil labeling and uniqueness of the 30-second action. Return named reviewer evidence, not an assumed bot response.

**Release gate:** Leave all Crypt PRs draft. No merges, migrations, signed-in Preview writes, or Production/Preview configuration changes until CEO verifies environment isolation, schema parity and receives separate authorization.
