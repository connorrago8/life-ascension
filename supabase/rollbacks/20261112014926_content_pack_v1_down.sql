-- Reverse content pack names and the duration-band activity function.
-- Cosmetic ids are not deleted. Previous labels and Connor slots are restored.

begin;

update public.companion_cosmetic_catalog set label = 'Black fingerless gloves', description = null where id = 'fingerless-gloves';
update public.companion_cosmetic_catalog set label = 'Silver nose ring', description = null where id = 'nose-ring';
update public.companion_cosmetic_catalog set label = 'Black cargo pants', description = null where id = 'cargo-pants';
update public.companion_cosmetic_catalog set label = 'Black crop top', description = null where id = 'crop-top';
update public.companion_cosmetic_catalog set label = 'Cropped leather jacket', description = null where id = 'leather-jacket';
update public.companion_cosmetic_catalog set label = 'Small wrist tattoo', description = null where id = 'wrist-tattoo';
update public.companion_cosmetic_catalog set label = 'Buckled combat boots', description = null where id = 'combat-boots';
update public.companion_cosmetic_catalog set label = 'Silver circlet', description = null where id = 'silver-circlet';
update public.companion_cosmetic_catalog set label = 'Neon hair streak', description = null where id = 'neon-hair-streak';
update public.companion_cosmetic_catalog set label = 'Glowing cyan arm-sleeve tattoo', description = null where id = 'arm-sleeve-tattoo';
update public.companion_cosmetic_catalog set label = 'Utility belt', description = null where id = 'utility-belt';
update public.companion_cosmetic_catalog set label = 'Cyber eye visor', description = null where id = 'cyber-visor';
update public.companion_cosmetic_catalog set label = 'Long dark trench coat', description = null where id = 'trench-coat';
update public.companion_cosmetic_catalog set label = 'Glowing magenta neck tattoo', description = null where id = 'neck-tattoo';
update public.companion_cosmetic_catalog set label = 'Nightcat Headset', description = null where id = 'nightcat-headset';
update public.companion_cosmetic_catalog set label = 'Rune lantern', description = null where id = 'rune-lantern';
update public.companion_cosmetic_catalog set label = 'Armored leather corset', description = null where id = 'armored-corset';
update public.companion_cosmetic_catalog set label = 'Glowing hand tattoos', description = null where id = 'hand-tattoos';
update public.companion_cosmetic_catalog set label = 'Hooded cloak with neon trim', description = null where id = 'hooded-cloak';
update public.companion_cosmetic_catalog set label = 'Floating rune drone', description = null where id = 'rune-drone';
update public.companion_cosmetic_catalog set label = 'Obsidian shoulder pauldron', description = null where id = 'shoulder-pauldron';
update public.companion_cosmetic_catalog set label = 'Full back tattoo', description = null where id = 'back-tattoo';
update public.companion_cosmetic_catalog set label = 'Silver hair with neon tips', description = null where id = 'silver-neon-hair';
update public.companion_cosmetic_catalog set label = 'Soft neon aura', description = null where id = 'neon-aura';
update public.companion_cosmetic_catalog set label = 'Obsidian techwear gown with gold filigree', description = null where id = 'obsidian-gown';

update public.adventurer_cosmetic_catalog set label = 'Shadow hood', slot = 'head', description = null where id = 'shadow-hood';
update public.adventurer_cosmetic_catalog set label = 'Worn leather bracers', slot = 'hands', description = null where id = 'leather-bracers';
update public.adventurer_cosmetic_catalog set label = 'Dark traveler tunic', slot = 'chest', description = null where id = 'dark-tunic';
update public.adventurer_cosmetic_catalog set label = 'Road-worn boots', slot = 'feet', description = null where id = 'road-boots';
update public.adventurer_cosmetic_catalog set label = 'Pathfinder cloak', slot = 'back', description = null where id = 'pathfinder-cloak';
update public.adventurer_cosmetic_catalog set label = 'Rune-etched belt', slot = 'waist', description = null where id = 'rune-belt';
update public.adventurer_cosmetic_catalog set label = 'Iron pauldrons', slot = 'shoulders', description = null where id = 'iron-pauldrons';
update public.adventurer_cosmetic_catalog set label = 'Scarred gloves', slot = 'hands', description = null where id = 'scarred-gloves';
update public.adventurer_cosmetic_catalog set label = 'Reinforced traveler pants', slot = 'legs', description = null where id = 'traveler-pants';
update public.adventurer_cosmetic_catalog set label = 'Ember circlet', slot = 'head', description = null where id = 'ember-circlet';
update public.adventurer_cosmetic_catalog set label = 'Void-touched gauntlets', slot = 'hands', description = null where id = 'void-gauntlets';
update public.adventurer_cosmetic_catalog set label = 'Storm cape', slot = 'back', description = null where id = 'storm-cape';
update public.adventurer_cosmetic_catalog set label = 'Obsidian vest', slot = 'chest', description = null where id = 'obsidian-vest';
update public.adventurer_cosmetic_catalog set label = 'Neon-edge bracers', slot = 'hands', description = null where id = 'neon-edge-bracers';
update public.adventurer_cosmetic_catalog set label = 'Warden boots', slot = 'feet', description = null where id = 'warden-boots';
update public.adventurer_cosmetic_catalog set label = 'Arcane shoulders', slot = 'shoulders', description = null where id = 'arcane-shoulders';
update public.adventurer_cosmetic_catalog set label = 'Silver half-mask', slot = 'face', description = null where id = 'silver-mask';
update public.adventurer_cosmetic_catalog set label = 'Dark longcoat', slot = 'chest', description = null where id = 'longcoat';
update public.adventurer_cosmetic_catalog set label = 'Rune lantern pack', slot = 'back', description = null where id = 'rune-lantern-pack';
update public.adventurer_cosmetic_catalog set label = 'Soft void aura', slot = 'aura', description = null where id = 'void-aura';
update public.adventurer_cosmetic_catalog set label = 'Gold filigree armor', slot = 'chest', description = null where id = 'gold-filigree-armor';
update public.adventurer_cosmetic_catalog set label = 'Neon-trim cloak', slot = 'back', description = null where id = 'neon-trim-cloak';
update public.adventurer_cosmetic_catalog set label = 'Cyber visor', slot = 'face', description = null where id = 'cyber-visor';
update public.adventurer_cosmetic_catalog set label = 'Obsidian pauldrons', slot = 'shoulders', description = null where id = 'obsidian-pauldrons';
update public.adventurer_cosmetic_catalog set label = 'Legendary wayfarer coat', slot = 'chest', description = null where id = 'legendary-coat';

