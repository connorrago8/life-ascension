-- Rolled-back TEST smoke. Synthetic users only. A failure aborts the transaction.
-- Success raises finance_transactions_smoke_ok so the caller can roll back with it.
do $$
declare
  a uuid := '00000000-0000-4000-8000-00000000a701';
  b uuid := '00000000-0000-4000-8000-00000000a702';
  v_today date;
  v_token text;
  v_hash text;
  v_income jsonb;
  v_pending jsonb;
  v_posted jsonb;
  v_csv jsonb;
  v_first jsonb;
  v_second jsonb;
  v_replay jsonb;
  v_overlap jsonb;
  v_csv_first jsonb;
  v_csv_second jsonb;
  v_summary jsonb;
  v_summary_again jsonb;
  v_companion jsonb;
  v_rows integer;
  v_xp integer;
  v_verify integer;
  v_other integer;
  v_masked integer;
  v_full integer;
begin
  insert into auth.users (id) values (a), (b);
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  v_today := public.quest_today();

  v_token := public.finance_ingest_token_create()->>'token';
  v_hash := encode(extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex');
  perform set_config('request.jwt.claim.sub', '', true);

  v_income := jsonb_build_array(jsonb_build_object(
    'id', 'txn_income', 'date', v_today, 'merchant', 'Employer', 'category', 'Paycheck',
    'account_label', 'Checking', 'amount', 100, 'pending', false
  ));
  v_first := public.import_monarch_transactions(v_hash, '00000000-0000-4000-8000-00000000d701', v_income);
  if (v_first->>'inserted')::int <> 1 or (v_first->'verification'->'no_spend_day'->>'xp_awarded')::int <= 0 then
    raise exception 'no-spend day did not pay once';
  end if;
  if v_first->'verification'->'payment_posted'->>'status' <> 'needs_review' then
    raise exception 'payment miss was not private review';
  end if;

  v_pending := jsonb_build_array(jsonb_build_object(
    'id', 'txn_pay', 'date', v_today, 'merchant', 'Card Pay', 'category', 'Credit Card Payment',
    'account_label', 'Visa 1234567812345678', 'amount', -40, 'pending', true
  ));
  v_second := public.import_monarch_transactions(v_hash, '00000000-0000-4000-8000-00000000d702', v_pending);
  if (v_second->>'inserted')::int <> 1 or (select pending from public.finance_transactions where external_id = 'txn_pay') is not true then
    raise exception 'pending row was not stored';
  end if;
  if (v_second->'verification'->'payment_posted'->>'xp_awarded')::int <> 0 then
    raise exception 'pending payment paid XP';
  end if;

  v_posted := jsonb_build_array(jsonb_build_object(
    'id', 'txn_pay', 'date', v_today, 'merchant', 'Card Pay', 'category', 'Credit Card Payment',
    'account_label', 'Visa 1234567812345678', 'amount', -41.25, 'pending', false
  ));
  v_overlap := public.import_monarch_transactions(v_hash, '00000000-0000-4000-8000-00000000d703', v_posted);
  if (v_overlap->>'updated')::int <> 1 or (v_overlap->>'inserted')::int <> 0 then
    raise exception 'posted pull duplicated the pending row';
  end if;
  select count(*) into v_rows from public.finance_transactions where external_id = 'txn_pay';
  if v_rows <> 1 or (select pending from public.finance_transactions where external_id = 'txn_pay') then
    raise exception 'pending did not become one posted row';
  end if;
  if (v_overlap->'verification'->'payment_posted'->>'xp_awarded')::int <= 0 then
    raise exception 'posted payment did not pay';
  end if;

  v_replay := public.import_monarch_transactions(v_hash, '00000000-0000-4000-8000-00000000d703', v_posted);
  if (v_replay->>'replayed')::boolean is not true then
    raise exception 'same request did not replay';
  end if;
  select verify_count into v_verify from public.finance_import_log
    where owner_id = a and request_id = '00000000-0000-4000-8000-00000000d703';
  if v_verify <> 1 then
    raise exception 'verification ran more than once';
  end if;

  perform public.import_monarch_transactions(v_hash, '00000000-0000-4000-8000-00000000d704', v_posted);
  select count(*) into v_rows from public.finance_transactions where owner_id = a and external_id = 'txn_pay';
  select count(*) into v_xp from public.xp_ledger l
    join public.quest_instances i on i.id = l.instance_id
    join public.quests q on q.id = i.quest_id
    where q.owner_id = a and q.title = 'Confirm a Payment Posted';
  if v_rows <> 1 or v_xp <> 1 then
    raise exception 'overlap duplicated a row or paid XP again';
  end if;
  select count(*) into v_xp from public.xp_ledger l
    join public.quest_instances i on i.id = l.instance_id
    join public.quests q on q.id = i.quest_id
    where q.owner_id = a and q.title = 'No-Spend Day';
  if v_xp <> 1 then
    raise exception 'no-spend day paid more than once';
  end if;

  select count(*) into v_full from public.finance_transactions
    where account_label like '%1234567812345678%';
  select count(*) into v_masked from public.finance_transactions
    where account_label like '%5678%';
  if v_full <> 0 or v_masked <> 1 then
    raise exception 'account number was not masked';
  end if;

  perform set_config('request.jwt.claim.sub', a::text, true);
  v_csv := jsonb_build_array(jsonb_build_object(
    'date', v_today, 'merchant', 'Market', 'category', 'Groceries',
    'account_label', 'Checking', 'amount', -8
  ));
  v_csv_first := public.import_finance_csv('00000000-0000-4000-8000-00000000d705', v_csv);
  v_csv_second := public.import_finance_csv('00000000-0000-4000-8000-00000000d706', v_csv);
  select count(*) into v_rows from public.finance_transactions where owner_id = a and source = 'csv';
  if (v_csv_first->>'inserted')::int <> 1 or (v_csv_second->>'unchanged')::int <> 1 or v_rows <> 1 then
    raise exception 'csv overlap duplicated a row';
  end if;

  v_summary := public.finance_week_summary();
  v_summary_again := public.finance_week_summary();
  if (v_summary->>'owner')::boolean is not true or (v_summary->'verification') is not null then
    raise exception 'summary shape was wrong';
  end if;
  if (v_summary->'checks'->'week_spending'->>'xp_awarded')::int <= 0
     or (v_summary_again->'checks'->'week_spending'->>'xp_awarded')::int <> 0 then
    raise exception 'week spending did not pay once';
  end if;

  begin
    perform public.import_monarch_transactions(encode(extensions.digest(convert_to('nope', 'UTF8'), 'sha256'), 'hex'), '00000000-0000-4000-8000-00000000d707', '[]'::jsonb);
    raise exception 'bad token was accepted';
  exception when sqlstate '28000' then
    null;
  end;

  insert into public.companion_bonds (inviter_id, companion_id, status, token_hash, expires_at, accepted_at)
  values (a, b, 'active', 'smoke-finance-bond-a701', now() + interval '1 day', now());
  perform set_config('request.jwt.claim.sub', b::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  select count(*) into v_other from public.finance_transactions;
  if v_other <> 0 then raise exception 'second account read transaction rows'; end if;
  select count(*) into v_other from public.finance_quest_flags;
  if v_other <> 0 then raise exception 'second account read review flags'; end if;
  v_companion := public.finance_week_summary();
  if (v_companion->>'owner')::boolean or (v_companion->>'row_count')::int <> 0 or v_companion::text ~ '[0-9]+\.[0-9]{2}' then
    raise exception 'companion summary leaked';
  end if;

  raise exception 'finance_transactions_smoke_ok';
end $$;
