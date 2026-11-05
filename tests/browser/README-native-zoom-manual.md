# Quest Progress — manual native-browser 200% zoom acceptance (draft QA)

**Scope:** PR #32 local-only `/qa/quest-progress` fixture. This is an evidence-collection procedure, **not** a passed test or Preview isolation proof.

## Safety prerequisites

- Use a local development checkout on a non-root desktop with sandboxed Chromium/Chrome and **no Supabase credentials or `.env*` files**. Do not run authenticated Preview or Production.
- Confirm `NODE_ENV=development`; `app/qa/quest-progress/page.tsx` returns `notFound()` otherwise. `middleware.ts` bypasses Supabase auth for this route in development. The fixture uses in-memory `onLog` responses, not Supabase.
- Open `http://127.0.0.1:3128/qa/quest-progress` after starting the local dev server. Confirm the heading **Quest progress interaction QA (local only)** and `data-qa-hydrated="true"`.
- Keep DevTools **undocked** so opening the console does not change the tested page width. Use the actual browser Zoom menu; **do not** substitute CDP emulation, pinch zoom, OS display scaling, or browser `--force-device-scale-factor`.

## For EACH baseline CSS viewport width: 320, 375, 390, 430

1. Set the browser's **native zoom menu** to 100%. Resize the real browser window until the page reports the requested `window.innerWidth` (±1 CSS pixel). A responsive-mode emulated viewport does not count as native-browser evidence.
2. In the **undocked** DevTools console, run the read-only measurement below; save the resulting JSON as `baseline-<width>.json`. Capture a baseline screenshot with visible browser chrome or zoom indicator.
3. Using Chrome's three-dot **Zoom +** control (not an automated keyboard shortcut), change zoom to **200%**. Keep the outer window dimensions unchanged.
4. Run the same measurement; save `zoom200-<width>.json`. Capture `zoom200-<width>.png` with the page and browser's **200%** zoom indicator visible. If the menu closes, reopen it without changing zoom for the screenshot.
5. Assert `after.dpr / before.dpr` is 1.95–2.05, `before.width / after.width` is 1.90–2.10, `visualScale` remains approximately 1, and `scrollWidth <= width + 1`. Record **FAIL** rather than modifying viewport emulation to force a pass.
6. Use **Tab** and **Shift+Tab** to visit Add, Undo, the custom amount input, Log, and the mock-response selector. For every focused control record that focus is visible and its bounding rectangle is inside the **current** layout viewport (horizontal and vertical). Save a screenshot of the focused Add and Undo buttons.
7. Select **Unconfirmed / retry** in the mock-response selector, activate Add, verify the Retry save button and unconfirmed status appear, and record the pending operation `id` and `delta` from localStorage. Refresh, confirm the same pending record survives, and confirm a new Add operation is blocked.
8. Select **Confirmed saved**, activate Retry save, confirm the existing operation ID and delta appear in the mock event log and that the pending journal clears. Then activate Undo, repeat the unconfirmed/reload/retry sequence, and verify the negative delta retains its original ID. The fixture's event log is reset on reload; preserve screenshots or copied log entries before refreshing.
9. Test **Seed malformed journal and reload**: confirm a visible error and that Add/Undo/Retry cannot create a replacement operation. Use **Clear QA journal and reload** to reset before the next width.

Read-only console measurement (run before and after, with DevTools undocked):

```js
JSON.stringify({
  timestamp: new Date().toISOString(),
  userAgent: navigator.userAgent,
  width: window.innerWidth,
  height: window.innerHeight,
  dpr: window.devicePixelRatio,
  visualScale: window.visualViewport?.scale ?? null,
  scrollWidth: document.documentElement.scrollWidth,
  activeElement: document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName,
}, null, 2)
```

## Acceptance record

| Baseline CSS width | Baseline JSON | Native 200% JSON | Zoom-indicator screenshot | No horizontal overflow | Keyboard/focus | Save/Retry/Undo |
|---|---|---|---|---|---|---|
| 320 | PENDING | PENDING | PENDING | UNKNOWN | UNKNOWN | UNKNOWN |
| 375 | PENDING | PENDING | PENDING | UNKNOWN | UNKNOWN | UNKNOWN |
| 390 | PENDING | PENDING | PENDING | UNKNOWN | UNKNOWN | UNKNOWN |
| 430 | PENDING | PENDING | PENDING | UNKNOWN | UNKNOWN | UNKNOWN |

Record OS/browser version, capture timestamp, screenshot SHA256, source commit, and the measured ratios for each width. Mark **BLOCKED** if native zoom cannot be changed or screenshots/measurements cannot be collected. No browser acceptance is claimed until the actual artifacts are reviewed.

**Separate release gates:** This procedure cannot establish authenticated Preview isolation, actual Supabase RPC idempotency, XP receipts, or server-side equipment ownership. PR #32 remains draft.
