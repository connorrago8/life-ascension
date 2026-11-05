# Boss recovery and active-time QA

Candidate inspected: PR89 734e9da769ced705bfde49c3f7a6049bf16e1027.
Source tests and browser contracts only; no gameplay/UI implementation edits.
The same agent authored prior gameplay changes: these results are not independent
approval of that work. Keep draft and retain explicit releaseAuthorized:false.

## New contracts
1. A survival portal cannot credit 15 seconds before 15000 active browser ms.
2. Paused wall time does not alter the boss bank/clock. Resume is explicit.
3. A third lethal frame resets the attempt (three hearts,zero banks/time),
   preserving Level31 unlock and never crediting failed time.
4. A completed checkpoint cannot reopen banked hazards and consume a heart
   through its offered Start/Resume action.
5. All ten game states replay identically after serialization boundaries.
6. Seeded forty-segment pure clock replay conserves 600 credited seconds.

The clock test runs real localhost Chromium with Playwright-controlled time:
it checks callback ordering,not native wall-clock performance or device timing.
Third-heart and terminal cases use authored valid save fixtures; they are not
full boss playthroughs. No account or permanent progression write is allowed.
The browser request guard aborts external or non-GET/HEAD requests.

## Scope and acceptance
Existing QA87 and owner89 tests stay unchanged. New browser failures remain
ordinary assertions,never TODO/skipped/continue-on-error. Report exact candidate
and QA SHA separately with job IDs and raw outputs. No claimed defect until
execution supports it. No browseriPhone/Safari/VoiceOver or hosted acceptance.
No native simulator. Hosted routing is blocked by existing Preview branch guard;
no guard/auth bypass or alternate probe after prior approval-review usage limit.

## Initial hypotheses
A fixed1000/60 credit per setInterval callback may differ from browser elapsed
time. Completed run recovery may still expose an active bank since resume/start
does not explicitly reject boss.won. These require executable evidence.
