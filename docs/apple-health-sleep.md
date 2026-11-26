# Apple Health sleep and nutrition

The iPhone Shortcut records Lights Out from last night's sleep and stores one day of nutrition on your account. This is separate from Settings → API keys and from `/api/wellness`. Wellness readings still do not award XP.

Oura and Whoop already sync into Apple Health. You do not connect them separately. The Shortcut reads Apple Health, and overlapping sleep samples from Oura, Whoop, and Apple Watch count as one night.

Cronometer is the nutrition source. It writes Dietary Energy, Protein, Carbohydrates, Total Fat, Fiber, and Water into Apple Health. Confirm this on the free plan, and run the automation once with the phone locked. A locked phone can block Health access even when the Shortcut is set to run immediately.

## 1. Create the ingest token

1. Open the app and go to **Settings → Apple Health** (`/settings/apple-health`).
2. Tap **Generate token**.
3. Copy the token. It starts with `la_sleep_` and is shown **once**. The server stores only a SHA-256 hash.
4. **Rotate** replaces it. **Revoke** stops the Shortcut until you generate another. Paste the new token into the Shortcut after a rotation.

Treat the token like a password. Anyone who has it can record Lights Out and write nutrition for your account.

## 2. Build the Shortcut

Open Shortcuts → **+**. Allow Health access when iOS asks.

Add these actions in order:

1. **Find Health Samples** where Type is **Sleep** and Start Date is in the last `18` hours. Do not filter down to one source. Oura, Whoop, and Apple Watch can all return samples for the same night.
2. **Repeat with Each** sample.
   - **Get Details of Health Sample**: Start Date, End Date, Source, and Value.
   - If Value is **In Bed** or **Awake**, skip it. Asleep, Core, Deep, and REM stay.
   - **Format Date** on the start and the end. Choose **ISO 8601** so the value includes a timezone offset, for example `2026-11-25T22:45:00-06:00`.
   - Add a Dictionary to a list named `samples` with `start`, `end`, `source_name` (the Source name), and `value`.
3. From the asleep samples, the server keeps the earliest start on that night. You can also set `sleep_start` and `sleep_end` from the first asleep sample. Set `source` to the text `apple_health`.
4. Build the sleep `request_id`. **Format Date** on the current date, custom `yyyyMMddHHmm`. **Text**: `00000000-0000-4000-8000-` plus that 12-digit text.
5. **Get Contents of URL** for sleep
   - URL: `https://<your app>/api/health/sleep`
   - Method: **POST**
   - Headers: `Authorization` = `Bearer la_sleep_…`, `Content-Type` = `application/json`
   - Request Body: **JSON** with `sleep_start`, `sleep_end`, `source` = `apple_health`, `samples`, and `request_id`

```json
{
  "sleep_start": "2026-11-25T22:45:00-06:00",
  "sleep_end": "2026-11-26T06:30:00-06:00",
  "source": "apple_health",
  "request_id": "00000000-0000-4000-8000-202611260700",
  "samples": [
    { "start": "2026-11-25T22:40:00-06:00", "end": "2026-11-26T06:00:00-06:00", "source_name": "Oura", "value": "Asleep" },
    { "start": "2026-11-25T22:50:00-06:00", "end": "2026-11-26T06:10:00-06:00", "source_name": "Whoop", "value": "Asleep" }
  ]
}
```

6. **Find Health Samples** again, for the game day that starts at **5:00 AM** Chicago. Sum these Health types:
   - **DietaryEnergyConsumed** → `energy_kcal` (the name `dietary_energy_kcal` is also accepted)
   - **DietaryProtein** → `protein_g`
   - **DietaryCarbohydrates** → `carbs_g`
   - **DietaryFatTotal** → `fat_g`
   - **Fiber** and **Water** may be read, but the server discards them. Do not rely on them being saved.
   If a type has no samples, send `null`. That means "not verified." Send `0` only when the diary really recorded zero. An empty or failed read is "no log seen," never a row of zeros.
7. **Get Contents of URL** again, to `https://<your app>/api/health/nutrition`, with the same Bearer token and a **new** `request_id`. This post is independent. If it fails, Lights Out from step 5 still stands.

