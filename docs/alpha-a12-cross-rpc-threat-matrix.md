# A12: legacy/v2 daily-date, XP and bonus threat/compatibility matrix (DRAFT, SOURCE-ONLY)

**Owner:** Alpha CTO. **Task:** A-P1-A12-CROSS-RPC. **First assigned:** CEO BRIEF RECAP 2026-10-27 02:43 America/Chicago / 07:43 UTC. **Scope:** review-only contract and negative-test plan; no migration, RPC integration, hosted write, production change, or bonus implementation.

## CEO direction and compatibility boundary

The latest CEO recap approves PR #31's isolated player-local-date tests but **does not** approve replacing live Chicago day boundaries, enforcing a creation-date guard, or changing the existing two-day late-completion window. Founder A12 requires the player's own local day for dailies and the once-daily +1 XP bonus after three eligible dailies. Both statements must be reconciled in a future approved migration, not silently enforced by this document. Both legacy and v2 completion entry points must use one authoritative date policy before release. PR #31 stays draft.

## Read-only source inventory at PR #31 head 9015acaffd146c09a71625bae553483d41206dc5

| Source | Verified behavior / limitation |
| --- | --- |
| `supabase/migrations/202610230001_core.sql:2-6` | `profiles` has id, display_name, created_at but **no timezone field**. `quests` and `quest_instances` have independent server-created `created_at`; `xp_ledger` has unique `instance_id` and amount=1. No daily-bonus ledger in this schema. |
| `supabase/migrations/202610240007_daily_late_window.sql:12-33,37-61` | Create/ensure use Chicago server date. Daily start may be backdated up to 30 days; opened daily instance is clamped to today-2. `ensure_quest_instance` rejects daily dates before today-2. |
| `supabase/migrations/202610240007_daily_late_window.sql:66-107` | Legacy `set_quest_instance_status(uuid,text)` returns TEXT, locks owned instance, allows daily completion only Chicago today through today-2, skips future/schedule violations, and uses `xp_ledger on conflict(instance_id) do nothing`. An already-completed instance returns `completed` before checking active status. No creation-date guard. |
| `supabase/migrations/202610270001_quest_receipt_v2.sql:3-145` | Draft v2 `set_quest_instance_status_v2(uuid,text)` returns JSON receipt, locks owned instance, mirrors Chicago date checks, and confirms retry reward only when an owner-scoped XP ledger row exists. No creation-date guard or trusted player zone. |
| `lib/questDailyDatePolicy.ts:1-58` | Design-only `dateInTimeZone` / `evaluateDailyDatePolicy` supports IANA dates and optional creation-date guard. It accepts a caller-supplied timezone **and is not called by SQL or app**; therefore its passing tests are not authorization or runtime evidence. |
| `app/(app)/page.tsx:9,17,46-47`, `app/(app)/quests/manage/page.tsx:7`, `app/api/mcp/route.ts:19,49,146` | App date displays/requests and MCP descriptions still assume Chicago; home completion still calls legacy RPC. No claim that changing the helper changes these routes. |
| `tests/sql/quest_receipt_v2_smoke.sql:87-136` | Draft SQL tests already cover legacy→v2 and v2→legacy completion idempotency, plus lost-first-response retry. `tests/sql/quest_receipt_v2_concurrency.sh` covers two independent simultaneous sessions. These are isolated CI checks, not hosted parity. |

## Trust boundary: proposed, not implemented

**Server-owned source:** authenticated `auth.uid()` resolves one player policy record. The current `profiles` table has no timezone. Adding `profiles.time_zone` alone is **not** sufficient to call it server-owned because existing profile RLS allows authenticated owners to update their own profile. A secure design must explicitly define a server-validated IANA zone selection/enrollment mechanism, authenticated update permissions, audit history, and how often a player may change zones. It must not trust a request body, client browser timezone, arbitrary `p_time_zone`, or a spoofable header to authorize XP.

