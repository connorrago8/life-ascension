LIFE ASCENSION — DESIGN PACK V4  
UX, sprites, couple content, voice and playtesting \| Design only  
ART: Dark fantasy × cyberpunk; detailed 16-bit pixel art, adult proportions; charcoal/midnight glass, magenta \#ff2bd6, cyan \#00f0ff, aged gold \#c9a227. No pastel, chibi or childish proportions.  
LOCKED: Normal quests base 10 XP with one global daily streak; first quest of game day flat 10\. Game day 5:00 AM America/Chicago. Izzy activity XP 5/10/20. Couple quests: Connor normal XP and Izzy fixed 10\. Streak Shield one per month with no XP. Sunday recap after 5 AM, prior seven completed game days.  
STATUS: Content proposals, not approval to modify code, branches, databases or deployments. Preserve existing IDs, XP and history. No confidential pharmacy or patient data.

1\. IZZY'S SCREENS — UX SPEC

1.1 HOME  
Order: top navigation and identity; hero sprite with name/level/XP; primary Log Activity; today's activity count; last logged activity; next gear milestone; active couple quest preview; bottom navigation Home/Quests/Character/History.  
Log Activity opens composer. Last activity opens its History detail. Next gear opens Wardrobe. Couple quest preview opens shared quest. Navigation preserves saved state; Back returns to Home.  
Empty: "Your next chapter begins with one small thing."  
Error: "Home couldn't load. Your saved progress is unchanged."

1.2 LOG ACTIVITY  
Order: title "What did you do?"; free-text entry; optional duration; date selector defaulting to current 5 AM game day; estimated XP tier and reason; Save Activity; Cancel.  
Preview never awards XP. Save validates and records once server-side, then shows confirmed 5/10/20 XP. Retry uses same request ID; backdating respects allowed 30-day window and DST. Cancel discards only after confirming unsaved text.  
Empty: "A walk, a meal, a tidy room — every effort counts."  
Error: "We couldn't confirm the save. Check History before trying again."

1.3 QUESTS  
Order: active count and tabs Today/Weekly/Couple; quest cards showing title, flavor, reward, deadline and Complete; Completed collapsed by default; bottom navigation.  
Complete awards only on verified server success. A completed card moves to history; repeated taps never double-award. Expand Completed reveals recent entries. Couple cards clearly identify rewards to both people.  
Empty: "No active quests right now. Your next adventure will appear here."  
Error: "Completion wasn't confirmed. Your progress hasn't changed."

1.4 CHARACTER / WARDROBE  
Order: large crisp pixel sprite; level and progress; currently equipped gear; next even-level unlock; wardrobe slots; complete L2–L50 track.  
Wear replaces an item only in its slot and persists; Take Off restores base layer; locked items allow preview but not equip. Sprite tap zooms without blur. Equip has no XP reward.  
Empty: "Your first piece of gear unlocks at Level 2."  
Error: "Gear didn't save. Your previous outfit remains equipped."

1.5 HISTORY  
Order: newest-first entries grouped by America/Chicago game day; All/Activities/Quests/Couple filters; per-entry title, date, tier, confirmed XP; summary of confirmed totals.  
Filters do not modify records. Tap an entry for details. Back preserves the current filter during the session.  
Empty: "Your completed adventures will appear here."  
Error: "History couldn't load. Your progress is safe."

2\. COUPLE SCREENS — UX SPEC

2.1 COUPLE QUESTS  
Order: shared header and progress; Weekly/Monthly/Seasonal filters; active quest cards with one completion state and separate reward labels; Completed collapsed.  
Open card for detail; Complete Together records one shared completion and grants Connor normal XP plus Izzy fixed \+10, exactly once each. No award until confirmed.  
Empty: "Choose one small adventure together."

2.2 DATE-NIGHT PLANNER  
Order: cost \$/\$\$/\$\$\$, duration short/evening/full day, home/out filters; idea cards; saved shortlist; optional Turn Into Quest action.  
Filter narrows ideas; Save only shortlists, awards no XP; Turn Into Quest creates a pending shared quest, not a completed one. No booking or purchase implied.  
Empty: "A good date doesn't need a big plan."

2.3 WEEKLY RECAP  
Order: heading and seven-game-day coverage dates; Connor XP; Izzy XP; completed quest/activity totals; best verified shared moment or neutral fallback; gentle next-week suggestion; close/view-history.  
First display Sunday after 5 AM America/Chicago, covering the seven fully completed game days ending just before that boundary. Never invent a highlight. Read-only; no auto-share.  
Empty: "Not enough history for a recap yet."

2.4 LONG-TERM GOALS  
Order: five goal cards, each with completed/total subquests and next action; goal detail with 4–6 steps; completed steps and reward receipts.  
Complete step awards both players exactly once. Parent goal completion is a celebration only, no duplicate XP. Target dates optional.  
Empty: "Big plans begin with one small step."

