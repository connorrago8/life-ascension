# Phone-first Today's Board — design proposal

**Status:** Design only; pending Grok review. **Branch:** `feature/phone-board-design` from `main`. No implementation, migrations, production changes, or new XP pathways.

## Goals and constraints

- Make today's actionable quests easy to see and confirm on a phone, with one-hand use and accessible touch targets.
- Preserve server authority: only explicit confirmed completion invokes the existing completion RPC, which can award **exactly +1 XP per quest instance, once**. Progress, templates, deferral, and UI animation award **0 XP**.
- Daily completion is limited to the Chicago calendar date of today or the previous two dates. No older/future daily XP, even when a quest was created or rescheduled earlier. One-time overdue chores and early-completable goals keep their existing rules.
- Do not create a client-side XP ledger, offline completion queue, new privileged route, or alternate completion mechanism.
- **Implementation dependency:** This proposal uses RPCs from draft PR #1, not yet on `main`. The current `main` board inserts directly into `quests`; migration 0003 revokes that insertion, so the new board must switch to the approved creation RPC when the combined release is integrated. Login branch remains separately under integration review.

## Screens

### 1. Today's Board (default landing screen)

- Compact header: LIFE ASCENSION, Chicago date, avatar/level, lifetime XP, account menu.
- Top summary: **Due today**, **Overdue one-time**, **Upcoming**, **Completed** counts. Do not treat expired daily entries as ordinary overdue chores.
- Primary list: actionable quests for today, grouped by **Daily habits**, **One-time chores**, and **Goals**; each card shows title, domain icon, date, cadence, and status.
- Large, thumb-reachable **Complete** action per card (minimum 44 × 44 CSS px target; prefer 48px), secondary **Defer** and details actions. Completion never occurs from a swipe, card tap, or notification tap alone.
- Completed section is collapsible and shows confirmed completion, not a second Complete button.
- A clearly labeled **Previous 2 days** picker allows late daily completion within the Chicago window; never imply older days can earn XP.
- Empty, loading, stale-network, session-expired, and error states. A failed request must not visually claim XP.
- Mobile-first bottom navigation: **Today**, **Templates**, **Manage**, **Character**. Larger screens can show a wider layout without changing behavior.
- Use visible text and color-independent status cues, focus states, reduced-motion support, and screen-reader announcements.

### 2. Quest confirmation sheet

- Pressing **Complete** opens a bottom sheet naming the quest and **specific Chicago due date**.
- Copy: “Did you actually finish [quest] for [date]?” Actions: **Yes, completed** / **Not yet**.
- Explicit Yes starts a **10-second pending-cancel interval**. Show a countdown and prominent **Cancel**. The client does **not** call the completion RPC during this interval and does **not** add XP.
- At expiry, if still mounted, online, authenticated, and the action was not canceled, submit exactly one `set_quest_instance_status(instance_id, 'complete')` call. Disable repeated submits; show “Saving…” until the server responds.
- On success, refresh server-derived status and lifetime XP; show a small +1 XP acknowledgment. On error or uncertain network result, re-read server state before allowing retry; rely on server idempotency, not a local assumption.
- **Important:** Closing the app, switching tabs, background throttling, navigating away, or losing network **must not silently commit** the pending action. Cancel the local pending timer on unmount/visibility loss; the user can retry explicitly later. No background timer, service worker completion, or durable queued submission.
- If the due date becomes ineligible at Chicago midnight during the countdown, server rejection is authoritative; show the error without XP. Never redate to today automatically.
- A completed instance stays completed even after archive; the server returns idempotent status with no additional XP.

### 3. Templates catalog and review sheet

- Search/filter by domain; cards with title, suggested cadence, domain, and optional short instructions.
- Tapping **Use template** opens a **review/edit** sheet: title, domain, cadence, quest type (scheduled chore vs deadline goal), start/due date, and **Add quest**. No silent creation.
- Submission uses `create_scheduled_quest` once. Template definitions are static frontend data initially (no template table or template-management RPC).
- Creating a quest gives **0 XP**. The creation RPC also creates its first instance. For daily starts older than two days, the initial instance is clamped to Chicago today minus two days while the original start is retained.
- Duplicate template use creates distinct quests; optionally warn about matching active titles, but do not silently merge or award XP.
- The UI should label `daily` as a daily habit, `once + scheduled` as a chore, and `once + goal` as a goal. Do not offer weekly cadence until the backend supports it.

### 4. Quest details / management

- View schedule, historical instances, progress notes, and archived state where appropriate.
- Existing `rename_quest`, `reschedule_quest`, and `archive_quest` are **JWT/browser-only** in the draft branch; do not promise them through personal API keys.
- Confirmation of archive is separate from completion; archive preserves historical XP and blocks new XP.

## Tap flows

**Complete:** Today → Complete → “Did you actually finish?” → Yes → 10-second pending / Cancel → one server RPC → server confirmation → refresh XP. **Not yet** and **Cancel** make zero writes.

**Defer/resume:** Today → Defer/Resume → existing `set_quest_instance_status` action; no XP.

**Create from template:** Templates → select → review fields/date → Add quest → `create_scheduled_quest` → return to board and refresh. No XP.

**Late daily completion:** Previous 2 days → select the exact eligible date/instance → confirm → pending-cancel → existing status RPC. For an absent eligible instance, first use `ensure_quest_instance` (subject to active quest, start date, and server date validation). A pending canceled completion may leave an ensured instance but must never award XP.

## Initial template list

