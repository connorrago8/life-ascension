-- Reverse 202611140001_engagement_pwa_push.sql. TEST only.
begin;

do $$
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime drop table public.push_outbox;
    exception when undefined_object then
      null;
    end;
  end if;
end $$;

drop trigger if exists engagement_xp_award_push on public.xp_ledger;
drop trigger if exists engagement_companion_quest_push on public.companion_quests;

drop function if exists public.widget_read(text);
drop function if exists public.widget_revoke_token(uuid);
drop function if exists public.widget_create_token();
drop function if exists public.engagement_cron_bound();
drop function if exists public.push_subscription_result(uuid, uuid, integer, text);
drop function if exists public.push_release(uuid, text);
drop function if exists public.push_finalize(uuid, text, text);
drop function if exists public.push_actor_ok(uuid, text);
drop function if exists public.push_claim(text);
drop function if exists public.push_unsubscribe(text);
drop function if exists public.push_subscribe(text, text, text, text);
drop function if exists public.engagement_on_xp_award();
drop function if exists public.engagement_on_companion_quest();
drop function if exists public.engagement_clean_title(text);
drop function if exists public.engagement_enqueue_streak(uuid);
drop function if exists public.engagement_kind_enabled(uuid, text);
drop function if exists public.engagement_is_quiet(uuid, timestamptz);
drop function if exists public.engagement_local_minutes(uuid, timestamptz);
drop function if exists public.engagement_own_status(uuid);
drop function if exists public.engagement_quests_path(uuid);
drop function if exists public.engagement_cron_ok(text);

drop view if exists public.widget_tokens_safe;
drop table if exists public.widget_tokens;
drop table if exists public.push_deliveries;
drop table if exists public.push_outbox;
drop table if exists public.notification_preferences;
drop table if exists public.push_subscriptions;
drop table if exists private.engagement_config;

commit;