3\. CHARACTER CREATOR — LEVEL 1

Creation flow: choose silhouette → skin tone → face → hair → preview → confirm. Existing characters retain appearance until explicitly edited. All options are cosmetic, reversible and free.  
Hair: buzz, cropped, short textured, swept fringe, side part, shoulder straight, shoulder wavy, long straight, long curly, high ponytail, low bun, braids. Offer natural colors (black, dark brown, brown, auburn, copper, blonde, ash blonde, gray) and optional restrained fantasy accent. Headwear should not clip.  
Skin: ten named swatches from very light to very deep, with neutral/warm/cool shading. Consistent light source, no racial stereotypes or gameplay implications.  
Face: six adult face silhouettes (oval, angular, round, long, square, soft heart); four brow, four eye, three nose and four mouth styles, all readable at pixel scale. No doll eyes.  
Body: slim, average, athletic, broad, curvy, stocky; adult proportions, consistent gameplay hitbox and correctly fitted equipment layers.  
Level-1 Izzy: white tank, loose brown pants, scuffed boots. Connor: practical plain tunic, worn pants, boots. No locked gear granted at creation.  
Accessibility: named swatches, keyboard/screen-reader labels, preview on contrasting backgrounds. Character creator is a proposed future feature if absent from TEST; do not block current launch for it.

4\. SPRITE PRODUCTION SHEET

Proposed native frame: 64 × 96 transparent RGBA pixels, full body, rendered at integer 4× or 6× nearest-neighbor scale. Existing sprite-pipeline dimensions take precedence; never silently migrate assets.  
Anchor coordinate system: top-left (0,0), feet baseline (32,88), centerline x32, pelvis pivot (32,53), headwear (32,17), left hand (18,52), right hand (46,52). Consistent soles across animation.  
Back-to-front layers: rear aura → rear hair → rear cape → ground shadow → skin/body → pants → boots → torso → jacket/armor → arms/gloves → face detail → front hair → headwear → held props → front particles. Slot masks prevent clipping.  
Animation: idle 6 frames × 140ms; walk 8 frames × 100ms for front/back/left/right; level-up 10 frames × 110ms; equip 6 frames × 120ms. Foot anchors stable; no anti-aliasing or soft blur.  
Naming: character\_action\_direction\_frame (izzy\_walk\_front\_03). Separate per-body overlays; test 25 cosmetics across six body presets and hair/headwear combinations. Reduced-motion: static idle, immediate equipment change, no loops.

5\. TWENTY ADDITIONAL COUPLE QUESTS  
Every completed instance pays Connor normal quest XP and Izzy fixed 10 XP, once each. Weekly/monthly/seasonal recurrence must be grounded in the existing scheduler, not invented.  
01 Weekly — Kitchen Co-op: Try one new recipe together, even if it turns out imperfect.  
02 Weekly — Ten-Minute Reset: Clear one shared space and enjoy the calm afterward.  
03 Weekly — Two-Song Dance: Put on two favorite songs and dance without a plan.  
04 Weekly — No-Screen Breakfast: Share breakfast with phones out of reach.  
05 Weekly — Neighborhood Detour: Take a different route and notice something new.  
06 Weekly — Gratitude Exchange: Tell each other one specific thing you appreciated.  
07 Weekly — Choose the Soundtrack: Each pick three songs for a shared playlist.  
08 Weekly — Sunset Watch: Find a comfortable spot and watch the sky change.  
09 Monthly — Mystery Ingredient: Each choose an ingredient for a meal together.  
10 Monthly — Museum of Us: Pick five household objects and tell their stories.  
11 Monthly — Photo Re-creation: Recreate a favorite old photo with your own camera.  
12 Monthly — Skill Swap: Teach each other one useful or silly skill.  
13 Monthly — Local Explorer: Visit a nearby place neither of you has explored.  
14 Monthly — Letter for Later: Write a short note to open together next month.  
15 Monthly — Dream Map: Sketch a future trip and one practical next step.  
16 Seasonal — First Warm Walk: Welcome warmer weather with an unhurried walk.  
17 Seasonal — Summer Picnic: Pack something simple and eat outside together.  
18 Seasonal — Autumn Recipe: Cook a seasonal dish and save the recipe.  
19 Seasonal — Winter Nest: Create a cozy evening at home.  
20 Seasonal — Season in Pictures: Choose five photos from the last three months.

