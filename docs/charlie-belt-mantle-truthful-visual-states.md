# Belt → Mantle: truthful character appearance contract (draft)

**Source of policy:** Founder chose Traveler's Belt at Level 2, Crypt at Level 3, Wayfarer's Mantle at Level 4. Mantle is now *queued*, superseding older HOLD wording; not approved for premature release. Separate founder rule: +1 XP once daily after three eligible daily quests. None of these policy decisions alone proves that a player currently owns an item.

## Four distinct concepts

| UI status | Meaning | Rendering / wording |
| --- | --- | --- |
| Starter | No level-granted item verified | Plain cloth waist tie; no belt hardware, no mantle |
| Locked | Trusted server policy says not yet eligible | Silhouette/outline only in catalog, with explicit level requirement; **never show on worn character** |
| Earned / available | Trusted server inventory confirms grant, but not equipped | Named item in inventory with "Equip" action; character still shows previously equipped appearance |
| Equipped | Server confirms item belongs to account *and* is equipped | Render that visual overlay, with a persistent equipped indicator |

**Missing/stale/failed server read is UNKNOWN, not Earned.** On UNKNOWN, don't infer belt or mantle from locally stored level, optimistic progress, toast, or a previously viewed demo. Do not call a cosmetic equipped when the render actually shows it only for preview.

## Visual sequence and composition

| Milestone | Appearance delta | Explicitly excluded |
| --- | --- | --- |
| Base character | Recognizable face, body, plain waist tie | Starter already rich with upgraded buckle/pouches/strap |
| Level 2 Traveler's Belt | Swap tie for leather belt and legible centered buckle. Keep torso silhouette, face and hands stable | XP bonus, extra strength, pouch or charm unlock without approval |
| Level 3 Crypt | Dungeon availability changes in navigation, not the avatar silhouette | No automatic shoulder/mantle or permanent Crypt Sigil |
| Level 4 Wayfarer's Mantle | **Proposed future cosmetic** drape layer behind upper arms with recognizable head and waist visible; actual art/render requires approval | No auto equip, no automatic upgrade on reaching level, no gameplay stat claim |

The precise mantle geometry is **not** authorized as a completed asset in this contract. It must avoid concealing the Level 2 belt; Beta should verify the layering order: back cloth, legs, torso, belt, front arms/face. Any alternate mantle shape requires separate evidence-based design review.

## Data boundary (review proposal, not currently implemented)

A single **server-authoritative** response should distinguish eligibility, inventory ownership and equipped slot. For example, a typed response shape might contain `currentLevel`, `eligibleItemIds`, `ownedItemIds` and `equippedItemIds`, plus request revision/version; exact field names and semantics are **proposed**, not existing RPC guarantees. Display only confirmed status; if entitlements fail to load, show a recoverable "Equipment unavailable" state. Verify that the server, not the browser, grants once and only once. Retry or refresh must never mint gear.

Alpha owns ownership and idempotency; Beta owns safe UI readback and reversible visual rendering; Charlie owns visual consistency and small-screen legibility. Do not equate `Appearance.belt` color with item ownership, and do not turn Beta's optional `beltPreviewStage` screenshot prop into an authorization path.

## Acceptance tests

1. Signed-out/demo/static fixture: labels read **Concept / not owned**; no persistent grants.
2. Locked trusted player: equipped Belt/Mantle overlay absent even if a client modifies displayed level.
3. Earned but unequipped: item in catalog, avatar unchanged.
4. Equipped Belt: belt visible, mantle absent. Equipped Mantle: belt and mantle both visibly present if both confirmed equipped.
5. Network timeout/old receipt: no new XP, unlocked art, or equip state inferred; clear retry.
6. At 320, 375, 390 and 430px, compare color/grayscale, weapon props, reduced motion, and real 200% browser zoom. Level 2 belt may be subtly different from plain tie in grayscale: Beta independent acceptance is pending.
7. Daily bonus and Crypt rewards are not conflated with cosmetic grant; never display an unsolicited XP toast.

This is design handoff only. No migrations, stat changes, item grants, deployments or merges authorized.
