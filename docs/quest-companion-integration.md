# Quest / companion integration candidate

Status: implemented on an isolated integration branch; approval and hosted activation pending.
Base: PR117 `db8afbf80766859fd54d72c799dbe6bedd98574f`, including PR116 `eeeda20151cc76700113d76be80e76ad85412851`.

## File boundaries

| Owner | Boundary | Integration contract |
| --- | --- | --- |
| Quest Systems | quest scheduling, per-quest streaks, canonical quest instances and XP ledger | Personal completion1 XP; companion attribution upgrades the same instance to2 total. Preserve unique instance ledger and server ownership. |
| Companion | companion migration/RPC, consent, private reward projection and companion page | No reward payload before acceptance; shared status only within active consent. |
| Quest UI | Home / Quest Board layout, typography and shared visual components | This candidate changes only Home entry/copy plus secondary navigation; carry these through future UI changes. |
| Integration (this candidate) | Home companion link, secondary navigation, isolated browser gateway/journey and CI receipt | No new schema, ledger logic, quest cadence or visual assets. |
| Independent QA | external review and actual-auth acceptance | This candidate and PR117 were authored by this agent; its tests are not independent approval. |

These are file boundaries, not assignments or claims that another agent has accepted work.
The unrelated legacy gameplay PR stack is excluded. No duplicate companion or quest backend is introduced.

## Product changes

- Signed-in account Home exposes **Open companion inbox** before Quest Board. The development-only layout preview omits this account entry.
- **More → Companion inbox** provides an entry from account navigation and marks More current on the companion route. Existing Back to Home remains unchanged.
- Home states the personal1 / accepted-companion2-total rule without falsely promising that every accepted task is worth only1.
- Navigating away uses ordinary routes and reloads the server-backed XP value. No local XP replica, bonus or auto-completion is added.

## Executable demonstration

The CI browser uses two synthetic identities and a localhost-only gateway. Every Home read/RPC and companion RPC executes actual isolated PostgreSQL with `authenticated` role and per-request `auth.uid()`; gateway results are not mocks. This tests UI/API/SQL integration, **not** real Supabase Auth, PostgREST wire compatibility, hosted Preview or iPhone.

1. Connor returns from Companion to Home. Home is the selected primary item.
2. Create **Put away the laundry** as a one-time real-life task; confirm completion. Home shows1 lifetime XP.
3. Use Home's companion entry; create private invitation, request join as Izzy, confirm account as Connor.
4. Izzy sends a different quest with a mystery promise. Pending recipient payloads contain no secret; HTML-like title is literal text.
5. Accept/reveal and complete twice: one task credits2 total. Connor has3 XP; Izzy0.
6. Izzy sends **Put away the laundry**. Accepting reuses the completed personal instance and upgrades its1 credit to2. Connor now4, never5 or6.
7. Back to Home and reload:4 remains. More → Companion inbox returns to the same two completed tasks. Izzy remains0.
8. Check Home entry at320/375/390/430px with enlarged root text; retain the companion page's existing four-width/normal/enlarged checks.
9. Final SQL receipt requires exactly two Connor ledger rows,4 XP and two completion events; neither other actor receives XP.

The fixture compiler only permits the explicit Home tables, selected columns, bounded filters and four RPC signatures. User strings are SQL literals; arbitrary tables, filter fragments, writes and actor/XP arguments are rejected. It is test-only and never imported by application code.

## Hosted demo gate — outstanding

- Verify candidate head SHA, CI checkout SHA, Preview metadata SHA and deployed route separately.
- Independently review consent/RLS/XP changes. No self-approval.
- Verify a specifically isolated nonproduction database and approved migration path before applying anything. A project name alone does not prove isolation.
- Use existing authorized Preview access; preserve SSO/protection. No share links, bypass credentials or production environment changes are introduced here.
- Execute the checklist with two actual consenting test accounts against live Auth/PostgREST; inspect recipient network payloads, actor totals, reload and second-device persistence.
- Daily5-of25/05:00 refresh, weekly timing, streak/grace behavior, manual Izzy logging/provenance and weekly companion totals are separate unfinished work. This candidate does not claim those exist or satisfy the complete issue115 definition of done.