6\. TWELVE MONTHS OF SEASONAL EVENTS  
Each is one optional limited couple quest with one cosmetic-only reward idea. Proposed window is the local calendar month using 5 AM game-day boundaries; scheduling is not approved. No XP penalty for missing an event. No required spending or public posting.  
January — Winter Lantern Walk: Take a bundled-up evening walk. Reward: Frostlit Lantern charm.  
February — Two Letters: Exchange short handwritten notes. Reward: Twin Oath ribbon.  
March — First Thaw: Find a sign of spring and photograph it. Reward: Verdant Ember pin.  
April — Rainy-Day Ritual: Make a cozy plan for a rainy afternoon. Reward: Stormglass charm.  
May — Bloom Hunt: Find three different blooms together. Reward: Moonbloom hairpin.  
June — Longest Light: Enjoy a late sunset. Reward: Solstice glow cuff.  
July — Summer Stars: Spend an evening watching the night sky. Reward: Starlit wrist wrap.  
August — Golden Hour: Take a golden-hour photo. Reward: Sunforged pendant.  
September — New Chapter: Choose a small autumn goal. Reward: Wayfinder clasp.  
October — Night Market: Plan a spooky or atmospheric evening. Reward: Eclipse mask trim.  
November — Gratitude Table: Share three things you're grateful for over a meal. Reward: Harvest sigil.  
December — Year of Us: Choose your favorite shared memory of the year. Reward: Midwinter cloak clasp.  
Keep themes inclusive, nonreligious by default, and achievable at home or nearby.

7\. TONE AND VOICE GUIDE  
Personality: grounded, warm, lightly mythic, calm, concise. The app is a companion, not a boss. Use specific verified outcomes and exact XP. Use “you” for individual quests and “together” for shared ones. Buttons use verbs: Log, Complete, Wear, Take Off, View. Keep toasts short. Never say saved, completed or awarded before server confirmation.  
Avoid: guilt, shame, “lazy,” “failure,” “grind,” manipulative urgency, childish slang, excessive emoji, hearts, fake scarcity, technical backend jargon, and unverified promises.  
01 GOOD “Quest complete. \+10 XP.” / BAD “OMG\! YOU CRUSHED IT\!\!\! CLAIM NOW\!”  
02 GOOD “Your streak reset. Today is a new start.” / BAD “You failed your streak.”  
03 GOOD “New gear unlocked: Moonsteel Circlet.” / BAD “Super cute accessory, bestie\!”  
04 GOOD “Save activity” / BAD “Submit productivity evidence”  
05 GOOD “Wear” / BAD “Activate premium enhancement”  
06 GOOD “No quests are due today.” / BAD “You have nothing useful to do.”  
07 GOOD “One shared quest completed.” / BAD “Relationship score increased\!”  
08 GOOD “This activity earned 5 XP.” / BAD “AI thinks you deserve only 5 XP.”  
09 GOOD “Your recap is ready.” / BAD “You missed too many goals.”  
10 GOOD “That didn't save. Try again.” / BAD “ERROR 500: USER INPUT FAILURE”  
Additional microcopy: “Your next unlock is at Level 12.” “Nothing was lost. Try again.” “You both earned XP.” “No quests are due today.”

8\. THIRTY-MINUTE PLAYTEST SCRIPT — CONNOR AND IZZY  
Preflight: Grok supplies verified TEST URL, exact build SHA, TEST-only accounts and seeded quest IDs. Use separate devices or profiles. Record starting levels/XP. Do not test production or enter sensitive information.  
00:00–03:00 — Both sign in, check correct name, sprite, XP, level, navigation. Record device, browser and build.  
03:00–07:00 — Izzy logs a Small activity. Check 5 XP preview, Save, confirmed toast, History and \+5 once.  
07:00–10:00 — Izzy logs Medium activity, refreshes and retries a submission. Verify no duplicate XP.  
10:00–13:00 — Izzy views locked gear, wears an owned piece, takes it off and refreshes. Verify persistence and no XP changes.  
13:00–17:00 — Both complete one shared quest. Verify Connor normal XP and Izzy fixed \+10. Repeat tap must award nothing. Refresh both.  
17:00–20:00 — Connor completes normal quest; if first today, verify flat 10 XP. Check one daily streak and collapsed Completed.  
20:00–23:00 — Both filter Date Planner, save an idea (zero XP), inspect a long-term goal and complete one eligible test step.  
23:00–26:00 — Check Sunday recap only with a verified Sunday TEST fixture; verify seven fully completed game days and accurate totals. Otherwise mark BLOCKED, never alter production clock.  
26:00–28:00 — Check mobile layout, text contrast, tap targets, navigation, reduced-motion option, sprite alignment and loading/empty states.  
28:00–30:00 — Compare XP receipts, note three confusing moments and record PASS/FAIL/BLOCKED.  
Bug report: Screen \| Actor \| TEST URL and SHA \| Steps \| Expected \| Actual \| Starting/ending XP \| Screenshot without private information \| Severity.  
Release gate: No duplicate XP, no cross-account leakage, correct 5 AM boundaries, persistent gear, readable mobile UX and no production changes. BLOCKED is not PASS.

APPROVAL STATUS  
Locked XP, 5 AM day, shield allowance and Sunday recap rules remain unchanged. Character creator, sprite dimensions, new quests, seasonal schedule and event rewards are design proposals pending implementation review. Shield monthly reset timing is still unapproved.  
