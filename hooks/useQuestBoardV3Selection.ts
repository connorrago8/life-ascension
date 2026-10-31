"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { questDay, selectDailyQuests, type Quest } from "../src/lib/quest-board-v3";

type Snapshot={day:string;questIds:string[];persisted:boolean};
type DbQuest={id:string;title:string;cadence:string;created_at:string;domain:string;active:boolean};
export function useQuestBoardV3Selection(){
 const [selection,setSelection]=useState<Snapshot|null>(null);
 const [message,setMessage]=useState("");
 const refresh=useCallback(async()=>{
  const client=supabase();
  const {data:{user},error:authError}=await client.auth.getUser();
  if(authError||!user){setSelection(null);return}
  const day=questDay(new Date());
  const {data:stored,error:readError}=await client.from("quest_board_v3_selections").select("quest_ids").eq("owner_id",user.id).eq("day",day).maybeSingle();
  if(readError){
   // Never pretend a local-only selection is saved to the server.
   setMessage("Quest Board 3 storage is not available yet. Daily picks are not persisted.");
   setSelection(null);return;
  }
  if(stored){
   setSelection({day,questIds:stored.quest_ids as string[],persisted:true});setMessage("");return;
  }
  const {data:rows,error:qe}=await client.from("quests").select("id,title,cadence,created_at,domain,active").eq("owner_id",user.id).eq("active",true).eq("cadence","daily").limit(300);
  if(qe){setMessage("Could not load quest pool.");return}
  const pool=((rows||[]) as DbQuest[]).map(q=>({id:q.id,title:q.title,cadence:"daily" as const,source:"manual" as const,enabled:q.active,priority:5,createdAt:q.created_at,category:q.domain} satisfies Quest));
  const proposed=selectDailyQuests(pool,new Date()).map(q=>q.id);
  // ON CONFLICT DO NOTHING: another device can win; always re-read the winner.
  const {error:writeError}=await client.from("quest_board_v3_selections").upsert({owner_id:user.id,day,quest_ids:proposed},{onConflict:"owner_id,day",ignoreDuplicates:true});
  if(writeError){setMessage("Daily selection could not be saved.");return}
  const {data:final,error:finalError}=await client.from("quest_board_v3_selections").select("quest_ids").eq("owner_id",user.id).eq("day",day).single();
  if(finalError||!final){setMessage("Unable to verify saved daily selection.");return}
  setSelection({day,questIds:final.quest_ids as string[],persisted:true});setMessage("");
 },[]);
 useEffect(()=>{void refresh()},[refresh]);
 return {selection,message,refresh};
}
