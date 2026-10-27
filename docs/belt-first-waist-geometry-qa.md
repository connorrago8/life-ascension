# Belt-first waist: pixel-coordinate and mobile acceptance handoff

**Status:** Charlie UI-only feasibility notes; draft PR #34, no live renderer integration or entitlement changes.

## Coordinate system

HomeCharacter uses SVG viewBox 0 0 240 380. Existing decorative waist hardware currently paints unconditionally. Beta must **replace rather than overlay** these old paths during its separate renderer experiment.

| Piece | Stage | Geometry / evidence |
| --- | --- | --- |
| Cloth waist tie | Starter | Path `M88 201 Q120 206 152 201 L152 207 Q120 212 88 207Z`; width about 64 SVG units |
| Hanging tie end | Starter | Path `M120 208 L117 220 121 231 125 221 124 208Z`; hangs to y231 |
| Leather waist band | First belt | Path `M86 198 Q120 194 154 198 L153 213 Q120 210 87 213Z`; width about 68 units |
| Center buckle | First belt | Rect x110 y196, width20 height19; plus inner frame; high-contrast outline |
| Pouches | Not yet | Deliberately excluded at both stages |
| Diagonal strap | Not yet | Deliberately excluded at both stages |

## Phone-width QA matrix

At each viewport width below, take actual browser screenshots with the **same full-body figure scale**, side-by-side starter and first-belt states. Do not interpret structural source tests or zoomed crops as actual browser QA.

| Browser width | Check |
| --- | --- |
| 320 CSS px | Buckle still visibly separate from tunic and center seam; starter does not already look equipped |
| 375 CSS px | No belt overlap with hands, shirt or knees; tie legible |
| 390 CSS px | No waist shift between states; no clipping |
| 430 CSS px | Identical character silhouette and scale; only approved belt-stage detail changes |

**Scale math (not measured QA):** If full SVG renders at CSS width `W`, a 20-unit buckle renders at approximately `W/12` CSS px. Example: at W=120px the buckle is about 10px wide. Measure the real Home character CSS width; viewport width is not automatically avatar width. Do not claim 320px viewport equals 320px avatar.

## Review/ownership

Beta owns the separate reversible preview-only renderer experiment; Charlie owns the source SVG geometry and reviewing legibility; Alpha reviews authoritative item/loadout sourcing before any real unlock. No arbitrary XP-to-item mapping, save assertions, default earned belt, or Wayfarer's Mantle. PR #30 stays frozen; PR #34 stays draft until tests and reviews.
