-- Founder content pack v1. Names and descriptions only; cosmetic ids stay.
-- Owned and worn rows are kept. Connor's worn slot follows the catalog when it moves.
-- Activity tiers: under 15 minutes = 5, 15–44 = 10, 45 or more = 20. Never above 20.
-- Reverse with supabase/rollbacks/20261112014926_content_pack_v1_down.sql.

alter table public.companion_cosmetic_catalog add column if not exists description text;
alter table public.adventurer_cosmetic_catalog add column if not exists description text;
alter table public.companion_activities add column if not exists recorded_on date;

update public.companion_cosmetic_catalog as c
set label = v.label, description = v.description
from (values
  ('fingerless-gloves', 'Nightgrip Gloves', $d$Fingerless black gloves worn by the city's wanderers.$d$),
  ('nose-ring', 'Silver Thorn', $d$A delicate silver nose ring with a rebellious edge.$d$),
  ('cargo-pants', 'Shadow Cargo', $d$Dark utility pants with reinforced pockets.$d$),
  ('crop-top', 'Midnight Crop', $d$A fitted black top made for movement.$d$),
  ('leather-jacket', 'Rogue''s Leather', $d$A cropped jacket, weathered by countless nights.$d$),
  ('wrist-tattoo', 'First Mark', $d$A small wrist tattoo marking the beginning of her journey.$d$),
  ('combat-boots', 'Ironstep Boots', $d$Buckled combat boots with scarred leather.$d$),
  ('silver-circlet', 'Moonsteel Circlet', $d$A slender silver crown for an emerging legend.$d$),
  ('neon-hair-streak', 'Neon Rebellion', $d$A vivid streak of color woven through her hair.$d$),
  ('arm-sleeve-tattoo', 'Azure Serpent', $d$A luminous cyan tattoo wrapping around her arm.$d$),
  ('utility-belt', 'Wanderer''s Rig', $d$A utility belt fitted with mysterious equipment.$d$),
  ('cyber-visor', 'Spectral Sight', $d$A cybernetic visor with a cold blue glow.$d$),
  ('trench-coat', 'Nightfall Trench', $d$A long dark coat that moves like a shadow.$d$),
  ('neck-tattoo', 'Magenta Oath', $d$A glowing rune tattoo along her neck.$d$),
  ('nightcat-headset', 'Nightcat Headset', $d$Black cat-ear audio gear with subtle illuminated edges.$d$),
  ('rune-lantern', 'Runebearer''s Lantern', $d$An ancient lantern containing a synthetic flame.$d$),
  ('armored-corset', 'Arcsteel Corset', $d$Reinforced leather armor with elegant metal detailing.$d$),
  ('hand-tattoos', 'Spellbound Hands', $d$Glowing sigils etched across both hands.$d$),
  ('hooded-cloak', 'Eclipse Mantle', $d$A hooded cloak threaded with faint neon light.$d$),
  ('rune-drone', 'Wisp Drone', $d$A floating rune-powered mechanical companion.$d$),
  ('shoulder-pauldron', 'Obsidian Guard', $d$A dark shoulder pauldron with engraved gold details.$d$),
  ('back-tattoo', 'Sovereign''s Ink', $d$An elaborate full-back tattoo of arcane circuitry.$d$),
  ('silver-neon-hair', 'Ghostsilver Hair', $d$Silver hair with luminous neon tips.$d$),
  ('neon-aura', 'Astral Veil', $d$A restrained magenta-cyan aura surrounding her silhouette.$d$),
  ('obsidian-gown', 'Obsidian Empress', $d$A black techwear gown adorned with aged-gold filigree.$d$)
) as v(id, label, description)
where c.id = v.id;

update public.adventurer_cosmetic_catalog as c
set label = v.label, description = v.description, slot = v.slot
from (values
  ('shadow-hood', 'Wanderer''s Wraps', $d$Worn hand wraps from the first steps of the journey.$d$, 'hands'),
  ('leather-bracers', 'Iron Signet', $d$A simple dark-metal ring carrying an unknown crest.$d$, 'face'),
  ('dark-tunic', 'Ranger''s Trousers', $d$Durable charcoal pants built for the road.$d$, 'bottom'),
  ('road-boots', 'Ashen Tunic', $d$A fitted dark shirt with subtle stitching.$d$, 'top'),
  ('pathfinder-cloak', 'Blackthorn Jacket', $d$A weathered leather jacket with reinforced shoulders.$d$, 'jacket'),
  ('rune-belt', 'First Oath', $d$A small forearm tattoo representing commitment.$d$, 'tattoo'),
  ('iron-pauldrons', 'Ironbound Boots', $d$Heavy boots made for long expeditions.$d$, 'boots'),
  ('scarred-gloves', 'Wayfinder''s Circlet', $d$An aged-metal band engraved with forgotten symbols.$d$, 'head'),
  ('traveler-pants', 'Emberstreak', $d$A faint silver-blue streak through his hair.$d$, 'hair'),
  ('ember-circlet', 'Riftbrand', $d$A cyan rune tattoo running along one arm.$d$, 'tattoo'),
  ('void-gauntlets', 'Pathfinder''s Rig', $d$A utility belt carrying tools and relics.$d$, 'hip'),
  ('storm-cape', 'Voidglass Lens', $d$A cybernetic monocular lens with luminous detailing.$d$, 'face'),
  ('obsidian-vest', 'Duskwalker Coat', $d$A long black coat with an armored collar.$d$, 'jacket'),
  ('neon-edge-bracers', 'Oathbound Sigil', $d$A magenta rune tattoo at the neck.$d$, 'tattoo'),
  ('warden-boots', 'Shadowcomms', $d$A discreet tactical headset with dark metallic plating.$d$, 'head'),
  ('arcane-shoulders', 'Lantern of Resolve', $d$A floating lantern holding a blue arcane flame.$d$, 'back'),
  ('silver-mask', 'Riftbound Harness', $d$Layered black leather armor with steel fastenings.$d$, 'top'),
  ('longcoat', 'Runeforged Hands', $d$Glowing geometric markings across both hands.$d$, 'tattoo'),
  ('rune-lantern-pack', 'Nightfall Cloak', $d$A hooded cloak with cyan-lined edges.$d$, 'jacket'),
  ('void-aura', 'Sentinel Wisp', $d$A floating arcane mechanical scout.$d$, 'companion'),
  ('gold-filigree-armor', 'Obsidian Vanguard', $d$An engraved shoulder guard of blackened steel.$d$, 'back'),
  ('neon-trim-cloak', 'Ascendant''s Mark', $d$A full-back design of interlocking arcane runes.$d$, 'tattoo'),
  ('cyber-visor', 'Stormsilver Hair', $d$Silver hair with cool blue luminous tips.$d$, 'hair'),
  ('obsidian-pauldrons', 'Riftwalker Aura', $d$A subtle field of blue and violet energy.$d$, 'aura'),
  ('legendary-coat', 'Obsidian Ascendant', $d$Legendary black armor with aged-gold filigree.$d$, 'top')
) as v(id, label, description, slot)
where c.id = v.id;

delete from public.adventurer_worn w
using (
  select user_id, cosmetic_id from (
    select w.user_id, w.cosmetic_id,
      row_number() over (partition by w.user_id, c.slot order by c.unlock_level desc, c.sort_order desc) as rn
    from public.adventurer_worn w
    join public.adventurer_cosmetic_catalog c on c.id = w.cosmetic_id
  ) ranked
  where rn > 1
) extra
where w.user_id = extra.user_id and w.cosmetic_id = extra.cosmetic_id;

update public.adventurer_worn set slot = 'tmp:' || cosmetic_id;
update public.adventurer_worn w
set slot = c.slot
from public.adventurer_cosmetic_catalog c
where c.id = w.cosmetic_id;

create or replace function public._companion_wardrobe_payload(p_owner uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'level', public.companion_level_for_xp(public._companion_lifetime_xp(p_owner)),
    'xp', public._companion_lifetime_xp(p_owner),
    'xpForNext', 5 * (public.companion_level_for_xp(public._companion_lifetime_xp(p_owner)) + 1),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'label', c.label,
        'description', c.description,
        'slot', c.slot,
        'unlockLevel', c.unlock_level,
        'grantKind', c.grant_kind,
        'activityKey', r.title_key,
        'activityNeed', r.need_count,
        'owned', o.owner_id is not null,
        'worn', w.owner_id is not null,
        'fresh', o.owner_id is not null and o.celebrated_at is null
      ) order by c.unlock_level, c.sort_order)
      from public.companion_cosmetic_catalog c
      left join public.companion_owned_cosmetics o
        on o.cosmetic_id = c.id and o.owner_id = p_owner
      left join public.companion_worn_cosmetics w
        on w.cosmetic_id = c.id and w.owner_id = p_owner
      left join public.companion_activity_rewards r on r.cosmetic_id = c.id
    ), '[]'::jsonb)
  )
