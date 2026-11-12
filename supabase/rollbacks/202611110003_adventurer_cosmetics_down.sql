-- Reverse Connor adventurer cosmetics. TEST only.

delete from public.adventurer_cosmetic_catalog
  where id in (
    'shadow-hood','leather-bracers','dark-tunic','road-boots','pathfinder-cloak',
    'rune-belt','iron-pauldrons','scarred-gloves','traveler-pants','ember-circlet',
    'void-gauntlets','storm-cape','obsidian-vest','neon-edge-bracers','warden-boots',
    'arcane-shoulders','silver-mask','longcoat','rune-lantern-pack','void-aura',
    'gold-filigree-armor','neon-trim-cloak','cyber-visor','obsidian-pauldrons','legendary-coat'
  );

drop table if exists public.adventurer_cosmetic_catalog;
