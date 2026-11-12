-- Reverse Connor wear persistence. TEST only.

drop function if exists public.adventurer_set_worn(text, boolean);
drop function if exists public.adventurer_get_worn();
drop function if exists public.level_for_xp(bigint);
drop table if exists public.adventurer_worn;
