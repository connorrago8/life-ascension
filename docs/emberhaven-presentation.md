# Emberhaven destination presentation

Visual branch based on QA90 a425301f49352db6bc2f030e48306a1f2b0366df.
Presentation only; the known completed-boss recovery failure remains visible in
inherited CI and is owned by Gameplay. No gameplay or TownVisit save changes.

## What changes
Six decorative rectilinear SVG landmarks on a32px/two-pixel grid replace Unicode
marks. They are code-native assets,not generated raster sprites. Names and existing
purpose text remain outside art; links retain all six routes and accessible names.
Each link describes its purpose through aria-describedby. Scoped CSS supports
normal two-column cards and automatic one-column reflow at200%root text. Strong
mint focus outline,quiet charcoal surfaces,and static reduced-motion feedback.
No asset request,background animation,new service,power or equipment appearance.

## Verification
Local TypeScript and829source tests passed before publication. Exact-head CI runs
sandboxed localhost Chromium at320/375/390/430px plus200%root-text states,with eight
screenshot artifacts. Assertions cover named routes,44px targets,nonoverflowing
names/details,keyboard focus,overlay clearance,zero-motion,keyboard/touch entry,
missing glyphs,and unchanged Lantern/unrelated storage. Existing cross-feature
suites retain Brain Rot/Hub/Town save coverage. No native simulator/iPhone Safari,
VoiceOver or hosted acceptance. CI screenshots require actual visual inspection;
source-only fixed-grid/small-text concerns were not claimed as rendered defects.

## Boundaries and next
No BrainRotDungeon,core,games,TownVisit,quest,XP,account,auth or Preview guard edits.
The exact-head gate must stay red while QA90's terminal-recovery case fails.
Next visual review: inspect390normal/large-text screenshots and verify other widths
through artifacts. Separate owner terminal repair and independent QA remain needed.
