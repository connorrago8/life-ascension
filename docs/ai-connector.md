# Shared ChatGPT + Grok connector (review branch)

## Status
This is a **draft** implementation. Do not connect production AI clients yet.
The route at `/api/mcp` has five declared tools and supports Supabase **user access JWT** bearer authentication only. It does **not** implement OAuth authorization-code + PKCE, OAuth discovery, dynamic client registration, token revocation, refresh tokens, or API key lookup. ChatGPT OAuth connection is therefore **not ready**. Grok connector compatibility is not verified.

## Intent rule
- Planned/future actions -> `create_quest`
- In-progress actions -> `update_progress` (currently returns an explicit unsupported error; no false success)
- Explicit past-tense completed action -> `submit_completion`, only for an existing instance
- Ambiguous statements -> ask the user, do not complete
- Only server-side `set_quest_instance_status` RPC can award XP; repeated completion must be idempotent.

## Security
The endpoint authenticates the bearer user token with Supabase Auth and uses user-scoped RLS queries. Never use the Supabase service role for these tools. Never store plaintext integration keys. Add hashed key storage with rotation/revocation and owner scoping before enabling API keys. Add rate limiting, event logging, strict origin/redirect validation, and OAuth authorization server before ChatGPT sign-in.

## Next required steps before launch
1. Implement OAuth 2.1 authorization-code with PKCE, discovery endpoints and user consent, issuing scoped tokens mapped to Supabase users.
2. Add `quest_progress` migration and make `update_progress` persist notes.
3. Verify the production `set_quest_instance_status` function's idempotency, event history, and XP once-only behavior.
4. Implement MCP protocol transport/negotiation and error handling per client requirements; test with ChatGPT and Grok.
5. Add tests for user isolation, revoked credentials, replayed completions, and plan/progress/completion semantics.
6. Enable production only after security review.

Live site: https://life-ascension.vercel.app
Repo: https://github.com/connorrago8/life-ascension
