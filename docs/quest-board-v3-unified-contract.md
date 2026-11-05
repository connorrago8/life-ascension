# Quest Board 3.0 — Founder-approved integration contract (2026-10-31)

This branch begins a **single coordinated feature build**. The engine is additive and **not wired to production** yet. Do not deploy/merge until integration, migrations, CI, and iPhone Safari acceptance pass.

## Locked behavior
- Chicago 05:00 daily population; adaptive displayed count starts 5 and trends toward 10 out of 25; initially 3 random / 2 personalized. Off-board recognized habits can be completed via tap/chat/voice and earn +1 XP once per cadence period.
- Per-quest streaks, no user-facing streak settings. Missing required daily completion resets that habit's streak. Never silently grant grace days.
- Weekly quest order/reveal randomized Monday through Wednesday 14:00 Chicago; all visible by cutoff. Friday 17:00 onward, ask on login about unfinished quests: Completed / Pending / Ignored. Unresolved quests prompt next login after week rollover; preserve attribution to original week.
- Five completed displayed dailies unlock three random optional bonus choices; one free daily reroll; no duplicate awards or penalty for ignoring.
- Completed quests move into collapsed Completed Today; individual streak displayed beside quest.
- Home: level/XP, quest progress, streaks, upcoming rewards, evenly spaced Needs Your Input at bottom above navigation. AI Chat lives only under More, no floating button.
- AI may add 3–5 new quests weekly as a guideline with New badge; editable, disable, Never Suggest Again, preference feedback. Existing habit commitments must not silently change.
- Long-term Goals within Quest Board/Main Quests; milestone and linked quest progress plus manual accomplishments. Rewards predetermined; default estimated label, expandable **stats** preview (not stars).
- Sunday review: suggestions plus minor automatic adjustments, approval for significant changes.
- Calendar analysis **on login**, suggestions not mandatory until accepted. Calendar and health integration require explicit scopes/consent; de-duplicate mirrored Oura/WHOOP/Apple Health events. Hybrid reminders, gentle optional push/calendar notifications.
- AI Companion supports text, voice, quick actions; editable Player Profile. Fantasy narrative optional Adventure Mode later; ordinary task labels plain.
- +1 XP per quest completion, existing level curve unchanged; preserve exactly-once DB enforcement.

## Integration checklist / release blockers
1. Wire pure engine to existing quest persistence/UI without replacing established tables blindly; inspect current schema and RLS.
2. Add SQL uniqueness on (user_id, quest_id, cadence_period) and transactional XP award; verify cross-session concurrency.
3. Persist daily selections and weekly reveal schedules server-side; deterministic helper alone is not sufficient for edits/timezone changes.
4. Implement late weekly resolution against **original** week, with distinct Pending and Ignored statuses. Never award historical XP to wrong period.
5. Add per-quest streak calculation from complete history, bonus reroll persistence, goals, reward stats, AI suggestions, Needs Your Input and More chat.
6. Add authenticated Google Calendar OAuth and event sync on login; separate Apple Calendar display from Apple Reminders; explicit consent and duplicate filtering.
7. Push and scheduled reminder infrastructure requires permission and delivery testing; health providers need separately verified API/data access.
8. Add automated tests for DST, 05:00 boundary, Wednesday 14:00, Friday 17:00, idempotency, off-board completion, and weekly rollover.
9. Test 320/375/390/430px, iPhone Safari, VoiceOver, offline/refresh persistence, protected Preview and QA isolation.
10. Independent QA and explicit release authorization before merge or deployment.

## Implementation status
- [x] New additive TypeScript scheduling/selection engine committed.
- [ ] Integration with app routes/components, database, AI, calendar, reminders, health, and rewards.
- [ ] Automated test execution and independent acceptance.