| Template | Domain | Suggested cadence | Quest type |
|---|---|---|---|
| Wash and fold laundry | home | once | scheduled |
| Do the dishes | home | daily | scheduled |
| Tidy kitchen counters | home | daily | scheduled |
| Take out trash | home | once | scheduled |
| Vacuum living space | home | once | scheduled |
| Make the bed | home | daily | scheduled |
| Go to the gym | physical_health | daily | scheduled |
| Take a walk | physical_health | daily | scheduled |
| Stretch for 10 minutes | physical_health | daily | scheduled |
| Brush and floss | hygiene | daily | scheduled |
| Read for 15 minutes | personal_growth | daily | scheduled |
| Journal briefly | mental_health | daily | scheduled |
| Review spending | finance | daily | scheduled |
| Pay a bill | finance | once | scheduled |
| Call a friend or family member | relationships | once | scheduled |
| Finish a personal project milestone | personal_growth | once | goal |

Suggested cadence is editable. Avoid claiming weekly recurrence, reminders, automatic verification, or streak preservation.

## PWA and iPhone home-screen plan

- Add a web app manifest with name/short name, `start_url: "/?view=today"` (or stable `/today` if implemented), `display: "standalone"`, theme/background colors, and purpose-built icons (192px, 512px, maskable where supported). Add Apple touch icon and relevant metadata.
- Ensure the shortcut lands on Today's Board after sign-in; authenticated users return to the intended destination. Never include auth tokens or API keys in shortcut URLs.
- iPhone: open the deployed HTTPS site in Safari → Share → **Add to Home Screen** → Add. The browser may offer **Open as Web App**. Other browsers/devices have different install menus.
- Start with **installable shell only**, no offline quest completion or background sync. The app requires network and a valid session to confirm completion.
- Cache only safe static assets; avoid caching private quest data, auth responses, or API-key material in a service worker. Prefer no service worker for MVP unless needed for installability on target devices.
- Test standalone launch, login redirects, iOS viewport/safe areas, keyboard behavior, dark mode, reduced motion, screen-reader labels, and expired sessions.

## Existing backend interfaces — no new XP paths

| UI action | Existing interface | XP effect |
|---|---|---|
| Load active quests and instances | JWT Supabase `quests`/`quest_instances` owner-scoped reads, or `/api/mcp` `list_quests` for connected AI | 0 |
| Show lifetime XP | `get_lifetime_xp` JWT RPC; `get_character_progress` for AI | Read only |
| Create a quest from template | `create_scheduled_quest(title,domain,cadence,date,quest_type)` JWT RPC | 0 |
| Open eligible daily instance | `ensure_quest_instance(quest_id,date)` JWT RPC | 0 |
| Confirm completion after pending window | `set_quest_instance_status(instance_id,'complete')` JWT RPC | Server grants at most +1 |
| Defer / resume | `set_quest_instance_status(instance_id,'defer'/'resume')` | 0 |
| Progress note | `add_quest_progress` | 0 |
| Rename / reschedule / archive | `rename_quest`, `reschedule_quest`, `archive_quest` JWT RPCs | 0 |

Service-role and `*_as_user` wrappers are for the existing API-key/MCP path only, not for direct browser calls. Never expose `SUPABASE_SERVICE_ROLE_KEY` to the PWA.

## Free-tier considerations

- Static templates and an installable shell have negligible recurring infrastructure cost.
- Use existing Supabase RPCs and database constraints, avoid polling and paid push providers; refresh on navigation/focus and after confirmed actions.
- Counts should be derived from authoritative rows; a large quest history may need pagination later. Avoid assuming that all history fits in a single default Supabase response.
- Keep the 10-second timer in UI memory only; no database job or queue required.

## Phase 3 — Grok's morning summary

Grok can deliver a scheduled morning message using its existing scheduled routines at no additional messaging cost. Once connected to LIFE ASCENSION, it can call authenticated `POST /api/mcp` with `tools/call → list_quests` and its personal API key. No paid SMS, push service, or separate outbound scheduler is required for that path. A follow-up reply describing completed quests must still result in explicit confirmed completion through `submit_completion` (`confirmed_complete: true`), not an automatic XP award from ambiguous language. Treat API keys as secrets; never include them in summaries or logs. Verify scheduled-routine reliability and token configuration before claiming operational readiness.

## Acceptance criteria before implementation release

1. Home-screen shortcut opens today's board after sign-in; no secret in URL.
2. Big touch targets, keyboard/screen-reader support, clear date and status.
3. First tap never writes completion; second explicit confirmation starts the pending countdown, still no write.
4. Cancel within 10 seconds, background, navigation, or lost connection yields no completion RPC and no XP.
5. Expiry triggers one RPC; rapid taps, retries, and concurrent devices cannot award more than one XP per instance.
6. Midnight rollover and DST use server Chicago date; daily today-3/future rejected even when UI stale.
7. Templates create quests and initial instances without XP; scheduled chores/goals behave according to existing rules.
8. Archived quests cannot earn new XP; already-completed archived instances remain idempotent.
9. API-key and JWT users cannot cross-read/write another owner's quests; service-role key never appears in browser.
10. Free-tier deployment needs no paid messaging, push, or background completion infrastructure.

## Open design questions for review

- Is a **10-second delay after explicit Yes** acceptable for every completion, or should the timer be optional? Default proposal: always enabled.
- Should the board show all eligible daily instances from the previous two days, or only on demand? Default: on demand.
- Should overdue one-time chores appear above or below today's daily habits? Default: below today's actionable items, but with an obvious overdue count.

**No implementation is authorized by this document.** Merge only after review, and separately from Grok's ongoing draft PR #1 login integration.
