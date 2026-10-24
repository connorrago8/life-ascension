# AI auth: hashed API keys and quest progress notes

This branch adds personal API keys and a journal of quest progress notes. It does not add `/api/mcp`. After review, wire `authenticateRequest` into the `/api/mcp` route on PR #1 (`feature/shared-ai-quest-mcp`).

Nothing in this branch is applied to production. The migration is a file only.

## How API keys work

- A key looks like `la_live_` plus 32 random bytes encoded as base64url (43 characters). The server generates it with `crypto.randomBytes`. The browser never generates the secret.
- The create response shows the full key once. The database stores `prefix` (the leading `la_live_` plus 8 characters, so you can recognize the key) and `key_hash` (lowercase SHA-256 hex of the full key). The plaintext is not stored and cannot be recovered.
- Default scopes are `quests:read` and `quests:write`.
- Revoking sets `revoked_at`. A revoked key fails authentication. `last_used_at` updates only after a successful lookup.
- Lookup hashes the bearer token, then calls the `SECURITY DEFINER` function `authenticate_api_key(text)` with the service-role client. The function rejects a missing or revoked row. Application code compares the digests with `crypto.timingSafeEqual` and does not log the key, the hash, or the `Authorization` header.
- Clients read `api_keys_safe` (name, prefix, scopes, created, last used, revoked). `key_hash` is not granted to `anon` or `authenticated`. Inserts happen only in the server route. Revocation is `revoke_api_key(uuid)`, which updates a row only when `auth.uid()` owns it.

`SUPABASE_SERVICE_ROLE_KEY` is read on the server. Do not prefix it with `NEXT_PUBLIC_` and do not import the service-role client from a client component.

## Create and revoke a key

1. Sign in on the deployed site.
2. Open `/settings/api-keys` (also linked from the quest board footer).
3. Name the key and choose **Create API key**.
4. Copy the key and store it outside the app, then choose **I have saved this key**. Leaving the page clears it from the page state.
5. To revoke, choose **Revoke** and confirm. The list shows **Revoked**. Create a new key if you still need access.

Listing and revoking use your signed-in Supabase session. Creating a key and calling `/api/whoami` with a key also need `SUPABASE_SERVICE_ROLE_KEY` on the server.

## Call `/api/whoami`

`/api/whoami` does not read the browser session cookie. Send a bearer token: a personal API key or a Supabase user access token.

Missing or rejected credentials return **401** with `WWW-Authenticate: Bearer realm="life-ascension"`.

```bash
curl -i https://life-ascension.vercel.app/api/whoami \
  -H "Authorization: Bearer la_live_PASTE_THE_KEY_ONCE"
```

A valid key responds with JSON:

```json
{"user_id":"...","auth_method":"api_key","scopes":["quests:read","quests:write"]}
```

A Supabase user access token uses the same header and returns `"auth_method":"supabase_jwt"`. User JWTs expire; a personal key works until you revoke it.

Check the header without a real key:

```bash
curl -i https://life-ascension.vercel.app/api/whoami
```

Expect `HTTP/1.1 401` and a `WWW-Authenticate: Bearer` header. Do not paste a real key into GitHub, chat, or logs.

## Quest progress notes

`quest_progress` stores a note (1–1000 characters), an optional percent from 0 to 100, and a source of `web`, `chatgpt`, `grok`, or `api`. `instance_id` is optional and must belong to the same quest and user.

Signed-in users insert only through `add_quest_progress(...)`. The function checks `auth.uid()` owns the quest (and the instance, when one is sent) and inserts a row. It does not write `xp_ledger`, quest events, or instance status. XP stays on the existing completion path: confirm completion on the quest board, which calls `set_quest_instance_status`.

Open **Quest notes** from the quest board footer, then open a quest to add a note. The quest board layout, XP total, and scheduling behavior are unchanged.

