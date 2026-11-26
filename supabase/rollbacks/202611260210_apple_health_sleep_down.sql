-- Drops the Apple Health ingest objects only.
-- Does not delete health_meals, health_lights_out, quests, xp_ledger, or gear.
-- Meal rows that an ingest created stay. They are ordinary 0 XP meal logs.
-- Do not run this against production.

drop function if exists public.ingest_cronometer_nutrition(text, uuid, date, timestamptz, text, text, numeric, numeric, numeric, numeric);
drop function if exists public.ingest_apple_health(text, uuid, timestamptz, timestamptz, text, text);
drop function if exists public.revoke_health_ingest_token();
drop function if exists public.issue_health_ingest_token(boolean);
drop function if exists public.apple_health_sleep_decision(timestamptz);
drop function if exists public.apple_health_game_day(timestamptz);
drop view if exists public.health_ingest_tokens_safe;
drop table if exists public.health_nutrition_days;
drop table if exists public.health_nutrition_requests;
drop table if exists public.health_sleep_ingest;
drop table if exists public.health_ingest_hits;
drop table if exists public.health_ingest_tokens;
