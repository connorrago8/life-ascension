# Quest Board 2.0 local verification

Base: `a419aad`. No hosted writes, environment edits, pushes, merges or deployments.

## Reproduce

- `npm ci --ignore-scripts`, `npm test`, `npm run lint`.
- Build with dummy configuration: `NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder npm run build`.
- Install QA tools outside the repository: `npm install --prefix /tmp/life-qa --ignore-scripts @electric-sql/pglite@0.5.12 playwright@1.64.1`.
- `QA_MODULES=/tmp/life-qa/node_modules node tests/sql/milestone1.pglite.mjs` applies candidate migrations and runs seven SQL suites in a disposable embedded PostgreSQL database. Includes pgcrypto and statement-level transaction semantics.
- With a local Chromium executable: `QA_MODULES=/tmp/life-qa/node_modules CHROMIUM_BIN=/path/to/chromium node tests/browser/milestone1.qa.mjs`.

The browser runner starts the real Next application against a loopback-only mock Supabase API. It uses synthetic sessions and rejects browser requests to other hosts. Screenshots are written to `/tmp/life-m1-browser`. The recorded runtime used Chromium 153.0.8010.0. This root runtime cannot change users; browser sandboxing was unavailable. These are functional mock tests, not a security certification.

## Coverage

- Highlight ordering, eligibility, owner/day storage separation, refresh stability, no refill, malformed/unavailable storage.
- Receipt identity/type validation, new reward versus replay, missing reward evidence.
- Anchored weekly and two-week occurrence identity, duplicate completion, legacy/v2 compatibility, defer/resume, owner rejection, archive history and tracked-target bypass rejection.
- Existing five SQL regression suites plus classification and milestone tests.
- Browser widths 320/375/390/430: Main/Side hierarchy, cadence labels, no horizontal overflow, 44px completion target, keyboard focus, CSS 200% text enlargement, reduced-motion preference, highlight reload, pending state, lost response/reload/retry, Journal reload/next day, missing ledger fallback and account switch.

## Remaining gates

- Two independent PostgreSQL sessions: `tests/sql/quest_receipt_v2_concurrency.sh` is included in candidate CI but was not executed in the local embedded engine. It must pass before release acceptance. Embedded tests do not prove locking across independent sessions.
- No exact-head remote CI has run: local-only authorization does not include a push that could trigger hosting.
- Real VoiceOver, native browser zoom and iPhone Safari need hands-on verification; CSS text enlargement does not substitute for them.
- Hosted authentication/persistence and deployment-bound server isolation remain unverified. They require isolation proof and separate authorization before writes.
- Highlights are frozen per account/day/device using localStorage, not synchronized between devices. No progress, ownership or XP authority comes from that storage.
- Candidate requires both additive local migrations before use. Production is not compatible with the new RPCs until a separately approved migration/release.
