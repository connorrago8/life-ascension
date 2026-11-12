-- More cosmetic tiers for Izzy's battle pass, plus two activity rewards.
-- Additive. Reverse with supabase/rollbacks/202611110002_companion_pass_down.sql.
-- No combat stats. Crypt XP is not touched.

alter table public.companion_cosmetic_catalog
  add column if not exists grant_kind text not null default 'level'
  check (grant_kind in ('level', 'activity'));

alter table public.companion_cosmetic_catalog drop constraint if exists companion_cosmetic_catalog_slot_check;
alter table public.companion_cosmetic_catalog add constraint companion_cosmetic_catalog_slot_check
  check (slot in ('accent', 'shirt', 'pin', 'head', 'gown', 'boots', 'wand', 'pet', 'aura', 'wings', 'frame', 'accessory'));

insert into public.companion_cosmetic_catalog(id, label, slot, unlock_level, sort_order, grant_kind) values
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
on conflict (id) do nothing;

create table if not exists public.companion_activity_rewards (
  title_key text primary key,
  need_count integer not null check (need_count > 0),
  cosmetic_id text not null references public.companion_cosmetic_catalog(id)
);
insert into public.companion_activity_rewards(title_key, need_count, cosmetic_id) values
  ('yoga', 5, 'yoga-mat'),
  ('dishes', 10, 'bubble-aura')
on conflict (title_key) do nothing;
alter table public.companion_activity_rewards enable row level security;
revoke all on public.companion_activity_rewards from public, anon, authenticated;

create or replace function public._companion_grant_unlocked(p_owner uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_level integer;
begin
  v_level := public.companion_level_for_xp(public._companion_lifetime_xp(p_owner));
  insert into public.companion_owned_cosmetics(owner_id, cosmetic_id)
  select p_owner, c.id
    from public.companion_cosmetic_catalog c
    where c.grant_kind = 'level' and c.unlock_level <= v_level
  on conflict do nothing;
  insert into public.companion_owned_cosmetics(owner_id, cosmetic_id)
  select p_owner, r.cosmetic_id
    from public.companion_activity_rewards r
    where (
      select count(*) from public.companion_activities a
      where a.subject_id = p_owner
        and a.voided_at is null
        and position(r.title_key in public.companion_title_key(a.title)) > 0
    ) >= r.need_count
  on conflict do nothing;
end $$;
revoke all on function public._companion_grant_unlocked(uuid) from public, anon, authenticated, service_role;

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

notify pgrst, 'reload schema';
