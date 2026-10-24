# ChatGPT OAuth integration design — proposal only

**Status:** Not implemented. Do not advertise ChatGPT connection as working. Keep Grok's personal API-key path separate. Aim for a free-tier implementation using the existing Next.js app on Vercel and Supabase Auth/Postgres, subject to actual provider plan limits.

## Protocol
Use OAuth 2.1-style authorization-code flow with **PKCE (S256)** and a browser-based consent page. ChatGPT acts as the OAuth client, LIFE ASCENSION is the protected MCP resource and its authorization service (or delegates to a compatible standards-compliant provider). **Do not ask users to paste a Supabase JWT, service-role secret, or personal API key into ChatGPT.**

Discovery and registration requirements depend on ChatGPT's then-current MCP connector specification. Verify current OpenAI connector documentation before implementation, including OAuth discovery metadata, client registration, redirect URIs, resource indicators and supported PKCE methods. Do not assume an arbitrary Next.js route automatically satisfies OAuth server requirements.

## Suggested routes and components (not implemented)
- `/.well-known/oauth-authorization-server` (or the relevant issuer metadata endpoint): advertises authorization/token endpoints, PKCE S256, scopes, and supported registration model.
- `/.well-known/oauth-protected-resource` for `/api/mcp`: resource metadata, authorization server issuer and supported scopes.
- `/oauth/authorize`: authenticate the owner with Supabase Auth, verify registered client and exact redirect URI, show consent for `quests:read` and `quests:write`; validate `state`, PKCE challenge, and resource.
- `/oauth/token`: exchange a short-lived, single-use authorization code plus PKCE verifier for a short-lived access token; optionally rotate refresh tokens with reuse detection.
- `/settings/connections`: show active clients/scopes and allow revocation.
- `/api/mcp`: validate issuer, audience/resource, expiry, scopes and user identity on every request; never accept a caller-supplied user ID as authority.

## Data model
Store only hashed authorization codes and refresh tokens, with owner ID, client ID, exact redirect URI, scope set, expiration, used/revoked timestamps, PKCE challenge, and resource audience. Add database constraints, RLS, service-only write functions, audit timestamps, rate limits and cleanup. Access tokens can be signed JWTs with a dedicated signing key and key rotation or opaque random tokens verified server-side. Do **not** reuse the Supabase service-role key as a token-signing secret.

## Security invariants
- Require HTTPS, state validation, S256 PKCE, exact registered redirect URI matching, and explicit consent. Prevent CSRF and login-session fixation.
- Default to read-only scopes; request write scope explicitly. Server enforces scopes per MCP tool.
- Keep `confirmed_complete=true` gated on unambiguous user confirmation. OAuth never bypasses XP uniqueness, date eligibility, ownership or archive checks.
- Validate OAuth tokens on every request; support immediate revocation. Avoid sensitive data in logs, URLs, and error responses.
- Enforce token endpoint rate limits, short code lifetime, replay protection, secure cookie attributes, and account isolation.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only; never forward it or a Supabase user access token to the external client.

## Rollout and acceptance tests
1. Check current ChatGPT connector OAuth requirements and whether a compatible authorization server can be operated entirely within the available free tiers. If not, stop and revise the design rather than pretending the integration is ready.
2. Implement on a separate branch after production Grok integration stabilizes.
3. Test two users, revoked grants, wrong redirect URI, wrong PKCE verifier, reused authorization code, expired/reused refresh token, cross-user quest access, and scope escalation.
4. Connect a test ChatGPT client and verify create → progress (no XP) → confirmed completion (one XP) → repeated completion (zero additional XP).
5. Verify disconnect revokes tokens and leaves existing quest and XP history intact.

## Cost constraints
Prefer existing Vercel and Supabase free allowances and built-in crypto primitives; avoid paid identity brokers or third-party token services. Free tiers have limits and may not include all backup, email delivery, or authentication features. Verify quotas and suitability before go-live. Do not expose production to the internet with incomplete OAuth security controls.
