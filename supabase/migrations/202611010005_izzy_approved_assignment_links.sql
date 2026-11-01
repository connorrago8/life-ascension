-- IZ-6: Establish immutable approved companion assignment provenance.
-- No trigger, quest creation, completion award, or curse reveal is installed here.
-- An approved assignment must be created only by trusted review after verifying
-- the existing quest and quest_instances ownership in the application schema.
create table if not exists public.izzy_approved_assignments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  quest_id uuid not null,
  quest_instance_id uuid not null unique,
  proposal_id bigint not null unique references public.izzy_submission_proposals(id),
  origin text not null default 'izzy' check (origin = 'izzy'),
  approved_at timestamptz not null default now(),
  consent_at timestamptz,
  consent_revoked_at timestamptz,
  deadline_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint izzy_assignment_consent_order check (
    consent_revoked_at is null or consent_at is not null
  ),
  constraint izzy_assignment_consent_time check (
    consent_at is null or consent_at <= approved_at
  ),
  unique (id, owner_id, quest_id, quest_instance_id)
);

create index if not exists izzy_approved_assignments_owner_idx
  on public.izzy_approved_assignments(owner_id);

alter table public.izzy_approved_assignments enable row level security;
revoke all on public.izzy_approved_assignments from anon, authenticated;

-- Tie curses to a specific approved assignment and occurrence, not a spoofable
-- string. Nullable for backwards compatibility with isolated foundation data;
-- new operational flows MUST require assignment_id non-null.
alter table public.izzy_secret_curses
  add column if not exists assignment_id uuid
    references public.izzy_approved_assignments(id);

create unique index if not exists izzy_secret_curses_assignment_unique
  on public.izzy_secret_curses(assignment_id)
  where assignment_id is not null;

comment on table public.izzy_approved_assignments is
  'Service-only approved companion assignments. Trusted backend must validate quest_instance_id ownership and approval before insert; this schema alone does not establish a live quest link.';
comment on column public.izzy_secret_curses.assignment_id is
  'Verified assignment reference required for future operational reveals. Legacy null references must never reveal.';
