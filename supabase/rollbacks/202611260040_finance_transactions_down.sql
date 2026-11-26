-- Drops the owner-only finance import tables and functions.
-- Do not run this once real imported transactions exist: those rows are deleted.
-- It does not delete quests, xp_ledger, streaks, or gear.

drop function if exists public.finance_week_summary();
drop function if exists public.finance_ingest_token_revoke();
drop function if exists public.finance_ingest_token_rotate();
drop function if exists public.finance_ingest_token_create();
drop function if exists public._finance_issue_token(boolean);
drop function if exists public.import_monarch_transactions(text, uuid, jsonb);
drop function if exists public.import_finance_csv(uuid, jsonb);
drop function if exists public._finance_import(uuid, text, uuid, jsonb);
drop function if exists public._finance_verify_money(uuid);
drop function if exists public._finance_complete_no_spend(date);
drop function if exists public._finance_complete_template(text);
drop function if exists public._finance_flag(uuid, text, text);
drop function if exists public.finance_content_hash(text, text, date, text, text, text, numeric, boolean);
drop function if exists public.finance_mask_account(text);
drop function if exists public.finance_caller_is_companion();
drop view if exists public.finance_ingest_tokens_safe;
drop table if exists public.finance_no_spend_days;
drop table if exists public.finance_quest_flags;
drop table if exists public.finance_summary_views;
drop table if exists public.finance_ingest_tokens;
drop table if exists public.finance_import_log;
drop table if exists public.finance_transactions;
