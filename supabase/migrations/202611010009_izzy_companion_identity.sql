-- IZ-10: Bind approved Izzy proposals to the existing companion assignment
-- system. Existing quest_companion_assignments already enforces both
-- companion and quest ownership; do not introduce a parallel identity model.
--
-- This is additive and fail-closed: records lacking a verified companion
-- assignment cannot receive new Izzy XP or reveal a curse.
alter table public.izzy_approved_assignments
  add column if not exists companion_assignment_id uuid;

create unique index if not exists izzy_approved_companion_assignment_unique
  on public.izzy_approved_assignments(companion_assignment_id)
  where companion_assignment_id is not null;

create unique index if not exists quest_companion_assignments_izzy_identity
  on public.quest_companion_assignments(id, owner_id, quest_id);

alter table public.izzy_approved_assignments
  add constraint izzy_approved_companion_assignment_fk
  foreign key (companion_assignment_id, owner_id, quest_id)
  references public.quest_companion_assignments(id, owner_id, quest_id)
  on delete restrict;

-- New operational assignments must have this link; legacy isolated drafts
-- may remain nullable until explicitly reviewed and connected.
comment on column public.izzy_approved_assignments.companion_assignment_id is
  'Must link to an active, owner-consented existing companion assignment before XP or curse activation.';