**Day identity:** calculate the player's effective local calendar day on the server from a trusted policy record and server time. The day/zone snapshot used to create or complete a quest and to award the daily bonus must be stable for the transaction. Define whether zone changes take effect next local day, after a cooldown, or at a fixed server instant; do not choose this silently. If a player legitimately travels, the UI may display local dates immediately, but reward-day changes must follow a documented anti-duplication rule.

**Cross-RPC invariant:** a single server function/policy (or identical shared database helper) determines date eligibility for both legacy TEXT and v2 JSON completion RPCs, plus create/ensure and any future bonus RPC. Leaving the legacy RPC callable with weaker checks creates a bypass even when v2 is correct. Keep legacy TEXT result shape unless an explicitly approved deprecation/version plan changes it.

**Created-after-target-day:** compare target due date with server-owned `quests.created_at` local date and, separately, `quest_instances.created_at` local date. Whether to reject a legitimately backfilled instance whose creation is later than its due date is a **behavior change requiring Founder/CEO policy review**; the CEO explicitly retained legacy two-day behavior for now. Do not silently tighten backdating. Use timestamps from database rows, not client payload.

**Bonus receipt:** the Founder-approved +1 XP after three eligible daily completions is **not implemented** by PR #31's per-instance ledger. A future once-per-local-day bonus needs a separate server-enforced uniqueness key, e.g. `(owner_id, reward_local_day, reward_type)`, with a trusted zone/day snapshot and atomic award. Decide what Undo/reversal does to the day's eligible count and whether a previously awarded bonus is reversed or remains immutable. No daily XP cap is approved.

## Adversarial matrix and acceptance fixtures

| ID | Attack / edge | Current evidence | Required negative / compatibility test before integration |
| --- | --- | --- | --- |
| A12-01 | Legacy complete then v2 retry, or v2 then legacy | Existing SQL smoke confirms one XP ledger row per instance | Repeat with same owner and an archived completed quest; legacy still returns TEXT; v2 confirms ledger but `xp_awarded=0` on retry. |
| A12-02 | Client submits arbitrary timezone to shift today | No server timezone column; helper accepts explicit zone | Simulate malicious `Pacific/Kiritimati` or `Pacific/Honolulu` request value; both RPCs ignore request zone and resolve identical trusted owner policy. |
| A12-03 | User changes timezone between two near-midnight completions | Not addressed by existing SQL | At fixed UTC instant, attempt double daily-clear bonus across zones; only one bonus ledger row under approved day-change policy. |
| A12-04 | Create quest after the target due day, then complete yesterday | Existing 0007 permits some backdating; optional TS guard only | Preserve existing behavior under legacy compatibility fixture; separately demonstrate opt-in guard would reject, and mark approval required before SQL change. |
| A12-05 | Create quest yesterday but instance today for yesterday | `quest_instances.created_at` separate from quest creation | Document whether guard uses quest-created, instance-created, or both; test both and verify expected grandfathering. |
| A12-06 | DST fall-back repeats local hour; spring-forward skips one | TS date helper tests DST, SQL still Chicago | Use real IANA conversion around 2026-11-01 and 2027-03-14; reward local day is date-only, not 24-hour-offset arithmetic. |
| A12-07 | Legacy and v2 disagree at local midnight | Both currently Chicago, so player-local policy not live | Two owners with different trusted zones at same UTC instant; both completion RPCs agree per owner, UI date agrees after integration. |
| A12-08 | Two or more completions race for same quest | Existing isolated two-session concurrency smoke | Exactly one ledger row; second v2 result `reward_confirmed=true`, `xp_awarded=0`; no second XP. |
| A12-09 | First completion committed but HTTP response lost | Existing v2 lost-response smoke | Retried v2 returns same `reward_awarded_at`, confirmed ledger-backed reward, zero *new* XP; UI never double-toasts. |
| A12-10 | Defer/resume/invalid action tries to mint XP or bonus | Existing v2 smoke for XP; no bonus feature | Both RPCs produce no new XP on defer/resume, and bonus count ignores these transitions. |
| A12-11 | Undo completed daily, then complete again | No Undo RPC in current receipt migration | Design explicit reversal ledger/status; replay must not grant extra XP or second bonus. Requires approval before implementation. |
| A12-12 | Third daily completion, duplicate request, and timezone hop | Bonus not implemented | Atomic once-only +1 bonus; retries return same bonus receipt; duplicate receipt never increments again. |
| A12-13 | Due date today-2 versus today-3 | Existing SQL smoke rejects today-3; compatibility retained | Verify both legacy and v2 continue accepting today-2 and rejecting today-3 under current policy; no silent window change. |
| A12-14 | Archived quest completed before archive | Legacy and v2 completed-state retry supported | Return confirmed prior completion without awarding again; new incomplete archived quest cannot complete. |
| A12-15 | Player tampers with profile timezone through normal authenticated update | `profile_update` RLS currently permits owner updates | If new timezone field is added, demonstrate that normal profile update cannot bypass trusted zone-change rules. |
| A12-16 | Missing/invalid zone or ambiguous timezone abbreviation | No zone stored; TS helper throws for invalid IANA | Server rejects/uses explicitly documented safe default without silently choosing browser timezone; test both RPCs. |
| A12-17 | Inconsistent UI and API local-day calculation | Home/manage/MCP hardcode Chicago | Static search + interaction test after integration confirms one player-local policy, no Chicago-only user-facing copy. |
| A12-18 | Production schema differs from isolated CI baseline | CEO observed hosted parity mismatch; PR31 migration is draft | Migration order/read-only parity evidence before any authorized hosted apply; no inference from isolated CI success. |

