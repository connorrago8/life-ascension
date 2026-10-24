# Launch safety plan: monitoring, MCP throttling, key lifecycle

**Status:** Design only; review before implementation. **Branch:** `feature/phone-board-design` (docs-only, based on `main`). No changes to live infrastructure or XP logic. Login integration remains with Grok in draft PR #1.

## 1. Error monitoring and alerts

**Goal:** A failed completion is detectable without exposing private data.

- Instrument `/api/mcp`, API-key management, and browser quest-completion errors with structured records: timestamp, route, operation, HTTP status / JSON-RPC error category, duration, request/correlation ID, and safe hashed/opaque user or key identifier. **Never log** bearer tokens, passwords, authorization headers, request bodies, quest titles, progress notes, URL query strings, emails, OTPs, Supabase error details, RPC parameters, the plaintext `api_key` returned at creation, raw database URLs, or service-role credentials.
- Distinguish a completion **attempt** from a server-confirmed success. Count failed or uncertain outcomes; the client should reconcile server status before retrying. The database XP ledger remains authoritative.
- Grok's review reports that Vercel Hobby retains runtime logs for one hour, with no native alerts or log drains. Verify these limits in the actual account at launch; browser error reporting and alerting are **post-launch**, not blockers. If native alerts are unavailable, document a low-cost alternative (e.g., scheduled synthetic health check or provider-supported integration), with no secrets in notifications.
- Define alert conditions before deployment: repeated 5xx or JSON-RPC completion errors, unusual 401/403/429 spikes, missing expected scheduled summaries, and unexpected failures to read quest state. Avoid paging on ordinary user cancellation.
- Acceptance: simulate a failed completion on staging; verify safe log record, correlation ID, and the selected notification path; verify no XP is awarded and no sensitive content is recorded.

## 2. Rate limiting on `POST /api/mcp`

**Current review:** The combined draft route authenticates the bearer token and checks scopes but shows no per-key rate limiter in the reviewed route. Grok reports that Vercel Hobby includes one IP-based WAF rate-limit rule. This is a proposed change, not an assertion that the deployed site is protected.

- **Before deploy:** configure the single available Vercel WAF IP-based rule on `/api/mcp`, with a generous initial threshold (proposed **300 requests/minute per IP**, subject to actual UI capabilities and validation) because AI providers can share egress IPs. Obtain explicit production-change authorization before enabling it. **After launch:** implement server-side per-key limits after authentication using a stable internal API-key ID rather than raw key, user-controlled name, or IP; the current auth result must be extended to carry that ID. Protect pre-auth failures separately as appropriate.
- **Post-launch per-key proposal only:** 60 requests/minute per key, with a short burst allowance and separate stricter cap for writes (e.g., 10 writes/minute). These are hypotheses, not launch requirements. Test Grok's scheduled routines and interactive use before locking limits.
- For the later per-key limiter, a distributed/atomic mechanism is necessary across serverless instances. An in-memory Map in a Vercel function is **not** reliable enforcement. Compare a small Postgres atomic counter design versus an external managed limiter, including free-tier quotas, latency, and failure behavior. Avoid creating an unrestricted SECURITY DEFINER endpoint.
- When limited, return **HTTP 429** with `Retry-After`; choose a consistent JSON-RPC-compatible error envelope for authenticated MCP calls. Never call a write tool before the limit decision. Ensure `initialize`/`tools/list` cannot bypass abuse protection.
- Avoid leaking whether a token is valid from rate-limit responses. Document limits for Supabase JWT callers separately; do not let shared keys bypass quotas.
- Acceptance: burst, concurrent-instance, per-key isolation, read/write, malformed JSON, revoked key, and scheduled-summary tests. Verify rejected requests cause **zero XP writes**.

## 3. API key revoke and rotation

**Already implemented in draft PR #1 (per Grok's code review):** `app/settings/api-keys/page.tsx` provides key creation, one-time secret display, and immediate revoke; the backend stores hashed keys and checks revocation without a cache. Do not rebuild the existing key screen. Remaining UX gaps: add a link from the board, display each key's scopes/allowed actions, and replace raw errors with friendly safe messages. Reconfirm against the final integrated commit.

- Account settings → **Connected AI / API keys**: list key name, prefix, scopes, creation time, last-used time if reliably available, and revoked status. Never reveal the stored secret.
- The existing **Revoke** control should remain; verify authenticated ownership, immediate effect, idempotent behavior, and that the revoked key returns unauthorized. A board shortcut and scope descriptions are post-launch UX improvements.
- **Rotation flow:** Create a new key → show it **once** with copy/save guidance → update Grok's connection → verify `list_quests` works with new key → revoke old key → verify old key fails. Allow overlap for a short transition; provide **Revoke immediately** for suspected leaks.
- Rate-limit key creation and revoke operations too. Never put API keys in URLs, analytics, logs, notifications, or browser localStorage.
- Key rotation is a client workflow using existing create/revoke primitives, **not** a reason to change quest completion or XP paths.
- Acceptance: wrong-user revocation blocked; one-time display; old key rejected immediately after revocation; new key retains intended scopes; user can recover from a lost key by generating a replacement.

## Release gates and order

1. **Before deploy:** Grok finishes login integration and tests on **draft PR #1**; do not merge to `main` yet.
2. **Before deploy:** document the create → test new key (`list_quests`) → revoke old key → verify old key fails rotation procedure. Never paste keys into chat or logs. For a suspected leak, revoke the compromised key immediately, then create a replacement.
3. **Before deploy:** obtain explicit approval and configure/test the one Vercel Hobby WAF IP rule for `/api/mcp` (initial proposal: 300 requests/minute per IP). Monitor for legitimate shared-IP traffic being blocked; WAF rules are not per-key limits.
4. **Before deploy:** complete isolated backup/restore dry run and final launch verification before production deployment.
5. **After launch:** per-key Postgres/Upstash or equivalent atomic limiter (including auth key-ID propagation), browser error reporting, operational alerts, board shortcut to key settings, scope display, friendly error messages, automated backups, and owned data export. Each requires its own review.

**Non-goals:** New XP paths, changing +1 XP rules, auto-confirming completions, paid messaging, production configuration changes, or implementing any feature in this docs-only commit.
