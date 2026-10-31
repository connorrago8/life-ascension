# LIFE ASCENSION — Approved Gameplay and Integration Contract

Status: Founder-approved development scope, 2026-10-31. This document defines implementation targets, NOT a claim of completed features. No production merge or deployment authorization.

## Locked product rules
- Emberhaven is a persistent, eventually walkable fantasy town. Story victories unlock opportunities; players decide construction and upgrades. No missed-day penalties.
- Forgotten Crypt is a card-battler roguelite with branching paths, roughly three upcoming rows visible, readable encounter types with occasional mysteries, parchment/atmospheric visuals. A single successful complete run unlocks Whispering Woods permanently. Loss resets temporary run state only; leaving app or town navigation does not count as loss.
- Whispering Woods is a distinct room-by-room procedural roguelite using WildDice: D4/D6/D8/D12/D20, customizable faces, temporary mutations, deterministic effect chains, poison/ignite/echo interactions. A full successful Forest run unlocks the next chapter.
- Runs should be resumable, approximately 15–45 minutes in typical play, not subject to a hard timer. Run lifecycle: start, save, resume, victory, death, explicit abandon. Account-owned saves and atomic transitions.
- Character is persistent across adventures. Classes selected before each run affect only starting deck/dice loadout, not permanent attributes or identity.
- Exactly three permanent attributes: Vitality (additive percentage max HP), Power (percentage offensive result applied once after combo resolution), Fortune (rare discovery chances and occasional additional reward choices). Free respec between runs, unlimited specialization, no diminishing returns. Exact balance constants configurable.
- Automatic baseline HP/offense growth by level. Attribute points on configurable milestones approximately every three levels, with possible bonus milestones; award exactly once.
- Real-life quests remain primary XP source at +1 XP per completed quest under existing exactly-once contract. Optional first-time major adventure achievements may award small nonfarmable XP only after explicit contract extension. Meaningful real-life milestones may sometimes grant optional town resources/cosmetics.
- Early areas do not automatically scale to cancel earned strength. Deeper areas and optional difficulties provide challenge. Crypt replayability: discoveries, collections, optional modifiers, rare encounters, cosmetics, achievements, build experimentation.
- Town construction is player-directed after story unlocks; begin with curated building plots and simple resources. Buildings add services and choices rather than unbounded power. Home decor and elaborate NPC schedules are later priorities.
- Mobile-first iPhone Safari, accessibility, reduced-motion options, clear combat feedback. Keep deterministic engines separate from visuals.

## Implementation guardrails
- Preserve existing quest XP, security/RLS, and gameplay until verified replacements are ready.
- Never interpret navigation or browser closure as death/abandonment.
- Run saves must preserve seed, RNG progress, map, encounters, combat state, temporary inventory, and version; support migration/rejection of incompatible saves safely.
- Permanent rewards and unlocks are account-scoped and exactly-once. Do not duplicate XP on retry or replay.
- Avoid overlapping Grok-owned files without branch/head reconciliation and explicit coordination.
- No production merge, deploy, destructive database operation, or secret change under this scope.
- Do not treat illustrative boss names, floors, numerical bonuses, resource costs, or NPC dialogue as locked design.

## Delivery sequence: 30 tasks in six batches
1. Reconcile repository/branches/PRs and establish exact integration baseline.
2. Versioned design and state contracts (this document is the initial design contract).
3. Durable adventure run saves and restoration.
4. Explicit run lifecycle and safe town/adventure navigation.
5. Persistence, concurrency, account-isolation and security tests.
6. Crypt encounter, map, ending and content audit.
7. Deterministic branching Crypt map improvements.
8. Three-row atmospheric Crypt map UI.
9. Full one-run Crypt victory and idempotent completion.
10. Crypt collections, first-clear and optional difficulty framework.
11. Vitality/Power/Fortune attributes.
12. Configurable level-based base growth.
13. Exactly-once configurable attribute point awards and respec.
14. Pre-run class/loadout selection.
15. Unified quest/adventure XP and permanent reward ledger.
16. Walkable Emberhaven vertical slice.
17. Account-owned story/world/building state.
18. Transactional town construction and resource economy.
19. Functional first Blacksmith, Market, Guild interactions.
20. NPC/story reactions and Crypt-to-Forest unlock sequence.
21. Procedural Forest room navigation.
22. Deterministic WildDice combat.
23. Dice shapes, customizable faces and loadouts.
24. Mutation/effect queue, combos and bounded resolution.
25. Forest content, final boss and next-chapter completion.
26. Shared adventure UI/navigation.
27. Animation/art/presentation improvements.
28. iPhone touch, performance, accessibility, reduced motion.
29. End-to-end regression, security and gameplay QA.
30. Exact-head integration and protected Preview release candidate; production release only with separate approval.

## First acceptance milestone
Complete a real-life quest (+1 XP), enter Crypt, save and resume after closing Safari, win a complete Crypt run, claim first-clear once, return to Emberhaven to see permanent changes, and enter unlocked Forest. Loss must reset temporary state but never permanent progression.
