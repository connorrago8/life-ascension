-- Izzy proposal review must bind each imported submission to an owner.
-- Never infer ownership merely from the presence of a companion record.
create table if not exists public.izzy_submission_owners (
  submission_id text primary key references public.izzy_submission_inbox(submission_id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  linked_at timestamptz not null default now()
);
create index if not exists izzy_submission_owners_owner_idx
  on public.izzy_submission_owners(owner_id);
alter table public.izzy_submission_owners enable row level security;
revoke all on public.izzy_submission_owners from public, anon, authenticated;

-- Only trusted server code may bind a submission to an owner after verifying
-- its source and destination. No user-facing client can create this binding.
create or replace function public.list_owned_izzy_proposals(p_owner_id uuid)
returns table (
  proposal_id bigint,
  submission_id text,
  category text,
  original_text text,
  visibility text
)
language sql stable security definer set search_path = ''
as $$
 select p.id, p.submission_id, p.category, p.original_text, p.visibility
 from public.izzy_submission_proposals p
 join public.izzy_submission_owners o on o.submission_id = p.submission_id
 where o.owner_id = p_owner_id and p.state = 'review_required'
 order by p.created_at, p.id limit 100;
$$;
revoke all on function public.list_owned_izzy_proposals(uuid) from public, anon, authenticated;
grant execute on function public.list_owned_izzy_proposals(uuid) to service_role;
