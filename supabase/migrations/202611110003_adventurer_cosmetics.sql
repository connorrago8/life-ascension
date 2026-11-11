-- Connor adventurer cosmetics. Distinct from Izzy's Style Track.
-- Additive. Reverse with supabase/rollbacks/202611110003_adventurer_cosmetics_down.sql.
-- Does not touch Crypt XP or Ashen Hood.

create table if not exists public.adventurer_cosmetic_catalog (
  id text primary key,
  label text not null,
  slot text not null,
  unlock_level integer not null check (unlock_level >= 1),
  sort_order integer not null
);

insert into public.adventurer_cosmetic_catalog(id, label, slot, unlock_level, sort_order) values
  ('shadow-hood', 'Shadow hood', 'head', 2, 1),
  ('leather-bracers', 'Worn leather bracers', 'hands', 4, 2),
  ('dark-tunic', 'Dark traveler tunic', 'chest', 6, 3),
  ('road-boots', 'Road-worn boots', 'feet', 8, 4),
  ('pathfinder-cloak', 'Pathfinder cloak', 'back', 10, 5),
  ('rune-belt', 'Rune-etched belt', 'waist', 12, 6),
  ('iron-pauldrons', 'Iron pauldrons', 'shoulders', 14, 7),
  ('scarred-gloves', 'Scarred gloves', 'hands', 16, 8),
  ('traveler-pants', 'Reinforced traveler pants', 'legs', 18, 9),
  ('ember-circlet', 'Ember circlet', 'head', 20, 10),
  ('void-gauntlets', 'Void-touched gauntlets', 'hands', 22, 11),
  ('storm-cape', 'Storm cape', 'back', 24, 12),
  ('obsidian-vest', 'Obsidian vest', 'chest', 26, 13),
  ('neon-edge-bracers', 'Neon-edge bracers', 'hands', 28, 14),
  ('warden-boots', 'Warden boots', 'feet', 30, 15),
  ('arcane-shoulders', 'Arcane shoulders', 'shoulders', 32, 16),
  ('silver-mask', 'Silver half-mask', 'face', 34, 17),
  ('longcoat', 'Dark longcoat', 'chest', 36, 18),
  ('rune-lantern-pack', 'Rune lantern pack', 'back', 38, 19),
  ('void-aura', 'Soft void aura', 'aura', 40, 20),
  ('gold-filigree-armor', 'Gold filigree armor', 'chest', 42, 21),
  ('neon-trim-cloak', 'Neon-trim cloak', 'back', 44, 22),
  ('cyber-visor', 'Cyber visor', 'face', 46, 23),
  ('obsidian-pauldrons', 'Obsidian pauldrons', 'shoulders', 48, 24),
  ('legendary-coat', 'Legendary wayfarer coat', 'chest', 50, 25)
on conflict (id) do nothing;

alter table public.adventurer_cosmetic_catalog enable row level security;
create policy adventurer_catalog_read on public.adventurer_cosmetic_catalog
  for select to authenticated using (true);
revoke all on public.adventurer_cosmetic_catalog from public, anon, authenticated;
grant select on public.adventurer_cosmetic_catalog to authenticated;
