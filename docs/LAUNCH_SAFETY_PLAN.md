# Launch safety plan: monitoring, MCP throttling, key lifecycle

**Status:** Design only; review before implementation. **Branch:** `feature/phone-board-design` (docs-only, based on `main`). No changes to live infrastructure or XP logic. Login integration remains with Grok in draft PR #1.

## 1. Error monitoring and alerts

**Goal:** A failed completion is detectable without exposing private data.

- Instrument `/api/mcp`, API-key management, and browser quest-completion errors with structured records: timestamp, route, operation, HTTP status / JSON-RPC error category, duration, request/correlation ID, and safe hashed/opaque user or key identifier. **Never log** bearer tokens, passwords, authorization headers, request bodies, quest titles, progress notes, raw database URLs, or service-role credentials.
- Distinguish a completion **attempt** from a server-confirmed success. Count failed or uncertain outcomes; the client should reconcile server status before retrying. The database XP ledger remains authoritative.
- Review Vercel runtime/function logs and retention on the actual plan. Do not assume free-tier historical retention, alert notifications, or a built-in automatic alert feature without checking the current Vercel account capabilities. If native alerts are unavailable, document a low-cost alternative (e.g., scheduled synthetic health check or provider-supported integration), with no secrets in notifications.
- Define alert conditions before deployment: repeated 5xx or JSON-RPC completion errors, unusual 401/403/429 spikes, missing expected scheduled summaries, and unexpected failures to read quest state. Avoid paging on ordinary user cancellation.
- Acceptance: simulate a failed completion on staging; verify safe log record, correlation ID, and the selected notification path; verify no XP is awarded and no sensitive content is recorded.

## 2. Rate limiting on `POST /api/mcp`

**Current review:** The combined draft route authenticates the bearer token and checks scopes but shows no rate limiter in the reviewed route. This is a proposed change, not an assertion that the deployed site is protected.

- Enforce **server-side**, after authentication, using a stable internal API-key ID rather than raw key, user-controlled name, or IP. Protect pre-auth failures separately with an IP/edge abuse limit, taking care with trusted proxy headers.
- Suggested initial policy for review: **60 requests/minute per API key**, with a short burst allowance and a separate stricter cap for writes (e.g., **10 write tool calls/minute**). These are starting hypotheses; load-test Grok's scheduled routine and interactive use before locking values.
- A distributed/atomic limiter is necessary across serverless instances. An in-memory Map in a Vercel function is **not** reliable enforcement. Compare a small Postgres atomic counter design versus an external managed limiter, including free-tier quotas, latency, and failure behavior. Avoid creating an unrestricted SECURITY DEFINER endpoint.
- When limited, return **HTTP 429** with `Retry-After`; choose a consistent JSON-RPC-compatible error envelope for authenticated MCP calls. Never call a write tool before the limit decision. Ensure `initialize`/`tools/list` cannot bypass abuse protection.
- Avoid leaking whether a token is valid from rate-limit responses. Document limits for Supabase JWT callers separately; do not let shared keys bypass quotas.
- Acceptance: burst, concurrent-instance, per-key isolation, read/write, malformed JSON, revoked key, and scheduled-summary tests. Verify rejected requests cause **zero XP writes**.

## 3. API key revoke and rotation

**Existing draft behavior:** `POST /api/api-keys` creates a scoped API key, returning the plaintext secret only at creation. Backend migration supports hashed storage and revocation. Confirm the exact existing revoke endpoint and UI implementation in the integrated commit before adding anything; don't duplicate functionality.

- Account settings → **Connected AI / API keys**: list key name, prefix, scopes, creation time, last-used time if reliably available, and revoked status. Never reveal the stored secret.
- Each active key gets a clearly labeled **Revoke** button with a confirmation dialog. The revoke must require an authenticated account session, enforce ownership, take effect for subsequent requests, and be idempotent. Show a non-secret success status; verify the revoked key now returns unauthorized.
- **Rotation flow:** Create a new key → show it **once** with copy/save guidance → update Grok's connection → verify `list_quests` works with new key → revoke old key → verify old key fails. Allow overlap for a short transition; provide **Revoke immediately** for suspected leaks.
- Rate-limit key creation and revoke operations too. Never put API keys in URLs, analytics, logs, notifications, or browser localStorage.
- Key rotation is a client workflow using existing create/revoke primitives, **not** a reason to change quest completion or XP paths.
- Acceptance: wrong-user revocation blocked; one-time display; old key rejected immediately after revocation; new key retains intended scopes; user can recover from a lost key by generating a replacement.

## Release gates and order

1. Grok finishes login integration and tests on **draft PR #1**; do not merge to `main` yet.
2. Review this design and confirm actual free-tier monitoring capabilities, rate-limiter backend, and existing revoke UI/API behavior.
3. Implement and test safeguards on a **separate approved code branch**; independent security review.
4. Complete isolated backup/restore dry run and final launch verification before production deployment.
5. After launch, design weekly automatic backups and owned data export as separate features; verify backup coverage and storage security before promising automation.

**Non-goals:** New XP paths, changing +1 XP rules, auto-confirming completions, paid messaging, production configuration changes, or implementing any feature in this docs-only commit.