## Proposed implementation sequence (requires later approval; NOT work performed here)

1. Founder/CEO resolves timezone enrollment/travel effective-date rule and whether creation-date guard changes historical two-day backdating. Record exact decisions.
2. Alpha proposes a server-owned zone policy, permission model and audit trail. Security/Grok challenge profile self-update bypass and timezone hopping.
3. In isolated PostgreSQL only, introduce shared date-policy SQL helper; write failing-before tests for A12-02/03/07/15, then implement both RPCs together while retaining legacy return type. Test 0007 migration ordering.
4. Design separate once-per-day bonus ledger/receipt and explicit Undo semantics; Balance reviews thresholds and no duplicate XP; do not conflate quest XP and bonus XP.
5. Beta aligns home/manage/MCP date labels and durable retry UI only after trusted server contract exists. Charlie visual work remains independent.
6. CEO/authorized operator completes read-only effective Preview project-ref evidence for exact branch and independently reconciles hosted schema. No signed-in Preview writes, migrations, merges, env edits, or production deployments without explicit Founder authorization.

## P0 operator-ready read-only Preview isolation evidence form

**This is an evidence collection checklist, not a claim that isolation exists.** For each candidate Preview deployment record: (a) exact Vercel project/deployment ID, Git branch and commit SHA; (b) effective Preview environment scope and override precedence for `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, **without displaying secret values**; (c) derived nonsecret Supabase project ref from the effective URL, verified against Supabase dashboard project identity; (d) confirm Production effective ref remains `ugcvhmrriazbbymjxvch` and target isolated project is explicitly approved (restore-test candidate `njqwwimzrsunheehnnnt` is not proof by itself); (e) timestamped read-only dashboard screenshots or redacted metadata and operator signature; (f) independent Alpha review of **effective target**, not merely variable names or existence of branch overrides. Current known default vars cover BOTH Production and Preview; unrelated branch overrides do not establish isolation for PR31/PR32/PR36. A deployment build-time override and runtime resolution may differ: capture both or label runtime proof unavailable. Never run authenticated Preview DB writes to discover the destination.

## Review request and open decision

CEO/Security/Balance: challenge the proposed trusted timezone authority, legacy-v2 parity, creation-date compatibility, Undo and bonus uniqueness cases. **Recommended default:** keep PR31 draft and preserve legacy two-day behavior; approve isolated negative-test design only, defer any timezone/bonus SQL implementation until founder-approved policy and verified isolation. This document is a threat/compatibility review artifact, **not** a passing test or released behavior.