create or replace function public.companion_log_activity_v2(
  p_request uuid, p_title text, p_note text, p_tier text default null, p_recorded_on date default null
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  u uuid := auth.uid();
  b public.companion_bonds%rowtype;
  v_title text := btrim(p_title);
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_day date; v_today date; v_key text; v_text text; v_long boolean; v_short boolean;
  existing public.companion_activities%rowtype;
  v_id uuid; v_xp integer := 10; v_tier text; v_tz text;
begin
  if u is null then raise exception 'Sign-in required'; end if;
  if p_request is null then raise exception 'Invalid activity'; end if;
  select * into b from public.companion_bonds where status = 'active' and inviter_id = u for update;
  if not found or b.companion_id is null then raise exception 'Companion connection required'; end if;
  if v_title is null or char_length(v_title) not between 1 and 120 then raise exception 'Invalid title'; end if;
  if v_note is not null and char_length(v_note) > 500 then raise exception 'Invalid note'; end if;
  if p_tier = 'small' then v_xp := 5; elsif p_tier = 'big' then v_xp := 20; else v_xp := 10; end if;
  v_text := lower(v_title || ' ' || coalesce(v_note, ''));
  v_long := position('hour' in v_text) > 0 or v_text ~ '(^|[^0-9])1hr' or v_text ~ '(^|[^0-9])60 min' or v_text ~ '(^|[^0-9])90 min' or v_text ~ '(^|[^0-9])2 hr';
  v_short := position('quick' in v_text) > 0 or position('ten min' in v_text) > 0 or v_text ~ '(^|[^0-9])5 min' or v_text ~ '(^|[^0-9])10 min';
  if v_long and not v_short then
    if v_xp = 5 then v_xp := 10; elsif v_xp = 10 then v_xp := 20; end if;
  elsif v_short and not v_long then
    if v_xp = 20 then v_xp := 10; elsif v_xp = 10 then v_xp := 5; end if;
  end if;
  v_tier := case v_xp when 5 then 'small' when 20 then 'big' else 'medium' end;
  v_tz := public.quest_timezone(b.companion_id);
  v_today := public.quest_game_day(pg_catalog.now(), v_tz);
  v_day := coalesce(p_recorded_on, v_today);
  if v_day > v_today then raise exception 'Future date'; end if;
  if v_day < (v_today - 30) then raise exception 'Backdate too far'; end if;
  select * into existing from public.companion_activities where recorded_by = u and request_id = p_request;
  if found then
    if public.companion_title_key(existing.title) is distinct from public.companion_title_key(v_title) then
      raise exception 'Request ID reused with different payload';
    end if;
    return jsonb_build_object('activityId', existing.id, 'already', true, 'xpAwarded', 0, 'voided', existing.voided_at is not null);
  end if;
  v_key := b.companion_id::text || ':' || public.companion_title_key(v_title) || ':' || v_day::text;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('companion-activity:' || v_key, 0));
  select * into existing from public.companion_activities
    where subject_id = b.companion_id and dedupe_key = v_key and voided_at is null;
  if found then
    return jsonb_build_object('activityId', existing.id, 'already', true, 'xpAwarded', 0, 'voided', false);
  end if;
  insert into public.companion_activities(
    bond_id, subject_id, recorded_by, request_id, title, note, dedupe_key, xp_awarded)
    values (b.id, b.companion_id, u, p_request, v_title, v_note, v_key, v_xp)
    returning id into v_id;
  return jsonb_build_object(
    'activityId', v_id, 'already', false, 'xpAwarded', v_xp, 'tier', v_tier, 'day', v_day, 'voided', false);
end $$;
revoke all on function public.companion_log_activity_v2(uuid, text, text, text, date) from public, anon;
grant execute on function public.companion_log_activity_v2(uuid, text, text, text, date) to authenticated;

alter table public.companion_activities drop column if exists recorded_on;

notify pgrst, 'reload schema';
commit;
