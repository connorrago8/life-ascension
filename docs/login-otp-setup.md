# Email code login setup

The login UI sends an email OTP with `signInWithOtp` and verifies a six-digit token with `verifyOtp({type:'email'})`.

## Supabase email template (required before deployment)

In Supabase Auth → Email Templates → Magic Link, replace the confirmation-link-only body with a message containing **`{{ .Token }}`**. Otherwise the user will receive a link instead of the code needed by this UI. Keep the existing email provider limits in mind; configure a supported SMTP sender separately if rate limits become a problem.

This app is initially single-user. The login call sets `shouldCreateUser:false`; existing users can sign in, but the login screen will not automatically create accounts. Review Supabase signup settings and existing accounts before enabling this.

## Preserve proposed quest after login

If a user is directed to `/login?next=%2F%3Fquest%3DFold%2520laundry%26domain%3Dhome%26cadence%3Donce`, the page returns them to the same-origin `/?quest=...` after verification. The `next` value must be a same-origin relative path. A future integration should ensure unauthenticated quest proposal links are redirected to `/login?next=...` rather than discarding the proposal.

No production settings have been changed. Test sign-in, resend, expired/wrong codes, already-signed-in redirect, and the proposed quest return path before deployment.
