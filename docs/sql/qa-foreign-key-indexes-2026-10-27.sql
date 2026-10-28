-- Applied to QA project njqwwimzrsunheehnnnt on 2026-10-27.
-- Do not blindly replay on production. Review index costs and migration ordering.
CREATE INDEX IF NOT EXISTS quest_events_instance_owner_fk_idx ON public.quest_events(instance_id, owner_id);
CREATE INDEX IF NOT EXISTS quest_instances_quest_owner_fk_idx ON public.quest_instances(quest_id, owner_id);
CREATE INDEX IF NOT EXISTS quest_progress_instance_fk_idx ON public.quest_progress(instance_id);
CREATE INDEX IF NOT EXISTS quest_progress_quest_user_fk_idx ON public.quest_progress(quest_id, user_id);
CREATE INDEX IF NOT EXISTS quest_progress_operations_instance_owner_fk_idx ON public.quest_progress_operations(instance_id, owner_id);
CREATE INDEX IF NOT EXISTS xp_ledger_instance_owner_fk_idx ON public.xp_ledger(instance_id, owner_id);
