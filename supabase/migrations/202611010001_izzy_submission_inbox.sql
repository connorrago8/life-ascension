-- IZ-3 private ingestion staging. No public/anon/authenticated policies.
-- Service-role backend only; never expose rows to client APIs.
create table if not exists public.izzy_submission_inbox (
  submission_id text primary key check (length(submission_id) between 1 and 128),
  source text not null default 'tally' check (source = 'tally'),
  raw_payload jsonb not null,
  state text not null default 'received'
    check (state in ('received', 'parsed', 'review_required', 'approved', 'rejected', 'applied', 'error')),
  error_message text,
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.izzy_submission_inbox enable row level security;
revoke all on public.izzy_submission_inbox from anon, authenticated;
comment on table public.izzy_submission_inbox is
  'Private server-only Izzy intake. Raw text may include surprise rewards; no client access.';

create table if not exists public.izzy_submission_proposals (
  id bigint generated always as identity primary key,
  submission_id text not null references public.izzy_submission_inbox(submission_id) on delete cascade,
  proposal_index integer not null check (proposal_index >= 0),
  category text not null check (category in ('daily','weekly','monthly','project','long_term','relationship','bonus','reward')),
  original_text text not null,
  visibility text not null default 'unspecified' check (visibility in ('secret','visible','unspecified')),
  state text not null default 'review_required'
    check (state in ('review_required','approved','rejected','applied')),
  created_at timestamptz not null default now(),
  unique (submission_id, proposal_index)
);
alter table public.izzy_submission_proposals enable row level security;
revoke all on public.izzy_submission_proposals from anon, authenticated;
comment on table public.izzy_submission_proposals is
  'Review-only proposals. No quest or XP changes on insert.';
