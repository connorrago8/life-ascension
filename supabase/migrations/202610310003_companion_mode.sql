-- Companion Mode: manual, consent-based tracking for a non-account participant.
-- No auth user is created for the companion. Only the owner can access rows.
create table if not exists public.quest_companions (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 display_name text not null check(char_length(btrim(display_name)) between 1 and 40),
 consent_confirmed_at timestamptz,
 created_at timestamptz not null default now(),
 unique(id,owner_id)
);
create table if not exists public.quest_companion_habits (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null,
 companion_id uuid not null,
 title text not null check(char_length(btrim(title)) between 1 and 120),
 cadence text not null check(cadence in ('daily','weekly','once')),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 unique(id,owner_id),
 foreign key(companion_id,owner_id) references public.quest_companions(id,owner_id) on delete cascade
);
create table if not exists public.quest_companion_completions (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null,
 companion_id uuid not null,
 habit_id uuid not null,
 period_start date not null,
 completed_at timestamptz not null default now(),
 recorded_at timestamptz not null default now(),
 evidence_type text not null default 'owner_report' check(evidence_type='owner_report'),
 unique(habit_id,period_start),
 foreign key(companion_id,owner_id) references public.quest_companions(id,owner_id) on delete cascade,
 foreign key(habit_id,owner_id) references public.quest_companion_habits(id,owner_id) on delete cascade
);
create index if not exists quest_companion_completions_owner_idx on public.quest_companion_completions(owner_id,recorded_at);
do $$
declare t text;
begin
 foreach t in array array['quest_companions','quest_companion_habits','quest_companion_completions'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  execute format('create policy %I on public.%I for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()))',t||'_owner',t);
 end loop;
end $$;
-- Companion XP is COUNT(completions), completely separate from public.xp_ledger.
-- No automatic inference, notifications to companion, health data or cross-account access.
