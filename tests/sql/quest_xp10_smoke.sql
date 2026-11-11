do $$ begin
  assert public.quest_streak_xp(10,0,true) = 10;
  assert public.quest_streak_xp(10,0,false) = 10;
  assert public.quest_streak_xp(10,1,false) = 11;
  assert public.quest_streak_xp(10,5,false) = 15;
  assert public.quest_streak_xp(10,7,false) = 17;
  assert public.quest_streak_xp(10,10,false) = 20;
  assert public.quest_streak_xp(15,1,false) = 17, 'half up';
end $$;
select 'quest xp10 smoke passed' as result;
