-- Replace the applied pastel Style Track with the dark catalog.
-- 202611110002 stays the version already applied on TEST (pastel rows). Do not edit it.
-- Reverse with supabase/rollbacks/20261112013453_companion_dark_catalog_down.sql.
--
-- Owned and worn rows move with the map below. When two worn pieces would share
-- the new slot, the higher unlock level is kept and both ownership rows remain.
-- The level 30 tactical headset is a later migration, not part of this swap.
-- Crypt XP is not touched.

alter table public.companion_cosmetic_catalog drop constraint if exists companion_cosmetic_catalog_slot_check;
alter table public.companion_cosmetic_catalog add constraint companion_cosmetic_catalog_slot_check
  check (slot in (
    'accent', 'shirt', 'pin', 'head', 'gown', 'boots', 'wand', 'pet', 'aura', 'wings', 'frame', 'accessory',
    'top', 'bottom', 'gloves', 'jacket', 'face', 'hair', 'tattoo', 'hip', 'companion', 'back'
  ));

insert into public.companion_cosmetic_catalog(id, label, slot, unlock_level, sort_order, grant_kind) values
  ('fingerless-gloves', 'Black fingerless gloves', 'gloves', 2, 101, 'level'),
  ('nose-ring', 'Silver nose ring', 'face', 4, 102, 'level'),
  ('cargo-pants', 'Black cargo pants', 'bottom', 6, 103, 'level'),
  ('crop-top', 'Black crop top', 'top', 8, 104, 'level'),
  ('leather-jacket', 'Cropped leather jacket', 'jacket', 10, 105, 'level'),
  ('wrist-tattoo', 'Small wrist tattoo', 'tattoo', 12, 106, 'level'),
  ('combat-boots', 'Buckled combat boots', 'boots', 14, 107, 'level'),
  ('silver-circlet', 'Silver circlet', 'head', 16, 108, 'level'),
  ('neon-hair-streak', 'Neon hair streak', 'hair', 18, 109, 'level'),
  ('arm-sleeve-tattoo', 'Glowing cyan arm-sleeve tattoo', 'tattoo', 20, 110, 'level'),
  ('utility-belt', 'Utility belt', 'hip', 22, 111, 'level'),
  ('cyber-visor', 'Cyber eye visor', 'face', 24, 112, 'level'),
  ('trench-coat', 'Long dark trench coat', 'jacket', 26, 113, 'level'),
  ('neck-tattoo', 'Glowing magenta neck tattoo', 'tattoo', 28, 114, 'level'),
  ('rune-lantern', 'Rune lantern', 'back', 32, 115, 'level'),
  ('armored-corset', 'Armored leather corset', 'top', 34, 116, 'level'),
  ('hand-tattoos', 'Glowing hand tattoos', 'tattoo', 36, 117, 'level'),
  ('hooded-cloak', 'Hooded cloak with neon trim', 'jacket', 38, 118, 'level'),
  ('rune-drone', 'Floating rune drone', 'companion', 40, 119, 'level'),
  ('shoulder-pauldron', 'Obsidian shoulder pauldron', 'back', 42, 120, 'level'),
  ('back-tattoo', 'Full back tattoo', 'tattoo', 44, 121, 'level'),
  ('silver-neon-hair', 'Silver hair with neon tips', 'hair', 46, 122, 'level'),
  ('neon-aura', 'Soft neon aura', 'aura', 48, 123, 'level'),
  ('obsidian-gown', 'Obsidian techwear gown with gold filigree', 'top', 50, 124, 'level'),
  ('neon-yoga-wrap', 'Neon yoga wrap', 'accessory', 1, 125, 'activity'),
  ('rune-cleaning-drone', 'Rune cleaning drone', 'companion', 1, 126, 'activity')
on conflict (id) do update set
  label = excluded.label,
  slot = excluded.slot,
  unlock_level = excluded.unlock_level,
  grant_kind = excluded.grant_kind;

drop table if exists companion_dark_remap;
create temporary table companion_dark_remap (
  old_id text primary key,
  new_id text not null unique
);

