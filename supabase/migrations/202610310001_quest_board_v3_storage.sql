-- Quest Board 3.0 additive storage, review and consent. NOT APPLIED automatically.
-- Existing XP ledger and quest_instances remain the only XP source of truth.
create table if not exists public.quest_board_v3_selections (
 owner_id uuid not null references auth.users(id) on delete cascade,
 day date not null,
 quest_ids uuid[] not null default '{}',
 created_at timestamptz not null default now(),
 primary key(owner_id,day)
);
create table if not exists public.quest_board_v3_reviews (
 owner_id uuid not null references auth.users(id) on delete cascade,
 quest_id uuid not null,
 week_start date not null,
 status text not null check(status in ('completed','pending','ignored')),
 updated_at timestamptz not null default now(),
 primary key(owner_id,quest_id,week_start),
 foreign key(quest_id,owner_id) references public.quests(id,owner_id) on delete cascade
);
create table if not exists public.quest_board_v3_pending_inputs (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 source text not null check(source in ('ai','calendar','health','manual')),
 external_ref text,
 question text not null check(char_length(question) between 1 and 500),
 created_at timestamptz not null default now(),
 resolved_at timestamptz,
 unique(owner_id,source,external_ref)
);
create table if not exists public.quest_board_v3_preferences (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 ai_enabled boolean not null default false,
 calendar_enabled boolean not null default false,
 health_enabled boolean not null default false,
 push_enabled boolean not null default false,
 player_profile jsonb not null default '{}'::jsonb,
 never_suggest text[] not null default '{}',
 updated_at timestamptz not null default now()
);
create table if not exists public.quest_board_v3_goals (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(char_length(title) between 1 and 120),
 milestones jsonb not null default '[]'::jsonb,
 linked_quest_ids uuid[] not null default '{}',
 reward_preview jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create table if not exists public.quest_board_v3_bonus_rerolls (
 owner_id uuid not null references auth.users(id) on delete cascade,
 day date not null,
 rerolls integer not null default 1 check(rerolls between 0 and 1),
 primary key(owner_id,day)
);
create table if not exists public.quest_board_v3_weekly_reveals (
 owner_id uuid not null references auth.users(id) on delete cascade,
 quest_id uuid not null,
 week_start date not null,
 reveal_at timestamptz not null,
 primary key(owner_id,quest_id,week_start),
 foreign key(quest_id,owner_id) references public.quests(id,owner_id) on delete cascade
);
do $$
declare tbl text;
begin
 foreach tbl in array array[
 'quest_board_v3_selections','quest_board_v3_reviews','quest_board_v3_pending_inputs',
 'quest_board_v3_preferences','quest_board_v3_goals','quest_board_v3_bonus_rerolls','quest_board_v3_weekly_reveals'
 ] loop
  execute format('alter table public.%I enable row level security',tbl);
  execute format('revoke all on public.%I from anon,authenticated',tbl);
  execute format('grant select,insert,update,delete on public.%I to authenticated',tbl);
  execute format('create policy %I on public.%I for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()))',tbl||'_owner',tbl);
 end loop;
end $$;
-- IMPORTANT: no external API tokens stored in these tables. OAuth credentials need secure server-side storage.
-- No quest completion or XP mutation occurs in this migration.
