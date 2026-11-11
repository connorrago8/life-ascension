# Apple Health → Wellness (iPhone Shortcut)

Your iPhone sends last night's sleep and yesterday's steps to LIFE ASCENSION once a day.
The Character screen's **Wellness** section then shows the latest reading. Readings never award XP.

## 1. Make an API key

1. Open the app, go to **Settings → API keys** (`/settings/api-keys`).
2. Name it `Apple Health` and tap **Create**.
3. Copy the key (it starts with `la_live_`). It is shown **once**. Revoke it there at any time.

Treat the key like a password: anyone with it can write wellness readings and quests to your account.

## 2. Build the Shortcut (Shortcuts app → +)

Add these actions in order:

1. **Date** → Current Date. **Adjust Date** → subtract `1` day. **Format Date** → Custom, `yyyy-MM-dd`.
   Name the result `Day` (this is yesterday, the day the steps belong to).
2. **Find Health Samples** where *Type* is **Steps** and *Start Date* is **yesterday**
   (Start Date *is in the last* `1` day also works when it runs at 8 AM).
   **Calculate Statistics** → **Sum** of the Health Samples. Name it `Steps`.
3. **Find Health Samples** where *Type* is **Sleep Analysis**, *Start Date* is **in the last 1 day**,
   and *Value* is **not In Bed** / **not Awake** (only asleep stages).
   **Get Details of Health Samples** → **Duration**, then **Calculate Statistics** → **Sum**.
   **Calculate** the total in hours: divide by `60` if the total is minutes (by `3600` if seconds).
   Check it once with **Quick Look**; it should be about 6–9. Name it `Sleep`.
4. **Get Contents of URL**
   - URL: `https://<your app>/api/wellness`
   - Method: **POST**
   - Headers: `Authorization` = `Bearer la_live_…` (your key), `Content-Type` = `application/json`
   - Request Body: **JSON** with
     - `date` (Text) = `Day`
     - `sleep_hours` (Number) = `Sleep`
     - `steps` (Number) = `Steps`
5. Optional: **Show Result** while testing. A good post returns
   `{"ok":true,"reading":{"date":"…","sleep_hours":7.25,"steps":9100,…}}`.

## 3. Run it every morning

Shortcuts → **Automation** → **+** → **Personal Automation** → **Time of Day** → `8:00 AM`, **Daily**
→ **Run Immediately** (turn off *Notify When Run* if you like) → choose the Shortcut.

## API reference

`POST /api/wellness`

```json
{ "date": "2026-10-29", "sleep_hours": 7.25, "steps": 9100 }
```

- `Authorization: Bearer <API key>` (Settings → API keys; the same keys as `/api/mcp`). A signed-in
  user's Supabase access token is also accepted. The key needs the default `quests:write` scope.
- `date`: `YYYY-MM-DD`, from 30 days ago through tomorrow (America/Chicago). Defaults to today.
- `sleep_hours`: 0–24 (rounded to 0.01). `steps`: 0–200000 (rounded to a whole number).
  Send either or both; numeric strings like `"9,100"` are accepted. A value you leave out keeps
  what was already saved for that date.
- Posting the same `date` again updates that day (one reading per day).
- Responses: `200 {"ok":true,"reading":{…}}`, `400 {"error":"…"}` (bad JSON or range),
  `401` (missing, invalid or revoked key), `403` (key without write scope), `413` (body over 4 KB),
  `503` (not configured on this deployment).

Readings are stored in `public.wellness_readings` (one row per user per date). Row-level security
lets you read only your own rows; writes happen only through the endpoint's checked functions.

## Preview / test builds

Vercel **Preview** deployments are behind Vercel Deployment Protection: a Shortcut request without a
Vercel login or share cookie gets Vercel's login page (HTTP 401), not the app. Preview builds also
refuse personal API keys by design (no service-role access outside Production or local dev), so an
API-key post to a Preview returns `503` even with the share cookie. To try the Shortcut before
release, run the app locally against the TEST database, or the project owner must approve a
Protection Bypass for Automation (a Vercel project setting) and service-role access for that Preview.