insert into companion_dark_remap(old_id, new_id) values
  ('ribbon', 'fingerless-gloves'),
  ('bow', 'nose-ring'),
  ('black-shirt', 'cargo-pants'),
  ('sparkle-boots', 'crop-top'),
  ('lantern-pin', 'leather-jacket'),
  ('flower-crown', 'wrist-tattoo'),
  ('heart-wand', 'combat-boots'),
  ('bunny', 'arm-sleeve-tattoo'),
  ('cat-ears', 'cyber-visor'),
  ('star-aura', 'rune-lantern'),
  ('tiara', 'armored-corset'),
  ('fairy-wings', 'rune-drone'),
  ('pastel-frame', 'back-tattoo'),
  ('princess', 'obsidian-gown'),
  ('yoga-mat', 'neon-yoga-wrap'),
  ('bubble-aura', 'rune-cleaning-drone');

insert into public.companion_owned_cosmetics(owner_id, cosmetic_id, unlocked_at, celebrated_at)
select o.owner_id, m.new_id, o.unlocked_at, o.celebrated_at
from public.companion_owned_cosmetics o
join companion_dark_remap m on m.old_id = o.cosmetic_id
on conflict (owner_id, cosmetic_id) do nothing;

drop table if exists companion_dark_worn_move;
create temporary table companion_dark_worn_move (
  owner_id uuid not null,
  slot text not null,
  cosmetic_id text not null,
  worn_at timestamptz not null,
  primary key (owner_id, slot)
);

insert into companion_dark_worn_move(owner_id, slot, cosmetic_id, worn_at)
select distinct on (w.owner_id, n.slot)
  w.owner_id, n.slot, n.id, w.worn_at
from public.companion_worn_cosmetics w
join companion_dark_remap m on m.old_id = w.cosmetic_id
join public.companion_cosmetic_catalog n on n.id = m.new_id
order by w.owner_id, n.slot, n.unlock_level desc, n.sort_order desc;

delete from public.companion_worn_cosmetics w
  using companion_dark_remap m
  where w.cosmetic_id = m.old_id;

insert into public.companion_worn_cosmetics(owner_id, slot, cosmetic_id, worn_at)
select owner_id, slot, cosmetic_id, worn_at
from companion_dark_worn_move
on conflict (owner_id, slot) do update
  set cosmetic_id = excluded.cosmetic_id,
      worn_at = excluded.worn_at;

insert into public.companion_activity_rewards(title_key, need_count, cosmetic_id) values
  ('yoga', 5, 'neon-yoga-wrap'),
  ('dishes', 10, 'rune-cleaning-drone')
on conflict (title_key) do update
  set need_count = excluded.need_count,
      cosmetic_id = excluded.cosmetic_id;

delete from public.companion_owned_cosmetics o
  using companion_dark_remap m
  where o.cosmetic_id = m.old_id;

delete from public.companion_cosmetic_catalog c
  using companion_dark_remap m
  where c.id = m.old_id;

update public.companion_cosmetic_catalog as c
set sort_order = v.sort_order
from (values
  ('fingerless-gloves', 1),
  ('nose-ring', 2),
  ('cargo-pants', 3),
  ('crop-top', 4),
  ('leather-jacket', 5),
  ('wrist-tattoo', 6),
  ('combat-boots', 7),
  ('silver-circlet', 8),
  ('neon-hair-streak', 9),
  ('arm-sleeve-tattoo', 10),
  ('utility-belt', 11),
  ('cyber-visor', 12),
  ('trench-coat', 13),
  ('neck-tattoo', 14),
  ('rune-lantern', 15),
  ('armored-corset', 16),
  ('hand-tattoos', 17),
  ('hooded-cloak', 18),
  ('rune-drone', 19),
  ('shoulder-pauldron', 20),
  ('back-tattoo', 21),
  ('silver-neon-hair', 22),
  ('neon-aura', 23),
  ('obsidian-gown', 24),
  ('neon-yoga-wrap', 25),
  ('rune-cleaning-drone', 26)
) as v(id, sort_order)
where c.id = v.id;

alter table public.companion_cosmetic_catalog drop constraint if exists companion_cosmetic_catalog_slot_check;
alter table public.companion_cosmetic_catalog add constraint companion_cosmetic_catalog_slot_check
  check (slot in (
    'top', 'bottom', 'boots', 'gloves', 'jacket', 'head', 'face', 'hair', 'tattoo', 'hip', 'aura', 'companion', 'back', 'accessory'
  ));

notify pgrst, 'reload schema';
