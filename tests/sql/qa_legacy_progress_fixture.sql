-- Disposable PostgreSQL ONLY. Emulate the old QA one-step undo function,
-- so the forward-only candidate can be tested without touching hosted QA.
DO $fixture$
DECLARE
  current_def text := pg_get_functiondef('public.log_quest_progress(uuid,uuid,integer)'::regprocedure);
  legacy_clause text := $legacy$  if p_delta < 0 and p_delta <> -v_quest.progress_increment then
    raise exception 'Undo must reverse one default increment';
  end if;$legacy$;
  replacement_clause text := $replacement$  if p_delta < 0
     and p_delta <> -v_quest.progress_increment
     and p_delta <> -v_inst.current_amount then
    raise exception 'Undo must reverse one increment or clear current progress';
  end if;$replacement$;
BEGIN
  IF position(replacement_clause IN current_def)=0 OR
     position(legacy_clause IN current_def)>0 THEN
    RAISE EXCEPTION 'Disposable legacy fixture cannot find exact new clause';
  END IF;
  EXECUTE replace(current_def,replacement_clause,legacy_clause);
  IF position(legacy_clause IN
      pg_get_functiondef('public.log_quest_progress(uuid,uuid,integer)'::regprocedure))=0 THEN
    RAISE EXCEPTION 'Disposable legacy fixture failed';
  END IF;
  RAISE NOTICE 'PASS disposable legacy QA progress fixture';
END
$fixture$;
