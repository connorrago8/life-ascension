-- Persist Connor adventurer cosmetic Wear. TEST only.
-- Reverse with supabase/rollbacks/202611110004_adventurer_wear_down.sql.

create table if not exists public.adventurer_worn (
  user_id uuid not null references auth.users(id) on delete cascade,
  cosmetic_id text not null references public.adventurer_cosmetic_catalog(id) on delete cascade,
  slot text not null,
  worn_at timestamptz not null default now(),
  primary key (user_id, slot)
);

alter table public.adventurer_worn enable row level security;
drop policy if exists adventurer_worn_own on public.adventurer_worn;
drop policy if exists adventurer_worn_select on public.adventurer_worn;
-- Read own rows only. No insert/update/delete policy: clients cannot bypass the level lock.
create policy adventurer_worn_select on public.adventurer_worn
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.adventurer_worn from public, anon, authenticated;
grant select on public.adventurer_worn to authenticated;

-- Same curve as lib/level.ts and companion_level_for_xp.
-- XP to reach level n (n > 1) is 5 * (n * (n + 1) - 2) / 2. Level 1 is 0. Level 10 is 270.
create or replace function public.level_for_xp(p_xp bigint)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_level integer := 1;
  v_xp bigint := greatest(coalesce(p_xp, 0), 0);
  v_need bigint;
begin
  while v_level < 500 loop
    v_need := 5 * ((((v_level + 1)::bigint * (v_level + 2)) - 2) / 2);
    exit when v_need > v_xp;
    v_level := v_level + 1;
  end loop;
  return v_level;
end $$;
revoke all on function public.level_for_xp(bigint) from public, anon, authenticated;

create or replace function public.adventurer_set_worn(p_id text, p_wear boolean)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  u uuid := auth.uid();
  cat public.adventurer_cosmetic_catalog%rowtype;
  lvl integer;
begin
  if u is null then raise exception 'Sign-in required'; end if;
  select * into cat from public.adventurer_cosmetic_catalog where id = p_id;
  if not found then raise exception 'Unknown cosmetic'; end if;
  -- Level from lifetime XP (personal contract). Ashen Hood / Crypt untouched.
  -- Writes go through this definer function only. Direct table grants are select-only.
  select public.level_for_xp(coalesce(public.get_lifetime_xp(), 0)) into lvl;
  if p_wear and cat.unlock_level > lvl then raise exception 'Locked'; end if;
  if p_wear then
    insert into public.adventurer_worn(user_id, cosmetic_id, slot)
      values (u, p_id, cat.slot)
      on conflict (user_id, slot) do update set cosmetic_id = excluded.cosmetic_id, worn_at = now();
  else
    delete from public.adventurer_worn where user_id = u and cosmetic_id = p_id;
  end if;
  return jsonb_build_object('ok', true, 'id', p_id, 'wear', p_wear);
end $$;
revoke all on function public.adventurer_set_worn(text, boolean) from public, anon;
grant execute on function public.adventurer_set_worn(text, boolean) to authenticated;

create or replace function public.adventurer_get_worn()
returns jsonb language sql stable security invoker set search_path = ''
as $$
  select coalesce(jsonb_agg(cosmetic_id), '[]'::jsonb)
  from public.adventurer_worn
  where user_id = (select auth.uid());
$$;
revoke all on function public.adventurer_get_worn() from public, anon;
grant execute on function public.adventurer_get_worn() to authenticated;
