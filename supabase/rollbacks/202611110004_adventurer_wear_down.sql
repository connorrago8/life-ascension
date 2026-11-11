-- Reverse Connor wear persistence. TEST only.

drop function if exists public.adventurer_set_worn(text, boolean);
drop function if exists public.adventurer_get_worn();
drop table if exists public.adventurer_worn;
