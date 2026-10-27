# Belt-first UI state contract (review only)

Founder decision: first visible equipment progression is **belt first**, not a shoulder guard. The Wayfarer's Mantle remains on hold.

## What this change implements

- `lib/preview/beltProgression.ts` exports a pure presentation mapping for `starter` and `equipped` states.
- Starter shows a **plain waist tie**, not ornate starting gear.
- First belt stage replaces the tie with a **leather belt and buckle**.
- Pouches, diagonal straps, charms, stats, XP, levels and grant/ownership rules are **not implemented**.
- `tests/belt-progression.test.mjs` checks the intended states; CI typechecks the TypeScript contract.

## Why it is isolated

Current `HomeCharacter.tsx` already paints a belt, buckle, two pouches and a diagonal strap for every character, regardless of equipment. `Appearance.belt` is only a color field. This PR deliberately **does not change the live renderer, catalog, equipment slots, persistence or Supabase**.

## Proposed Beta integration gate (not approved in this PR)

1. Choose a source-of-truth equipment state; do not derive earned items from client XP or preview level.
2. Implement two conditional waist paint layers in `HomeCharacter`, retaining existing body proportions and accessibility labeling.
3. Show starter and earned states at **320, 375, 390, and 430 CSS px** with screenshots. Make differences identifiable in grayscale.
4. Keep future hardware modular and cumulative. Do not assign first unlock timing or cosmetic combat effects without Founder/CEO direction.
5. Add server-backed entitlement and test no unauthorized display before a real release.

This is a **draft UI contract**, not a merged feature, game implementation, or verified mobile design.