$$;
revoke all on function public._companion_wardrobe_payload(uuid) from public, anon, authenticated, service_role;

create or replace function public.companion_log_activity_v2(
  p_request uuid,
  p_title text,
  p_note text,
  p_tier text default null,
  p_recorded_on date default null
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  u uuid := auth.uid();
  b public.companion_bonds%rowtype;
  v_title text := btrim(p_title);
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_day date;
  v_today date;
  v_key text;
  v_text text;
  v_minutes integer;
  existing public.companion_activities%rowtype;
  v_id uuid;
  v_xp integer := 10;
  v_tier text;
  v_tz text;
begin
  if u is null then raise exception 'Sign-in required'; end if;
  if p_request is null then raise exception 'Invalid activity'; end if;
  select * into b from public.companion_bonds where status = 'active' and inviter_id = u for update;
  if not found or b.companion_id is null then raise exception 'Companion connection required'; end if;
  if v_title is null or char_length(v_title) not between 1 and 120 then raise exception 'Invalid title'; end if;
  if v_note is not null and char_length(v_note) > 500 then raise exception 'Invalid note'; end if;
  if p_tier is not null and p_tier not in ('small', 'medium', 'big') then
    raise exception 'Invalid tier';
  end if;

  -- Explicit minutes set the band. Otherwise a validated override, else keywords.
  -- Under 15 minutes is 5, 15–44 is 10, 45 or more is 20. Never above 20.
  v_text := lower(v_title || ' ' || coalesce(v_note, ''));
  v_minutes := nullif((regexp_match(v_text, '(^|[^0-9])([0-9]+)[[:space:]]*min'))[2], '')::integer;
  if v_minutes is null and v_text ~ '(^|[^0-9])2 hr' then v_minutes := 120;
  elsif v_minutes is null and (position('hour' in v_text) > 0 or v_text ~ '(^|[^0-9])1hr') then v_minutes := 60;
  end if;
  if v_minutes is not null then
    if v_minutes < 15 then v_xp := 5;
    elsif v_minutes < 45 then v_xp := 10;
    else v_xp := 20;
    end if;
  elsif p_tier = 'small' then v_xp := 5;
  elsif p_tier = 'big' then v_xp := 20;
  elsif p_tier = 'medium' then v_xp := 10;
  elsif position('deep clean' in v_text) > 0 or position('full workout' in v_text) > 0 then v_xp := 20;
  elsif position('quick' in v_text) > 0 then v_xp := 5;
  else v_xp := 10;
  end if;
  if v_xp > 20 then v_xp := 20; end if;
  if v_xp < 5 then v_xp := 5; end if;
  v_tier := case v_xp when 5 then 'small' when 20 then 'big' else 'medium' end;

  v_tz := public.quest_timezone(b.companion_id);
  v_today := public.quest_game_day(pg_catalog.now(), v_tz);
  v_day := coalesce(p_recorded_on, v_today);
  if v_day > v_today then raise exception 'Future date'; end if;
  if v_day < (v_today - 30) then raise exception 'Backdate too far'; end if;

  select * into existing from public.companion_activities where recorded_by = u and request_id = p_request;
  if found then
    if public.companion_title_key(existing.title) is distinct from public.companion_title_key(v_title)
      or existing.note is distinct from v_note then
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
    bond_id, subject_id, recorded_by, request_id, title, note, dedupe_key, xp_awarded, recorded_on)
    values (b.id, b.companion_id, u, p_request, v_title, v_note, v_key, v_xp, v_day)
    returning id into v_id;

  return jsonb_build_object(
    'activityId', v_id, 'already', false, 'xpAwarded', v_xp, 'tier', v_tier, 'day', v_day, 'voided', false);
end $$;
revoke all on function public.companion_log_activity_v2(uuid, text, text, text, date) from public, anon;
grant execute on function public.companion_log_activity_v2(uuid, text, text, text, date) to authenticated;

notify pgrst, 'reload schema';
