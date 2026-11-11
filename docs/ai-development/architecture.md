# Architecture

Life Ascension is a Next.js 15 App Router app (`next` `^15.3.0`, React 19, TypeScript 5.7). `npm run lint` is `tsc --noEmit`. There is no separate ESLint script. Tests are `node --test tests/*.test.mjs` and import `.ts` sources directly.

## Directories

- `app/(app)/` — signed-in screens: home, quests, play, companion, character.
- `app/api/` — route handlers, including companion draft and photo proof.
- `components/` — shared UI. Companion nav and role live in `components/CompanionNav.tsx`, `components/useCompanionRole.ts`, `components/RoleRedirect.tsx`.
- `lib/` — pure rules: `lib/level.ts` (quest XP curve), `lib/questStreak.ts` (5:00 AM America/Chicago game day), `lib/companionAccess.ts` (role and redirects), `lib/crypt/` (delve combat).
- `supabase/migrations/` and `supabase/rollbacks/` — SQL. A migration is not applied because the file exists.
- `scripts/verify-deployment-env.mjs` — fails a Vercel build that points at the wrong Supabase project or an unlisted preview branch.
- `tests/` — unit tests. `tests/sql/` is not part of `npm test`.

## Auth and roles

Supabase Auth. The client uses the public URL and anon key. Privileged database URLs and the service-role key are production-only and must not appear on Preview (`scripts/verify-deployment-env.mjs`).

`companion_state()` decides the bond. `roleFromCompanionState` in `lib/companionAccess.ts` returns `companion` only when the caller is signed in and the bond is `active` with role `companion`. Every other signed-in result, including a missing bond, is `adventurer`. `components/useCompanionRole.ts` calls that helper. If the RPC returns an error, the code passes `bond: null`, so the user is treated as an adventurer. That is the current code on beta, not a guessed bug.

Companions are sent away from `/`, `/quests`, `/play` (except `/play/crypt`), `/character`, `/health`, and `/settings`. Adventurers are sent away from `/companion/home`, `/quests`, `/rewards`, and `/character`. `/companion` stays open as the invite screen.

## Quests and XP

Quest XP is server-side. The game day starts at 05:00 America/Chicago (`lib/questStreak.ts` and `public.quest_game_day`). Do not recompute eligibility in the browser and then trust it for rewards.

Crypt XP is a separate tenths cap inside `public.record_crypt_floor_clear` (`supabase/migrations/202610300001_crypt_delve.sql`). The day's cap is the count of `xp_ledger` rows for that Chicago date. Do not change that function or `crypt_xp_daily`.

Real-life quests are the only permanent combat power. Dungeon rewards that are still being designed are temporary or cosmetic. Gear the player owns is worn only by an explicit Wear action.

## Companion

Izzy's companion shell is Home, Quests, Rewards, Character. There is no Play item (`lib/companionAccess.ts`). The older `/companion` page still holds the invite, Just type, the live board for Connor, notices, the off-day planner, and repeating chores. Companion 2.0 added the shell; it did not delete `/companion`.

## Delve

`/play/delve` is the card run. Release 1 (merged) made a floor a registry entry so a clear does not have to end the run. With only floor 1 registered, clearing it still ends the run. Browser saves are versioned in `lib/cryptActiveRun.ts`. Account resume was not added: on TEST, `adventure_run_saves` allows authenticated SELECT only.

## What not to rebuild

Do not turn combat into real-time. Do not give the companion account the adventurer RPG. Do not add a feature branch to `PROTECTED_QA_BRANCHES` to get a preview.