```json
{
  "schema_version": 1,
  "game_date": "2026-11-26",
  "timezone": "America/Chicago",
  "basis": "game_window",
  "source": "cronometer",
  "observed_at": "2026-11-26T07:00:00-06:00",
  "request_id": "00000000-0000-4000-8000-202611260701",
  "energy_kcal": 2100,
  "protein_g": 140,
  "carbs_g": 220,
  "fat_g": 70,
  "fiber_g": 30,
  "water_ml": 2400,
  "read_status": "complete"
}
```

`game_date` is the game day. It changes at **5:00 AM** America/Chicago. 4:59 AM still belongs to the previous game day. 5:00 AM starts the new one. `basis` is `game_window` when you summed samples inside that window, or `diary_date` when Cronometer's diary date is the key. `timezone` must be `America/Chicago`. There is no user id in the body. The token says whose account it is.

A failed Health read can still be posted: `"read_status": "failed"` and null totals. That records the attempt and does not invent zeros.

A good sleep result looks like `{"ok":true,"xp_awarded":5,"sleep":{"receipt":"Auto from Apple Health (Oura)"}}`. Nutrition always reports `"xp_awarded": 0`.

## 3. Run it every morning

Shortcuts → **Automation** → **+** → **Personal Automation** → **Time of Day** → **7:00 AM**, **Daily** → **Run Immediately**.

At 7:00 AM the game day has already started (5:00 AM), so "today" and the game day are the same calendar date. Use yesterday's game day only when you are sending the food that belonged to the previous night's day.

Verify two things before you trust it:

- Cronometer's **free** plan is actually writing DietaryEnergyConsumed, DietaryProtein, DietaryCarbohydrates, and DietaryFatTotal into Apple Health. Fiber and Water can be present; this import ignores them.
- The automation still runs, or you know that it does not, when the **phone is locked**.

## Rules

Lights Out credit uses the same record path as the Health screen button.

- The night runs from 5:00 PM to 5:00 AM Chicago. The deadline is 11:00 PM Chicago (`LIGHTS_OUT_DEADLINE`).
- Asleep at or before 11:00 PM gets the usual award: 5 XP plus the streak bonus, capped.
- 11:30 PM, midnight, and 4:59 AM are the same night and earn no XP. 5:00 AM is the next game day and is not a bedtime.
- In-bed and awake samples are ignored. The earliest remaining start is the one that counts, once.
- The receipt is `Auto from Apple Health`, or `Auto from Apple Health (Oura)` when that earliest sample has a source name.
- A duplicate sleep request id, or a night that is already recorded, adds 0 XP. Manual entry still works. Whichever arrives first wins.
- Only the current game day and the previous two can be recorded.

Nutrition is a shadow import in `health_nutrition_days`. It does not complete a quest, change a score, or award XP. It does not write the meal log.

- Stored fields are energy (kcal), protein, carbohydrates, and total fat, plus the observation time, basis, and read status. Source is `cronometer`.
- Fiber and water are accepted in the JSON and discarded. They are not columns.
- Null means missing or unverified. Zero is a real observed value. An empty read stays null. It is never stored as zero.
- A newer `observed_at` wins. A null in that newer read does not erase a number already saved. An older observation does not overwrite a newer one.
- The same `request_id` is rejected and does not change the row.
- Only you can read the row. It is not shown to Izzy, on shared cards, on badges, in a profile export, or through MCP.
- Sleep and nutrition do not share a request. A bad nutrition post cannot undo Lights Out.

Responses: `200` saved, `400` the day is outside the window or the body is invalid, `401` the token is missing, wrong, or revoked, `409` that nutrition request id was already used, `429` too many requests, `413` the body is over 16 KB.

## TEST migration

Applied only on TEST project `njqwwimzrsunheehnnnt`. The repo file is `supabase/migrations/202611260210_apple_health_sleep.sql`, recorded as version `202611260210` / `apple_health_sleep` so a later push does not run it again. The objects were applied as `20261126020007` (tables), `20261126020014` (token functions), `20261126020025` and `20261126020131` (sleep function), and `20261126020034` (nutrition function). Version `202611260040` was already `finance_transactions` on TEST, so this file does not use that number. The smoke ran inside a transaction that rolled back. Lights-out rows, meal rows, nutrition rows, and the user count were unchanged. Production project `ugcvhmrriazbbymjxvch` was not used.

## Preview builds

Vercel Preview deployments are behind Deployment Protection. A Shortcut without a Vercel bypass gets Vercel's login page. The ingest itself does not use the service-role key. It calls a database function with the hashed token. Production project `ugcvhmrriazbbymjxvch` is not a target.
