-- Disposable PostgreSQL only. Run AFTER earned_armor_smoke.sql in life_ascension_armor_test.
-- Real role-denial behavior, not merely catalog grants. No hosted database execution.
\set ON_ERROR_STOP on

-- The preceding smoke fixture must contain two owners with earned armor,
-- and no equipped armor after its unequip check.
DO $$
BEGIN
  IF (SELECT count(*) FROM public.owned_equipment
      WHERE owner_id IN ('00000000-0000-0000-0000-00000000ea01',
                         '00000000-0000-0000-0000-00000000ea02')) <> 2
     OR EXISTS (SELECT 1 FROM public.equipped_equipment) THEN
    RAISE EXCEPTION 'Armor role-denial fixture not ready';
  END IF;
END $$;

SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000ea02', false);
DO $$
DECLARE denied boolean;
BEGIN
  denied := false;
  BEGIN
    PERFORM public.get_earned_gear();
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Anonymous gear read was allowed'; END IF;

  denied := false;
  BEGIN
    PERFORM public.equip_earned_armor('ashen-hood', true);
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Anonymous equip was allowed'; END IF;
END $$;
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000ea02', false);
DO $$
DECLARE denied boolean;
BEGIN
  denied := false;
  BEGIN
    UPDATE public.owned_equipment SET source = 'quest_xp_10'
      WHERE owner_id = auth.uid();
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Authenticated direct ownership UPDATE was allowed'; END IF;

  denied := false;
  BEGIN
    DELETE FROM public.equipped_equipment WHERE owner_id = auth.uid();
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Authenticated direct equipped DELETE was allowed'; END IF;

  denied := false;
  BEGIN
    DELETE FROM public.owned_equipment WHERE owner_id = auth.uid();
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Authenticated direct ownership DELETE was allowed'; END IF;

  denied := false;
  BEGIN
    UPDATE public.equipped_equipment SET item_id = 'ashen-hood'
      WHERE owner_id = auth.uid();
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Authenticated direct equipped UPDATE was allowed'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.equipped_equipment(owner_id, slot, item_id)
      VALUES (auth.uid(), 'head', 'ashen-hood') ON CONFLICT DO NOTHING;
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Authenticated direct equipped INSERT was allowed'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.owned_equipment(owner_id, item_id)
      VALUES (auth.uid(), 'ashen-hood') ON CONFLICT DO NOTHING;
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Authenticated direct ownership INSERT was allowed'; END IF;
END $$;
RESET ROLE;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.owned_equipment
      WHERE owner_id IN ('00000000-0000-0000-0000-00000000ea01',
                         '00000000-0000-0000-0000-00000000ea02')) <> 2
     OR EXISTS (SELECT 1 FROM public.equipped_equipment) THEN
    RAISE EXCEPTION 'Denied role operations altered equipment fixture';
  END IF;
  RAISE NOTICE 'PASS: anonymous RPC and authenticated direct DML denied; fixture unchanged';
END $$;
