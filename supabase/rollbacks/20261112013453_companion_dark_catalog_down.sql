-- Reverse the dark catalog swap. Restores the 16 pastel rows from 0001 + 0002.
-- Ownership of a mapped dark piece returns to its pastel id.
-- Dark pieces with no pastel pair are removed.
-- When several worn dark pieces map back onto one pastel slot, the higher pastel level is kept.

begin;

alter table public.companion_cosmetic_catalog drop constraint if exists companion_cosmetic_catalog_slot_check;
alter table public.companion_cosmetic_catalog add constraint companion_cosmetic_catalog_slot_check
  check (slot in (
    'accent', 'shirt', 'pin', 'head', 'gown', 'boots', 'wand', 'pet', 'aura', 'wings', 'frame', 'accessory',
    'top', 'bottom', 'gloves', 'jacket', 'face', 'hair', 'tattoo', 'hip', 'companion', 'back'
  ));

update public.companion_cosmetic_catalog
  set sort_order = sort_order + 400
  where id in (
    'fingerless-gloves', 'nose-ring', 'cargo-pants', 'crop-top', 'leather-jacket', 'wrist-tattoo',
    'combat-boots', 'silver-circlet', 'neon-hair-streak', 'arm-sleeve-tattoo', 'utility-belt',
    'cyber-visor', 'trench-coat', 'neck-tattoo', 'rune-lantern', 'armored-corset', 'hand-tattoos',
    'hooded-cloak', 'rune-drone', 'shoulder-pauldron', 'back-tattoo', 'silver-neon-hair',
    'neon-aura', 'obsidian-gown', 'neon-yoga-wrap', 'rune-cleaning-drone'
  );

insert into public.companion_cosmetic_catalog(id, label, slot, unlock_level, sort_order, grant_kind) values
  ('ribbon', 'Ribbon', 'accent', 2, 1, 'level'),
  ('black-shirt', 'Black shirt', 'shirt', 5, 2, 'level'),
  ('lantern-pin', 'Lantern pin', 'pin', 10, 3, 'level'),
  ('cat-ears', 'Cat ears', 'head', 25, 4, 'level'),
  ('princess', 'Princess', 'gown', 50, 5, 'level'),
  ('bow', 'Hair bow', 'accessory', 3, 6, 'level'),
  ('sparkle-boots', 'Sparkly boots', 'boots', 7, 7, 'level'),
  ('flower-crown', 'Flower crown', 'head', 12, 8, 'level'),
  ('heart-wand', 'Heart wand', 'wand', 15, 9, 'level'),
  ('bunny', 'Bunny', 'pet', 20, 10, 'level'),
  ('star-aura', 'Star aura', 'aura', 30, 11, 'level'),
  ('tiara', 'Tiara', 'head', 35, 12, 'level'),
  ('fairy-wings', 'Fairy wings', 'wings', 40, 13, 'level'),
  ('pastel-frame', 'Pastel frame', 'frame', 45, 14, 'level'),
  ('yoga-mat', 'Yoga mat', 'accessory', 1, 15, 'activity'),
  ('bubble-aura', 'Bubble aura', 'aura', 1, 16, 'activity')
on conflict (id) do update set
  label = excluded.label,
  slot = excluded.slot,
  unlock_level = excluded.unlock_level,
  sort_order = excluded.sort_order,
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
select o.owner_id, m.old_id, o.unlocked_at, o.celebrated_at
from public.companion_owned_cosmetics o
join companion_dark_remap m on m.new_id = o.cosmetic_id
on conflict (owner_id, cosmetic_id) do nothing;

drop table if exists companion_dark_worn_back;
create temporary table companion_dark_worn_back (
  owner_id uuid not null,
  slot text not null,
  cosmetic_id text not null,
  worn_at timestamptz not null,
  primary key (owner_id, slot)
);

insert into companion_dark_worn_back(owner_id, slot, cosmetic_id, worn_at)
select distinct on (w.owner_id, c.slot)
  w.owner_id, c.slot, c.id, w.worn_at
from public.companion_worn_cosmetics w
join companion_dark_remap m on m.new_id = w.cosmetic_id
join public.companion_cosmetic_catalog c on c.id = m.old_id
order by w.owner_id, c.slot, c.unlock_level desc, c.sort_order desc;

delete from public.companion_worn_cosmetics w
  using companion_dark_remap m
  where w.cosmetic_id = m.new_id;

insert into public.companion_worn_cosmetics(owner_id, slot, cosmetic_id, worn_at)
select owner_id, slot, cosmetic_id, worn_at
from companion_dark_worn_back
on conflict (owner_id, slot) do update
  set cosmetic_id = excluded.cosmetic_id,
      worn_at = excluded.worn_at;

insert into public.companion_activity_rewards(title_key, need_count, cosmetic_id) values
  ('yoga', 5, 'yoga-mat'),
  ('dishes', 10, 'bubble-aura')
on conflict (title_key) do update
  set need_count = excluded.need_count,
      cosmetic_id = excluded.cosmetic_id;

delete from public.companion_worn_cosmetics
  where cosmetic_id in (
    'fingerless-gloves', 'nose-ring', 'cargo-pants', 'crop-top', 'leather-jacket', 'wrist-tattoo',
    'combat-boots', 'silver-circlet', 'neon-hair-streak', 'arm-sleeve-tattoo', 'utility-belt',
    'cyber-visor', 'trench-coat', 'neck-tattoo', 'rune-lantern', 'armored-corset', 'hand-tattoos',
    'hooded-cloak', 'rune-drone', 'shoulder-pauldron', 'back-tattoo', 'silver-neon-hair',
    'neon-aura', 'obsidian-gown', 'neon-yoga-wrap', 'rune-cleaning-drone'
  );
delete from public.companion_owned_cosmetics
  where cosmetic_id in (
    'fingerless-gloves', 'nose-ring', 'cargo-pants', 'crop-top', 'leather-jacket', 'wrist-tattoo',
    'combat-boots', 'silver-circlet', 'neon-hair-streak', 'arm-sleeve-tattoo', 'utility-belt',
    'cyber-visor', 'trench-coat', 'neck-tattoo', 'rune-lantern', 'armored-corset', 'hand-tattoos',
    'hooded-cloak', 'rune-drone', 'shoulder-pauldron', 'back-tattoo', 'silver-neon-hair',
    'neon-aura', 'obsidian-gown', 'neon-yoga-wrap', 'rune-cleaning-drone'
  );
delete from public.companion_cosmetic_catalog
  where id in (
    'fingerless-gloves', 'nose-ring', 'cargo-pants', 'crop-top', 'leather-jacket', 'wrist-tattoo',
    'combat-boots', 'silver-circlet', 'neon-hair-streak', 'arm-sleeve-tattoo', 'utility-belt',
    'cyber-visor', 'trench-coat', 'neck-tattoo', 'rune-lantern', 'armored-corset', 'hand-tattoos',
    'hooded-cloak', 'rune-drone', 'shoulder-pauldron', 'back-tattoo', 'silver-neon-hair',
    'neon-aura', 'obsidian-gown', 'neon-yoga-wrap', 'rune-cleaning-drone'
  );

alter table public.companion_cosmetic_catalog drop constraint if exists companion_cosmetic_catalog_slot_check;
alter table public.companion_cosmetic_catalog add constraint companion_cosmetic_catalog_slot_check
  check (slot in ('accent', 'shirt', 'pin', 'head', 'gown', 'boots', 'wand', 'pet', 'aura', 'wings', 'frame', 'accessory'));

notify pgrst, 'reload schema';
commit;
