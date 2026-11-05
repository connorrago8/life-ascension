# Hub destination presentation — November 4, 2026

Visual branch against integration candidate84, da857eb22f145c085109070bf13eb36d4d6b415b.
The new phone presentation uses static charcoal cards, existing pixel icons,
textual Preview/Open/Locked labels and distinct dashed locked borders. The
Wanderer stays decorative at its existing scale. Gold is reserved for rewards;
no reward framing or new artwork is introduced.

At widths up to600px, a content-sized grid replaces absolute map-node placement.
Cards reflow from two columns to one when their9rem minimum cannot fit; larger
text increases that minimum. Labels wrap and cards grow vertically. Targets
remain at least120px tall; entry actions48px. Bottom padding accounts for raised
navigation and safe area. The desktop map remains unchanged.

Direct-entry buttons use action-specific accessible names and no pressed state;
the unavailable destination retains its existing selection/description behavior.
Focus has a solid3px mint outline. Reduced motion disables card transitions;
ordinary motion uses only100ms surface/border changes, without moving content.

Routes, availability, run detection, save keys, XP, mechanics and existing
character/sprite assets are unchanged. This does not resolve QA82's save defects
or certify the integration candidate. No equipment overlay or animation added.

Verification: TypeScript, full source suite, guarded synthetic build, then real
sandboxed Chromium at320/375/390/430px. Browser checks nonoverlap,44px minimum
hit areas,200% root text sizing/reflow,focus,reduced motion,Town return and
Lantern preservation,Crypt preview query routing. An inherited cross-feature
Jetpack/Hub/Town save journey is also rerun. Screenshots are actual guest
localhost renders, not hosted Preview or iPhone Safari. CI keeps normal and
200% text screenshots as artifacts. Source-only concerns are not claimed as
observed faults in the previous build. Final CI/SHA and visual inspection
findings belong in the GitHub checkpoint.
