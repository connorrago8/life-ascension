-- Reverses supabase/migrations/202610300002_wellness_readings.sql. TEST only.
-- Drops only objects that migration created. Wellness readings are deleted; nothing else is touched.
drop function if exists public.record_wellness_reading_as_user(uuid, date, numeric, integer, text);
drop function if exists public.record_wellness_reading(date, numeric, integer, text);
drop table if exists public.wellness_readings;
