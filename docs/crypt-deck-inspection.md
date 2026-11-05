# Crypt deck inspection interaction

Visual increment over QA97 `18d9f0cbe91beac897030fb276b30e5dd3341cd8`.
The old source sheet used a modal label and focused Close, without explicit focus
containment/restoration. No prior rendered failure is claimed from that source.

The new CryptInspectionDialog uses native dialog.showModal/top-layer behavior,
which makes background controls inert. It contains keyboard Tab navigation,
handles Escape/Close/backdrop dismissal, returns focus to the connected initiating
control and restores the previous body overflow style on cleanup. Native modal
support is a browser dependency; iPhone Safari/VoiceOver acceptance is separate.

A fixed header keeps the44px Close control visible while the card content scrolls.
Title, note and card text wrap; cost markers use rem dimensions. The charcoal
surface, mint focus and restrained static presentation follow existing UI.
Reduced motion removes motion; there is no mandatory opening animation.

The same wrapper serves combat Draw/Discard/Exhaust, starter preview and reward
View deck. Existing grouped/sorted contents, draw-order privacy, accessible trigger
names, engine commands, routes, saves, XP, loot and explicit Wear remain unchanged.
No Brain Rot gameplay/persistence or World/UI assets are changed.

New browser contract:320/375/390/430px,normal/200%root text; native modal state,
focus containment/return,background inertness,Close bounds,content scrolling,
Escape/Close/backdrop,raw save preservation and no external/non-GET requests.
Uses authored valid local starter/combat/reward fixtures,with reward derived via
the existing reducer from an authored near-victory combat state. Eight modal
screenshots. This is Linux sandboxed localhost Chromium,not hosted Preview,
iPhone/native zoom/VoiceOver,natural full-run or independent acceptance.

The new contract is mandatory in the explicit CI manifest. QA97's two overlapping
writer model failures remain unmodified/blocking; the subsequent source-build
step therefore does not execute on this stack. TypeScript and browser compilation
are distinct from a completed production build. Exact run/commit/artifact results
are recorded in the GitHub checkpoint after execution. No release authorization,
native simulator,merge,manual deployment,auth bypass or production operation.
