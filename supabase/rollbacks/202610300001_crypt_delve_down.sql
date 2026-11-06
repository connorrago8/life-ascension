-- Reverses supabase/migrations/202610300001_crypt_delve.sql. TEST only.
-- Drops only objects that migration created. Crypt loot, attributes, checkpoints and Crypt XP tenths are deleted;
-- xp_ledger, quests and earned armor are untouched.
drop function if exists public.get_crypt_profile();
drop function if exists public.get_crypt_xp();
drop function if exists public.record_crypt_floor_clear(uuid, integer);
drop function if exists public.claim_crypt_loot(uuid, integer, text);
drop function if exists public.set_crypt_attributes(integer, integer, integer, integer, integer);
drop function if exists public.crypt_today();
drop function if exists public.crypt_level_for_owner(uuid);
drop table if exists public.crypt_xp_daily;
drop table if exists public.crypt_floor_clears;
drop table if exists public.crypt_progress;
drop table if exists public.crypt_loot;
drop table if exists public.crypt_hero;
