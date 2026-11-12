-- Reverse 202611110002. Restores the five-slot wardrobe grant. Does not delete level cosmetics from 202611110001.
begin;

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
    where c.unlock_level <= v_level
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
        'owned', o.owner_id is not null,
        'worn', w.owner_id is not null,
        'fresh', o.owner_id is not null and o.celebrated_at is null
      ) order by c.sort_order)
      from public.companion_cosmetic_catalog c
      left join public.companion_owned_cosmetics o
        on o.cosmetic_id = c.id and o.owner_id = p_owner
      left join public.companion_worn_cosmetics w
        on w.cosmetic_id = c.id and w.owner_id = p_owner
    ), '[]'::jsonb)
  )
$$;
revoke all on function public._companion_wardrobe_payload(uuid) from public, anon, authenticated, service_role;

delete from public.companion_worn_cosmetics w
  using public.companion_cosmetic_catalog c
  where w.cosmetic_id = c.id and c.id in (
    'bow','sparkle-boots','flower-crown','heart-wand','bunny','star-aura','tiara','fairy-wings','pastel-frame','yoga-mat','bubble-aura'
  );
delete from public.companion_owned_cosmetics o
  where o.cosmetic_id in (
    'bow','sparkle-boots','flower-crown','heart-wand','bunny','star-aura','tiara','fairy-wings','pastel-frame','yoga-mat','bubble-aura'
  );
drop table if exists public.companion_activity_rewards;
delete from public.companion_cosmetic_catalog where id in (
  'bow','sparkle-boots','flower-crown','heart-wand','bunny','star-aura','tiara','fairy-wings','pastel-frame','yoga-mat','bubble-aura'
);
alter table public.companion_cosmetic_catalog drop constraint if exists companion_cosmetic_catalog_grant_kind_check;
alter table public.companion_cosmetic_catalog drop column if exists grant_kind;
alter table public.companion_cosmetic_catalog drop constraint if exists companion_cosmetic_catalog_slot_check;
alter table public.companion_cosmetic_catalog add constraint companion_cosmetic_catalog_slot_check
  check (slot in ('accent', 'shirt', 'pin', 'head', 'gown'));

notify pgrst, 'reload schema';
commit;
