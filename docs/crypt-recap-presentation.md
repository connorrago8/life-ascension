# Crypt recap presentation

Display-only child of Systems106. Current combat screenshot from run42088582899 at390px was visually inspected; no baseline recap render was available in that artifact. This package advances the separate existing end-of-run UI, without claiming an observed recap defect.

## Production changes

`RunRecapView` retains existing tracked result/reward/summary facts, save-mode wording, pending-vs-confirmed vault messages, explicit Wear explanation and both action handlers/targets. A decorative32×32 SVG slot emblem is displayed at96×96 CSS pixels (3×). Four neutral silhouettes cover existing weapon/helm/armor/shield; they are not item portraits, new gear, equipment overlays, rarity or ownership markers. Each uses two crisp integer-coordinate paths, charcoal framing, muted steel and upper-left pale highlights. Actual item name/rarity/bonus/passive remain textual authority.

The reward card uses intrinsic flex wrapping:96px art plus12rem text basis. Narrow screens and enlarged root text wrap naturally; no device-width font reduction. Summary uses an intrinsic minimum8rem column with Gear spanning full width. Actions retain48px minimum height, wrap text and show a mint keyboard-focus outline. Existing no-preference entrance motion remains; reduced motion explicitly disables title/card animation. No sound, timer, random reveal, glow, loading gamble or new interaction.

`RunRecap.css` is scoped under.recap and overrides presentation only; engine, catalog, reducer, save callbacks, XP/streaks, backend/auth and navigation routes are untouched. Existing QA harness adds finite known boss-item and pending-confirmation display fixtures; route remains development-only and production404 guard unchanged. Fixture confirmation is synthetic, not an account operation.

## Verification

Mandatory browser fixture covers victory/defeat at320/375/390/430px, normal and200% root text, reachable44px-or-larger controls clear of overlays, unclipped text, keyboard focus/order, reduced motion and unchanged localStorage. Checks4.5:1 computed contrast for reward label/name/status against the actual opaque reward card. Separately checks synthetic vault pending wording and captures the other three slot emblems. All external/nonread requests are blocked; screenshots are exact-head CI artifacts. This is not natural victory, authoritative vault persistence, native zoom, iPhone Safari or VoiceOver verification.

Baseline source tests continue checking provenance, loot retention, Wear and absence of automatic equipment actions. Final run/commit outcomes belong in the PR/checkpoint, not inferred from source. No release authorization, native simulator, merge, manual deployment, visual Bible update or production-data operation.
