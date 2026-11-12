-- Founder-adopted pack: Nightcat Headset at level 30.
-- Sleek tactical headgear. Gunmetal, faint cyan status dots. Not a cute ear piece.
-- Reverse with supabase/rollbacks/20261112014116_nightcat_headset_down.sql.
-- Crypt XP is not touched. Slot stays head, so only one head piece can be worn.

-- Free sort_order 15 without colliding with the unique index.
update public.companion_cosmetic_catalog
  set sort_order = sort_order + 100
  where sort_order >= 15;
update public.companion_cosmetic_catalog
  set sort_order = sort_order - 99
  where sort_order >= 115;

insert into public.companion_cosmetic_catalog(id, label, slot, unlock_level, sort_order, grant_kind)
values ('nightcat-headset', 'Nightcat Headset', 'head', 30, 15, 'level')
on conflict (id) do update set
  label = excluded.label,
  slot = excluded.slot,
  unlock_level = excluded.unlock_level,
  sort_order = excluded.sort_order,
  grant_kind = excluded.grant_kind;

notify pgrst, 'reload schema';
