# Crypt combat resources — visual implementation

Owned branch: visual/crypt-combat-resources-20261105. Base QA93 6b98033bc7680155ab861c2782b7af61bb83d6ec.

Battle-only CSS module: readable numeric current energy (including zero and overflow), decorative diamonds, reflowing 8rem-minimum hand cards, wrapping pile controls and larger labels. Existing charcoal/mint/gold palette, reduced-motion behavior and combat actions remain. No engine, XP, storage, routes or Brain Rot changes.

Browser contract: sandboxed localhost Chromium, blank backend environment, same-origin GET/HEAD only, deterministic engine-created five-card combat fixture. Four widths320/375/390/430, normal and200% root font; inspect target bounds/clipping/overlays, focus, reduced motion, unchanged state after inspection, and actual End turn compared with pure reducer. Zero/7energy are authored display fixtures, not claims of earned resources. Eight render artifacts. Native zoom, VoiceOver, iPhone Safari, hosted Preview, full natural run and independent acceptance are outside this test.

The new browser test runs before the existing failing stale-tab suite. All existing boss/reliability failures stay blocking. Candidate is not release-approved. Hosted QA branch protection is retained; no manual deployment or production operation.
