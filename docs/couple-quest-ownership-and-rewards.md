# Couple quests: ownership and rewards

## Confirmed household rule (2026-11-12)

- Cooking dinner is normally **Izzy's individual activity**, not an automatically assigned shared quest for Connor.
- Connor helping with dinner is **not** a standing daily/weekly quest.
- A dinner-help reward may be **earned and redeemed by Izzy**; redeeming it should request Connor's participation, not silently complete a quest or assign an obligation.
- Shared quests require genuinely joint participation (e.g. a date, a walk, an agreed activity). Each person marks their own part. Preserve separate XP ledgers and server-side once-only awards.
- Never auto-create a shared cooking quest from the starter pack. Replace the proposed `Cook dinner together` pack item with a truly shared activity when the couple-feature branch is integrated.
- Reward eligibility, pricing, consent, redemption state, and any assignment mechanism must be implemented and tested before a redeem button is shown. Do not imply this reward is already functional.

## Release acceptance

1. Neither account receives `Cook dinner together` as a default shared quest.
2. Izzy can record her own dinner activity without Connor's participation.
3. An optional dinner-help reward is visible only when actually supported by the rewards system and is never automatically imposed.
4. No double XP on repeated completion or redemption.
5. Test with both real account roles; no preview/mock state counts as verification.