Direct inserts and updates on `quest_progress` are not granted to browser roles. Users can read their own rows.

## Manual steps for Connor

This pull request does not run SQL against Supabase and does not change Vercel settings.

1. Review the draft. Leave `feature/scheduling-xp-dashboard` and PR #1 untouched. This migration stays `supabase/migrations/202610230002_api_keys_progress.sql` so later scheduling migrations can use `202610230003_*` and `202610230004_*`.
2. In the Supabase SQL editor, confirm `202610230001_core.sql` is already applied.
3. Paste and run `supabase/migrations/202610230002_api_keys_progress.sql`. That creates `api_keys`, `api_keys_safe`, `quest_progress`, `authenticate_api_key`, `revoke_api_key`, and `add_quest_progress`. It does not replace scheduling or XP functions.
4. If the API does not see the new objects, reload the schema: Dashboard → Project Settings → API, or run `NOTIFY pgrst, 'reload schema';` (the migration already sends that notify).
5. In Supabase → Project Settings → API, copy the `service_role` secret.
6. In Vercel → Project → Settings → Environment Variables, set `SUPABASE_SERVICE_ROLE_KEY` to that secret for Production (and Preview, if you test the preview URL). Do not use the `NEXT_PUBLIC_` prefix. Do not commit the value. Names only live in `.env.example` and `docs/.env.example`.
7. Redeploy so the server can read the variable.
8. Sign in, create a key at `/settings/api-keys`, and run the `/api/whoami` curl above. Revoke the key and run curl again. Expect 401.
9. Save a quest note and confirm the quest board XP and completion status stay the same until you explicitly complete the quest.

Optional local schema check (requires PostgreSQL, not CI):

```bash
tests/sql/run-local.sh
```

## Wire `authenticateRequest` into `/api/mcp` on PR #1

Do this on the integration branch after this review. Do not copy a second `/api/mcp` implementation onto this branch.

`lib/apiKeyAuth.ts` exports:

- `authenticateRequest(req)` → `{ ok: true, userId, method, scopes }` or `{ ok: false, status, error }`
- `authenticationErrorResponse(result)` → the 401/503 response. 401 includes `WWW-Authenticate: Bearer`.
- `hasScope(auth, scope)` for later scope checks

Replace the JWT-only block at the start of `POST` in `app/api/mcp/route.ts` with:

```ts
import { authenticateRequest, authenticationErrorResponse } from '../../../lib/apiKeyAuth';
import { createClient } from '@supabase/supabase-js';

const auth = await authenticateRequest(req);
if (!auth.ok) return authenticationErrorResponse(auth);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
}

let db;
if (auth.method === 'supabase_jwt') {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  db = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
} else {
  // API key: auth.userId is the owner. A service-role client has no auth.uid(),
  // so add_quest_progress and set_quest_instance_status would reject the call.
  // Keep using a user-scoped client, or add a follow-up that acts as auth.userId
  // without granting the service role to the model.
  return authenticationErrorResponse({
    ok: false,
    status: 401,
    error: 'API key tools are not wired yet',
  });
}
```

Then use `db` and `auth.userId` in the existing tools:

- `update_progress` should call `add_quest_progress` with the user-scoped client (`p_source` `chatgpt` or `grok`). The note is a journal entry. Completion and XP stay on `submit_completion` → `set_quest_instance_status` with an explicit confirmation.
- Keep filtering every read by the authenticated user. Do not point tool queries at the service-role client.

`GET /api/mcp` on PR #1 can keep returning 401. Add the same `WWW-Authenticate: Bearer` header there when you touch that route.

## Out of scope here

- OAuth, PKCE, refresh tokens, and dynamic client registration
- Replacing `ensure_quest_instance`, `set_quest_instance_status`, `create_scheduled_quest`, or `get_lifetime_xp`
- Dashboard XP aggregation and Chicago-local scheduling
- Applying the migration or setting the Vercel secret from this repository
