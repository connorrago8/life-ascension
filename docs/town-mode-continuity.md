# Hub / Emberhaven development-mode continuity

Systems increment over Visual98 `da4fa16cb223c1109d326160055556f1dbfbf388`.
Source inspection found Hub's Crypt entry preserved preview=1,while Town entry,
landmarks,guided links and returns used plain targets. Dropping this marker can
change the Crypt loader's owner context from preview to guest/account,so a valid
preview run becomes unavailable to Continue without being deleted. No prior
rendered reproduction is claimed from that source observation.

navigationModeHref carries only an existing preview=1 marker in development
across authored internal paths. It preserves destination query/hash and explicit
preview overrides;external/protocol-relative/same-page links and normal/production
navigation are unchanged. It forwards no other source parameters. It does not
grant preview access or change destination authority/authentication gates.

ModeLink renders a real href,refreshes it after route hydration,and reads the
current URL again on activation. Ordinary activation routes to the fresh target;
modified native activation receives that target on the anchor. Prefetch is off
for these scoped links. InAppBackLink uses the same mode target with its existing
back/replace decision. Hub's direct Town node uses the pure helper too.

Town page link imports are replaced without changing labels,styles,SVGs,route
paths,walking mounts or story logic. Character/quests remain existing destinations
with their existing mode gates. Lantern device-save format/keepsake,active Crypt
save/TTL/owner/loot rules,quest XP/streaks,Brain Rot and all engine logic remain.

Five unit contracts cover internal paths,production/normal mode,query/hash,
explicit mode/idempotence and external targets. The old source smoke assertion
for a literal Town router.push now recognizes mode-aware entry;its destination
is unchanged. The required browser manifest gains one continuity contract.

Browser scope:320/390px sandboxed localhost Chromium,blank backend,GET/HEAD
same-origin only. Begin a real dev-preview Crypt run;browser Back to its Hub;
visit Town,Hearth,Blacksmith,Waystone,Hub,map node and Trail Gate;Continue the same
owner/run/deck/path/HP. Raw save must not change during Town visits. Verify guided
clue persistence and normal Town links don't adopt the preview run. Authenticated
accounts,hosted Preview,production runtime,VoiceOver,iPhone Safari,native simulator
and a natural complete Crypt run are not covered. Query-only URL changes without
a route transition still use the authoritative activation-time read;no broader
history-stack rewrite is included.

QA97's two modeled overlapping-writer failures stay unmodified/blocking. A failed
source test step prevents the subsequent build;TypeScript/browser compilation
must not be called production-build acceptance. Exact results are in the GitHub
checkpoint after execution. No new rewards,XP,account/database/settings,art,
merge,manual deployment or auth bypass.
