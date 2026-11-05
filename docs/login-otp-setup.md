# Email code login setup

The login UI sends an email OTP with `signInWithOtp` and verifies a six-digit token with `verifyOtp({type:'email'})`.

## Supabase email template (required before deployment)

In Supabase Auth → Email Templates → Magic Link, replace the confirmation-link-only body with a message containing **`{{ .Token }}`**. Otherwise the user will receive a link instead of the code needed by this UI. Keep the existing email provider limits in mind; configure a supported SMTP sender separately if rate limits become a problem.

This app is initially single-user. The login call sets `shouldCreateUser:false`; existing users can sign in, but the login screen will not automatically create accounts. Review Supabase signup settings and existing accounts before enabling this.

## Preserve proposed quest after login

If a user is directed to `/login?next=%2F%3Fquest%3DFold%2520laundry%26domain%3Dhome%26cadence%3Donce`, the page returns them to the same-origin `/?quest=...` after verification. The `next` value must be a same-origin relative path. An unsigned quest board keeps that proposal in its sign-in link as `/login?next=...`. Quest notes, quest manage, and API keys do the same for their own paths.

No production settings have been changed. Test sign-in, resend, expired/wrong codes, already-signed-in redirect, and the proposed quest return path before deployment.

## Additional setup and security
- In Supabase Authentication settings, turn **off** "Allow new users to sign up" for this single-user pilot, after verifying the existing owner account can log in. `shouldCreateUser:false` applies only to this login call, not all signup routes.
- In the Magic Link email template include **both** `{{ .Token }}` (6-digit email code) and `{{ .ConfirmationURL }}` (optional link fallback).
- This UI expects a **6-digit** token. Confirm the configured email OTP length is six before launch.
- Both the login page and callback validate `next` as same-origin, relative and free of ASCII control characters. Test encoded tab/newline, protocol-relative URLs and external absolute URLs.
- The login screen uses generic failure messages so it does not reveal whether an email address belongs to an account.

## Supabase Redirect URL allow-list
In Supabase Authentication → URL Configuration → Redirect URLs, add:
`https://life-ascension.vercel.app/auth/callback**`
For preview testing, allow only the specific preview callback URL being used.

## Redirect regression cases
Test that all these resolve to `/` rather than an external destination:
- `/..//evil.com`
- `/.//evil.com`
- `/%2e%2e//evil.com`
- `/a/..//evil.com`
- `/%09/evil.com`
- `//evil.com`
- `/\\evil.com`
The final normalized pathname must also be checked for a leading double slash or slash-backslash.
