-- Drops optional template state only. Quests and xp_ledger rows stay.

drop function if exists public.skip_track_template(text, text, uuid);
drop function if exists public.complete_track_template(text, text, uuid);
drop function if exists public.start_track_template(text, text, uuid);
drop function if exists public._track_template_title(text);
drop function if exists public.health_followups_unlocked(uuid, date);
drop table if exists public.track_template_states;

notify pgrst, 'reload schema';
