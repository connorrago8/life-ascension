-- Reverse 202611280010_nutrition_diary.sql. Drops the diary tables only.
-- Do not run this once real meals should be kept.

drop function if exists public.read_nutrition_for_grant(text, date);
drop function if exists public.revoke_nutrition_ai_grant(uuid);
drop function if exists public.record_nutrition_parse(uuid, text, text, text, integer, integer, numeric, integer);
drop function if exists public.remember_nutrition_portion(text, numeric, text, numeric, numeric, numeric, numeric, numeric, numeric);
drop function if exists public.log_saved_meal(uuid, date, uuid, timestamptz);
drop function if exists public.save_nutrition_favorite(uuid, text, text);
drop function if exists public.delete_nutrition_entry(uuid);
drop function if exists public.update_nutrition_entry(uuid, date, text, text, jsonb);
drop function if exists public.confirm_nutrition_entry(uuid, date, text, text, text, jsonb, timestamptz, uuid, text);
drop function if exists public._nutrition_replace_items(uuid, uuid, jsonb);
drop function if exists public._nutrition_diary_allowed(date);

drop table if exists public.nutrition_ai_grants;
drop table if exists public.nutrition_parse_events;
drop table if exists public.nutrition_portion_memory;
drop table if exists public.nutrition_aliases;
drop table if exists public.saved_meal_items;
drop table if exists public.saved_meals;
drop table if exists public.nutrition_items;
drop table if exists public.nutrition_entries;
