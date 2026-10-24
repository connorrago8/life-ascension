# Deployment checklist

This repository is public. **Never commit secret API keys, passwords, private health data, or personal records.**

## Required Vercel environment variables

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase **publishable** key (not service_role or secret)
- `SUPABASE_SERVICE_ROLE_KEY`: server-only key for hashed personal API keys. Never prefix it with `NEXT_PUBLIC_`. See `docs/ai-auth.md`.

The `NEXT_PUBLIC_` values are intentionally visible to browser users; row-level security must enforce privacy.

## Deployment steps

1. Import `connorrago8/life-ascension` as a Next.js project in Vercel.
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the server-only `SUPABASE_SERVICE_ROLE_KEY` in Vercel project settings. See `docs/ai-auth.md` before using API keys or `/api/mcp`.
3. Deploy and record the resulting `https://...vercel.app` URL.
4. In Supabase Authentication URL Configuration, set Site URL to `https://life-ascension.vercel.app` and allow `https://life-ascension.vercel.app/auth/callback`. Put `{{ .Token }}` in the Magic Link template, keep the email OTP length at 6, and turn signups off after the owner account can sign in. See `docs/ai-auth.md`.
5. Test email sign-in and sign-out on an actual phone.
6. Run the two-user isolation and duplicate-XP tests in `tests/SECURITY_TEST_PLAN.md`.

**Do not invite outside users until authentication, RLS isolation, and exactly-once XP have been tested.**

## Current limitations

- Self-reported completions only; evidence audits are not implemented.
- No Oura, WHOOP, Apple Health, calendar, finance, or AI integrations.
- XP is a flat 1 point per quest completion; class/level progression is not yet implemented.
- One-time quests remain visible as completed; the daily board currently shows the most recent instance, not a historical calendar.
