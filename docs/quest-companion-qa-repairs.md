# Quest / companion QA repairs

This integration branch builds on QA120, which builds on PR119/118/117/116. It changes no SQL migration, database policy, XP transaction, quest schedule, visual asset or QA assertion. It does not merge any upstream PR.

## Changes and ownership

| Boundary | Change / owner |
| --- | --- |
| Companion focus | Integration repairs keyboard-visible controls covered by fixed navigation; scrolls instantly only when necessary, preserving focus and readable controls already in view. |
| Accounting helper | Integration shares strict calendar validation between credit keys and weekly dates; real leap days remain valid. This helper is not server authorization. |
| QA | Original negative-date, keyboard/privacy and05:00 SQL assertions remain unchanged. Exact-head workflow also runs when the PR base is the QA branch. |
| Quest Systems |05:00 authoritative eligibility/Home context work remains separately owned and excluded. The existing SQL boundary failure must remain red until its implementation is published and independently verified. |
| Companion / UI | Consent, mystery reward reveal, manual journal, XP writes and visual assets remain with their existing product owners. |

## End-to-end demo / verification checklist

These are acceptance steps, not a claim of hosted or device execution. Exact CI, artifact and Preview evidence belongs in the PR and issue115 checkpoint.

1. Use two authorized nonproduction accounts. Create invitation, request connection, verify the other account and explicitly confirm. Never use the companion's credentials.
2. Sender creates a free-text mystery quest. Recipient inbox and its network response show only ??? before acceptance; accept reveals the promise. Render user text as text.
3. Complete a legitimate personal quest for1 XP; link an overlapping companion offer and verify2 total, not3. Repeat completion, reload, return Home/Hub and inspect persisted rows. Both account totals remain separate.
4. Log manual companion activity with provenance, retry the same request, correct it, and inspect the weekly journal without changing either account's permanent XP.
5. At320/375/390/430 widths, Tab/Space/Enter through sender fields and send, recipient decline, then revocation. Reward textarea and focus outline remain above bottom navigation. Missing/declined quests do not change XP. Revocation removes subsequent shared reward access.
6. Evaluate05:00 America/Chicago/DST eligibility separately. The known midnight mismatch is not repaired here. Do not certify5-of25 generation, per-quest streak/grace or weekly lifecycle from companion tests.

CI uses sandboxed Chromium, synthetic auth and actual isolated PostgreSQL/RLS. Real hosted Auth/PostgREST, two-device sessions, VoiceOver, Safari and native iPhone remain separate release checks. No production data or protection change is authorized by this document. Prior authoring of PR117–119 means a different reviewer must give independent release acceptance.
