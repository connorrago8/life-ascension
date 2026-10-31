-- Review-only migration: apply to isolated QA before any production consideration.
-- Browser clients may SELECT and INSERT only their own runs. Writes to existing
-- runs go through a compare-and-swap RPC, preventing stale-device overwrites.
create table if not exists public.adventure_run_saves (
  owner_id uuid not null references auth.users(id) on delete cascade,
  adventure_id text not null check (adventure_id in ('crypt', 'forest')),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  version integer not null default 1 check (version > 0),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  primary key (owner_id, adventure_id)
);
alter table public.adventure_run_saves enable row level security;
revoke all on public.adventure_run_saves from anon;
revoke all on public.adventure_run_saves from authenticated;
grant select on public.adventure_run_saves to authenticated;
create policy adventure_run_read_own on public.adventure_run_saves
  for select to authenticated using (owner_id = (select auth.uid()));
-- No direct insert/update/delete grants. All writes are revision-checked below.
create or replace function public.save_adventure_run(
  p_adventure_id text, p_state jsonb, p_version integer, p_expected_revision bigint
) returns bigint
language plpgsql security definer set search_path = '' as $
declare v_owner uuid := (select auth.uid()); v_revision bigint;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_adventure_id not in ('crypt','forest') or p_state is null
    or jsonb_typeof(p_state) <> 'object' or p_version <> 1
    or p_expected_revision is null or p_expected_revision < 0
    or pg_catalog.octet_length(p_state::text) > 262144 then
    raise exception 'Invalid adventure save' using errcode = '22023';
  end if;
  -- SECURITY DEFINER is needed to enforce atomic CAS without granting clients direct writes.
  -- auth.uid() is checked and owner_id is never supplied by the caller.
  if p_expected_revision = 0 then
    insert into public.adventure_run_saves(owner_id,adventure_id,state,version)
      values (v_owner,p_adventure_id,p_state,p_version)
      on conflict do nothing returning revision into v_revision;
  else
    update public.adventure_run_saves set state=p_state, version=p_version,
      revision=revision+1, updated_at=now()
      where owner_id=v_owner and adventure_id=p_adventure_id
        and revision=p_expected_revision
      returning revision into v_revision;
  end if;
  if v_revision is null then raise exception 'Stale save revision; reload before retrying' using errcode = '40001'; end if;
  return v_revision;
end $$;
revoke execute on function public.save_adventure_run(text,jsonb,integer,bigint) from public, anon;
grant execute on function public.save_adventure_run(text,jsonb,integer,bigint) to authenticated;
-- Review function owner, grants, RLS and stale-revision behavior in QA.
