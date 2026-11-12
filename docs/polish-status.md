# Polish status

## Done (UI)
- NextPieceProgress component
- UnlockCelebration banner
- BondMilestones badges
- Reduced-motion CSS overrides
- Empty-state and domain-chip styles
- CollapsibleCompleted component (ready to wire)
- AdventurerCosmeticTrack on Character screen
- Dark visual system for both modes

## Needs wiring (small)
- Drop CollapsibleCompleted around completed rows in quests/page.tsx
- Drop NextPieceProgress + UnlockCelebration + BondMilestones into companion Home
- Use empty-state class on empty lists
- Use domain-chip class on quest domain labels

## Needs server
- companion_log_activity signature confirmation (XP + backdate)
- Connor Wear persistence RPC

All UI pieces are on the branch and styled. Server items are blocked on RPC confirmation.
