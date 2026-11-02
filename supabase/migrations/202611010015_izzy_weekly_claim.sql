-- Allow the authenticated owner to claim only the known, manually verified Tally submission.
-- Claiming does not approve, create, or complete any quests.
create or replace function public.claim_izzy_weekly_submission()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare v_owner uuid := auth.uid(); v_count integer;
begin
  if v_owner is null then raise exception 'Sign-in required'; end if;
  if not exists (
    select 1 from public.izzy_submission_inbox
    where submission_id = '4aV4xDo' and source = 'tally'
  ) then raise exception 'Submission not staged'; end if;
  insert into public.izzy_submission_owners(submission_id,owner_id)
    values ('4aV4xDo',v_owner)
    on conflict (submission_id) do nothing;
  if not exists (
    select 1 from public.izzy_submission_owners
    where submission_id = '4aV4xDo' and owner_id = v_owner
  ) then raise exception 'Submission belongs to another account'; end if;
  select count(*) into v_count from public.izzy_submission_proposals
    where submission_id = '4aV4xDo' and state = 'review_required';
  return v_count;
end;
$$;
revoke all on function public.claim_izzy_weekly_submission() from public, anon;
grant execute on function public.claim_izzy_weekly_submission() to authenticated;
