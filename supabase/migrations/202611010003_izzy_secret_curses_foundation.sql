-- IZ-4: optional, consent-bounded Secret Curses for Izzy-origin assignments only.
-- This is an isolated storage foundation; no triggers or production behavior yet.
create table if not exists public.izzy_secret_curses (
  id uuid primary key default gen_random_uuid(),
  -- Link to existing quest identity only after assignment provenance is checked
  quest_id uuid not null,
  assignment_source text not null default 'izzy'
    check (assignment_source = 'izzy'),
  consequence_text text not null
    check (char_length(trim(consequence_text)) between 1 and 1000),
  tier text not null default 'mischief'
    check (tier in ('mischief','royal_favor','queens_decree')),
  deadline_at timestamptz not null,
  state text not null default 'sealed'
    check (state in ('sealed','revealed','fulfilled','forgiven','declined','cancelled')),
  revealed_at timestamptz,
  seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint izzy_curse_reveal_state_consistent check (
    (state = 'sealed' and revealed_at is null)
    or (state = 'cancelled')
    or (state in ('revealed','fulfilled','forgiven','declined') and revealed_at is not null)
  )
);
create index if not exists izzy_secret_curses_quest_idx
  on public.izzy_secret_curses(quest_id);
create index if not exists izzy_secret_curses_pending_idx
  on public.izzy_secret_curses(deadline_at)
  where state = 'sealed';

alter table public.izzy_secret_curses enable row level security;
revoke all on public.izzy_secret_curses from anon, authenticated;
comment on table public.izzy_secret_curses is
  'IZ-4 sealed consequences. No client read grants; trusted backend must verify true Izzy assignment provenance, consent, and missed occurrence before revealing. Never return consequence_text for sealed curses.';
